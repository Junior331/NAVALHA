import { transicionar, type StatusAgendamento } from '@navalha/core'
import type { Contexto, EventoInterno } from '../contexto'
import { ErroDeNegocio } from '../erros'
import { exigirDono, exigirMembro, type Usuario } from './acesso'

// Gestão da equipe (Figma Admin 03c, backlog: confirmação com os agendamentos afetados).

interface Membro {
  id: string
  barbearia_id: string
  papel: 'dono' | 'barbeiro'
  usuario_id: string
  ativo: boolean
}

async function carregarMembro(ctx: Contexto, membroId: string): Promise<Membro> {
  const [membro] = await ctx.sql<Membro[]>`
    select id, barbearia_id, papel, usuario_id, ativo from public.membros where id = ${membroId}`
  if (!membro) throw new ErroDeNegocio('nao_encontrado', 'Barbeiro não encontrado')
  return membro
}

async function ativosNoPeriodo(ctx: Contexto, membroId: string, inicio: Date, fim: Date | null) {
  const ate = fim ? ctx.sql`and inicio < ${fim}` : ctx.sql``
  return ctx.sql<{ id: string; status: StatusAgendamento }[]>`
    select id, status from public.agendamentos
    where barbeiro_id = ${membroId} and status in ('reservado', 'confirmado')
      and fim > ${inicio} ${ate}
    order by inicio`
}

/** Quantos agendamentos ativos o barbeiro tem a partir de agora (ou num período). */
export async function agendamentosAfetados(
  ctx: Contexto,
  usuario: Usuario,
  params: { membroId: string; inicio?: string; fim?: string },
): Promise<{ quantidade: number }> {
  const membro = await carregarMembro(ctx, params.membroId)
  await exigirMembro(ctx.sql, usuario, membro.barbearia_id)
  const inicio = params.inicio ? new Date(params.inicio) : ctx.agora()
  const fim = params.fim ? new Date(params.fim) : null
  return { quantidade: (await ativosNoPeriodo(ctx, membro.id, inicio, fim)).length }
}

/** Pausar agenda (Barbeiro 04b, Admin 03c): o dono ou o próprio barbeiro bloqueia um período. */
export async function pausarAgenda(
  ctx: Contexto,
  usuario: Usuario,
  params: { membroId: string; inicio: string; fim: string; motivo?: string },
): Promise<{ bloqueioId: string; afetados: number }> {
  const membro = await carregarMembro(ctx, params.membroId)
  const quem = await exigirMembro(ctx.sql, usuario, membro.barbearia_id)
  if (quem.papel !== 'dono' && quem.membroId !== membro.id) {
    throw new ErroDeNegocio('sem_permissao', 'Só o dono ou o próprio barbeiro pausa a agenda')
  }
  const inicio = new Date(params.inicio)
  const fim = new Date(params.fim)
  if (!(fim.getTime() > inicio.getTime())) {
    throw new ErroDeNegocio('dados_invalidos', 'O fim da pausa precisa ser depois do início')
  }
  const [bloqueio] = await ctx.sql<{ id: string }[]>`
    insert into public.bloqueios (barbearia_id, membro_id, inicio, fim, motivo)
    values (${membro.barbearia_id}, ${membro.id}, ${inicio}, ${fim}, ${params.motivo ?? 'Agenda pausada'})
    returning id`
  // Os agendamentos já marcados no período continuam: a pausa só fecha novos horários.
  const afetados = (await ativosNoPeriodo(ctx, membro.id, inicio, fim)).length
  return { bloqueioId: bloqueio?.id ?? '', afetados }
}

/**
 * Remover da barbearia: o barbeiro sai da equipe e os agendamentos futuros dele são cancelados
 * pela barbearia (estorno integral ao cliente, regras-de-negocio §Cenários de liquidação).
 */
export async function removerBarbeiro(
  ctx: Contexto,
  usuario: Usuario,
  params: { membroId: string },
): Promise<{ cancelados: number; eventos: EventoInterno[] }> {
  const membro = await carregarMembro(ctx, params.membroId)
  await exigirDono(ctx.sql, usuario, membro.barbearia_id)
  if (membro.papel === 'dono')
    throw new ErroDeNegocio('estado_invalido', 'O dono não pode ser removido')
  if (!membro.ativo) throw new ErroDeNegocio('estado_invalido', 'Esse barbeiro já saiu da equipe')

  const eventos: EventoInterno[] = []
  await ctx.sql.begin(async (tx) => {
    await tx`update public.membros set ativo = false where id = ${membro.id}`
    const futuros = await tx<{ id: string; status: StatusAgendamento }[]>`
      select id, status from public.agendamentos
      where barbeiro_id = ${membro.id} and status in ('reservado', 'confirmado') and inicio > ${ctx.agora()}
      for update`
    for (const ag of futuros) {
      await tx`
        update public.agendamentos
        set status = ${transicionar(ag.status, 'barbearia_cancelou')}, cancelado_em = ${ctx.agora()},
          motivo_cancelamento = 'Barbeiro saiu da equipe'
        where id = ${ag.id}`
      eventos.push(
        { name: 'agendamento/cancelado', data: { agendamentoId: ag.id } },
        { name: 'agendamento/finalizado', data: { agendamentoId: ag.id } },
      )
    }
  })
  return { cancelados: eventos.length / 2, eventos }
}
