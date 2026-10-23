import { randomUUID } from 'node:crypto'
import {
  fimDaTolerancia,
  fimDoPrazoGratis,
  partesLocais,
  planejarCobrancaNoCartao,
  type Plano,
} from '@navalha/core'
import type { Transacao } from '@navalha/db'
import type { Contexto, EventoInterno } from '../contexto'
import { ErroDeNegocio } from '../erros'
import { carregarAgendamento } from '../repositorio'
import { exigirMembro, papelNaBarbearia, type Usuario } from './acesso'
import { consultarDisponibilidade, type Disponibilidade } from './disponibilidade'

// Agenda: remarcar (Admin 02i, Cliente 13) e agendar pelo balcão (Admin 02d–02h). O agendamento
// é instantâneo, sem status Pendente (CLAUDE.md).

/** A pré-autorização é criada na janela de 72h e precisa valer até a captura (cartao-pre-autorizado §Cartão). */
const VALIDADE_PRE_AUTORIZACAO_MS = 72 * 3_600_000

function quandoLocal(data: Date): string {
  return data.toLocaleString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })
}

async function conferirHorarioLivre(
  tx: Transacao,
  params: { barbeiroId: string; inicio: Date; fim: Date; agora: Date; ignorar?: string },
): Promise<void> {
  // Mesma trava da criação (casos/agendar): um agendamento por barbeiro de cada vez.
  await tx`select pg_advisory_xact_lock(hashtext(${params.barbeiroId}))`
  const conflitos = await tx`
    select 1 from public.agendamentos
    where barbeiro_id = ${params.barbeiroId} and id is distinct from ${params.ignorar ?? null}
      and status in ('reservado', 'confirmado', 'em_atendimento')
      and tstzrange(inicio, fim) && tstzrange(${params.inicio}, ${params.fim})
    union all
    select 1 from public.reservas_horario
    where barbeiro_id = ${params.barbeiroId} and expira_em > ${params.agora}
      and tstzrange(inicio, fim) && tstzrange(${params.inicio}, ${params.fim})`
  if (conflitos.length > 0) {
    throw new ErroDeNegocio('horario_indisponivel', 'Esse horário acabou de ser ocupado')
  }
}

async function servicosDoAgendamento(ctx: Contexto, agendamentoId: string): Promise<string[]> {
  const linhas = await ctx.sql<{ servico_id: string }[]>`
    select servico_id from public.agendamento_servicos where agendamento_id = ${agendamentoId}`
  return linhas.map((l) => l.servico_id)
}

/** Horários livres para remarcar: os serviços do próprio agendamento, sem ele ocupar a agenda. */
export async function horariosParaRemarcar(
  ctx: Contexto,
  usuario: Usuario,
  params: { agendamentoId: string; data: string; barbeiroId?: string },
): Promise<Disponibilidade> {
  const ag = await carregarAgendamento(ctx.sql, params.agendamentoId)
  const membro = await papelNaBarbearia(ctx.sql, usuario.id, ag.barbeariaId)
  if (!membro && ag.clienteUsuarioId !== usuario.id) {
    throw new ErroDeNegocio('sem_permissao', 'Você não tem acesso a este agendamento')
  }
  return consultarDisponibilidade(ctx, {
    barbeariaId: ag.barbeariaId,
    data: params.data,
    servicoIds: await servicosDoAgendamento(ctx, ag.id),
    barbeiroId: params.barbeiroId ?? ag.barbeiroId,
    ignorarAgendamentoId: ag.id,
    ...(membro ? { antecedenciaMin: 0 } : {}),
  })
}

/** Horários para o balcão: a equipe pode encaixar quem chegou agora, sem antecedência mínima. */
export async function horariosDaEquipe(
  ctx: Contexto,
  usuario: Usuario,
  params: { barbeariaId: string; data: string; servicoIds: string[]; barbeiroId?: string },
): Promise<Disponibilidade> {
  await exigirMembro(ctx.sql, usuario, params.barbeariaId)
  return consultarDisponibilidade(ctx, { ...params, antecedenciaMin: 0 })
}

async function fusoDa(ctx: Contexto, barbeariaId: string): Promise<string> {
  const [barbearia] = await ctx.sql<{ fuso: string }[]>`
    select fuso from public.barbearias where id = ${barbeariaId}`
  if (!barbearia) throw new ErroDeNegocio('nao_encontrado', 'Barbearia não encontrada')
  return barbearia.fuso
}

/**
 * Remarcar: a equipe remarca qualquer agendamento ativo; o cliente, só dentro do prazo grátis.
 * Prazo grátis e tolerância andam junto com o horário, com a política do momento da compra.
 */
export async function remarcarAgendamento(
  ctx: Contexto,
  usuario: Usuario,
  params: { agendamentoId: string; inicio: string; barbeiroId?: string },
): Promise<{ versao: number; eventos: EventoInterno[] }> {
  const ag = await carregarAgendamento(ctx.sql, params.agendamentoId)
  const membro = await papelNaBarbearia(ctx.sql, usuario.id, ag.barbeariaId)
  if (!membro && ag.clienteUsuarioId !== usuario.id) {
    throw new ErroDeNegocio('sem_permissao', 'Você não tem acesso a este agendamento')
  }
  if (ag.status !== 'reservado' && ag.status !== 'confirmado') {
    throw new ErroDeNegocio('estado_invalido', 'Só dá para remarcar um agendamento que não começou')
  }
  const agora = ctx.agora()
  if (!membro && agora.getTime() > ag.prazoGratisAte.getTime()) {
    throw new ErroDeNegocio(
      'estado_invalido',
      'O prazo para remarcar pelo app acabou. Fale com a barbearia.',
    )
  }
  if (ag.pagamento?.status === 'recusado') {
    throw new ErroDeNegocio('estado_invalido', 'Regularize o pagamento antes de remarcar')
  }
  const inicio = new Date(params.inicio)
  if (Number.isNaN(inicio.getTime()) || inicio.getTime() <= agora.getTime()) {
    throw new ErroDeNegocio('dados_invalidos', 'Escolha um horário que ainda não passou')
  }

  const barbeiroId = params.barbeiroId ?? ag.barbeiroId
  const disponibilidade = await consultarDisponibilidade(ctx, {
    barbeariaId: ag.barbeariaId,
    data: partesLocais(inicio, await fusoDa(ctx, ag.barbeariaId)).data,
    servicoIds: await servicosDoAgendamento(ctx, ag.id),
    barbeiroId,
    ignorarAgendamentoId: ag.id,
    ...(membro ? { antecedenciaMin: 0 } : {}),
  })
  if (!disponibilidade.barbeiros.some((b) => b.inicios.includes(inicio.toISOString()))) {
    throw new ErroDeNegocio('horario_indisponivel', 'Esse horário não está disponível')
  }

  const deslocar = (data: Date) => new Date(data.getTime() + inicio.getTime() - ag.inicio.getTime())
  const fim = deslocar(ag.fim)
  const prazoGratisAte = deslocar(ag.prazoGratisAte)
  const toleranciaAte = deslocar(ag.toleranciaAte)

  // Cartão ainda não pré-autorizado: replaneja a janela. Já pré-autorizado: a captura muda, mas
  // precisa caber na validade da pré-autorização.
  const pagamento = ag.pagamento
  let cobranca: { preAutorizarEm: Date; capturarEm: Date } | null = null
  if (pagamento?.meio === 'cartao' && pagamento.status === 'tokenizado') {
    const plano = planejarCobrancaNoCartao({ agora, fimPrazoGratis: prazoGratisAte })
    cobranca = { preAutorizarEm: plano.preAutorizarEm, capturarEm: plano.capturarEm }
  } else if (pagamento?.meio === 'cartao' && pagamento.status === 'pre_autorizado') {
    const preAutorizadoEm = pagamento.preAutorizarEm ?? agora
    const validaAte = new Date(preAutorizadoEm.getTime() + VALIDADE_PRE_AUTORIZACAO_MS)
    if (prazoGratisAte.getTime() > validaAte.getTime()) {
      throw new ErroDeNegocio(
        'estado_invalido',
        `O cartão está garantido só até ${quandoLocal(validaAte)}. Escolha um horário mais próximo, ou cancele e agende de novo.`,
      )
    }
    cobranca = {
      preAutorizarEm: preAutorizadoEm,
      capturarEm: new Date(Math.max(prazoGratisAte.getTime(), agora.getTime())),
    }
  }

  const versao = await ctx.sql.begin(async (tx) => {
    await conferirHorarioLivre(tx, { barbeiroId, inicio, fim, agora, ignorar: ag.id })
    const [linha] = await tx<{ versao: number }[]>`
      update public.agendamentos
      set inicio = ${inicio}, fim = ${fim}, barbeiro_id = ${barbeiroId},
        prazo_gratis_ate = ${prazoGratisAte}, tolerancia_ate = ${toleranciaAte}, versao = versao + 1
      where id = ${ag.id} and versao = ${ag.versao} and status in ('reservado', 'confirmado')
      returning versao`
    if (!linha) {
      throw new ErroDeNegocio('estado_invalido', 'O agendamento mudou enquanto você remarcava')
    }
    if (cobranca && pagamento) {
      await tx`
        update public.pagamentos
        set pre_autorizar_em = ${cobranca.preAutorizarEm}, capturar_em = ${cobranca.capturarEm},
          atualizado_em = now()
        where id = ${pagamento.id}`
    }
    return linha.versao
  })

  // Avisa o outro lado: a equipe remarcou, o cliente fica sabendo; o cliente remarcou, o barbeiro.
  if (membro && ag.clienteUsuarioId) {
    await ctx.notificador.notificar({
      usuarioId: ag.clienteUsuarioId,
      titulo: 'Seu horário mudou',
      corpo: `${ag.barbeariaNome} remarcou seu horário para ${quandoLocal(inicio)}.`,
      tipo: 'agendamento_remarcado',
      dados: { agendamentoId: ag.id },
    })
  } else if (!membro) {
    const [barbeiro] = await ctx.sql<{ usuario_id: string }[]>`
      select usuario_id from public.membros where id = ${barbeiroId}`
    if (barbeiro) {
      await ctx.notificador.notificar({
        usuarioId: barbeiro.usuario_id,
        titulo: 'Cliente remarcou',
        corpo: `O agendamento ${ag.codigo} passou para ${quandoLocal(inicio)}.`,
        tipo: 'agendamento_remarcado',
        dados: { agendamentoId: ag.id },
      })
    }
  }

  return {
    versao,
    eventos: [{ name: 'agendamento/criado', data: { agendamentoId: ag.id, versao } }],
  }
}

export interface EntradaBalcao {
  barbeariaId: string
  /** Cliente que já veio à barbearia, ou um novo. */
  cliente: { id: string } | { nome: string; celular?: string; email?: string }
  servicoIds: string[]
  barbeiroId: string
  inicio: string
  observacoes?: string
}

/**
 * Novo agendamento pela equipe (Admin 02d–02h): entra Confirmado, com o pagamento combinado na
 * barbearia, fora do app. Não passa pelo gateway, então não há liquidação de dinheiro.
 */
export async function agendarNoBalcao(
  ctx: Contexto,
  usuario: Usuario,
  entrada: EntradaBalcao,
): Promise<{ agendamentoId: string; codigo: string; eventos: EventoInterno[] }> {
  await exigirMembro(ctx.sql, usuario, entrada.barbeariaId)
  const [barbearia] = await ctx.sql<
    {
      fuso: string
      plano: Plano | null
      prazo_gratis_horas: string | null
      retencao_pct: number | null
      tolerancia_min: number | null
    }[]
  >`
    select b.fuso, a.plano, p.prazo_gratis_horas::text, p.retencao_pct, p.tolerancia_min
    from public.barbearias b
    left join public.assinaturas a on a.barbearia_id = b.id
    left join public.politicas_cancelamento p on p.barbearia_id = b.id
    where b.id = ${entrada.barbeariaId}`
  if (!barbearia) throw new ErroDeNegocio('nao_encontrado', 'Barbearia não encontrada')

  const inicio = new Date(entrada.inicio)
  if (Number.isNaN(inicio.getTime())) throw new ErroDeNegocio('dados_invalidos', 'Horário inválido')
  const disponibilidade = await consultarDisponibilidade(ctx, {
    barbeariaId: entrada.barbeariaId,
    data: partesLocais(inicio, barbearia.fuso).data,
    servicoIds: entrada.servicoIds,
    barbeiroId: entrada.barbeiroId,
    antecedenciaMin: 0,
  })
  if (!disponibilidade.barbeiros.some((b) => b.inicios.includes(inicio.toISOString()))) {
    throw new ErroDeNegocio('horario_indisponivel', 'Esse horário não está disponível')
  }

  const fim = new Date(inicio.getTime() + disponibilidade.duracaoMin * 60_000)
  const politica = {
    prazoGratisHoras: Number(barbearia.prazo_gratis_horas ?? 2),
    retencaoPct: barbearia.retencao_pct ?? 50,
    toleranciaMin: barbearia.tolerancia_min ?? 15,
  }
  const valor = disponibilidade.valorBrutoCentavos
  const id = randomUUID()

  const codigo = await ctx.sql.begin(async (tx) => {
    const clienteId = await clienteDoBalcao(tx, entrada)
    await conferirHorarioLivre(tx, {
      barbeiroId: entrada.barbeiroId,
      inicio,
      fim,
      agora: ctx.agora(),
    })
    const [linha] = await tx<{ codigo: string }[]>`
      insert into public.agendamentos (id, barbearia_id, cliente_id, barbeiro_id, inicio, fim, status,
        valor_bruto_centavos, desconto_centavos, valor_pago_centavos, prazo_gratis_ate, tolerancia_ate,
        retencao_pct, plano, origem, pago_no_balcao, observacoes)
      values (${id}, ${entrada.barbeariaId}, ${clienteId}, ${entrada.barbeiroId}, ${inicio}, ${fim},
        'confirmado', ${valor}, 0, ${valor}, ${fimDoPrazoGratis(inicio, politica)},
        ${fimDaTolerancia(inicio, politica)}, ${politica.retencaoPct}, ${barbearia.plano ?? 'free'},
        'balcao', true, ${entrada.observacoes ?? null})
      returning codigo`
    for (const s of disponibilidade.servicos) {
      await tx`
        insert into public.agendamento_servicos (agendamento_id, servico_id, nome, duracao_min, preco_centavos)
        values (${id}, ${s.servicoId}, ${s.nome}, ${s.duracaoMin}, ${s.precoCentavos})`
    }
    return linha?.codigo ?? ''
  })

  return {
    agendamentoId: id,
    codigo,
    eventos: [{ name: 'agendamento/criado', data: { agendamentoId: id } }],
  }
}

async function clienteDoBalcao(tx: Transacao, entrada: EntradaBalcao): Promise<string> {
  if ('id' in entrada.cliente) {
    // Só clientes que já agendaram nesta barbearia: a equipe não enxerga a base de outras.
    const [conhecido] = await tx<{ cliente_id: string }[]>`
      select cliente_id from public.agendamentos
      where cliente_id = ${entrada.cliente.id} and barbearia_id = ${entrada.barbeariaId}
      limit 1`
    if (!conhecido) throw new ErroDeNegocio('nao_encontrado', 'Cliente não encontrado')
    return conhecido.cliente_id
  }
  const nome = entrada.cliente.nome.trim()
  if (!nome) throw new ErroDeNegocio('dados_invalidos', 'Informe o nome do cliente')
  const [novo] = await tx<{ id: string }[]>`
    insert into public.clientes (nome, celular, email)
    values (${nome}, ${entrada.cliente.celular ?? null}, ${entrada.cliente.email ?? null})
    returning id`
  if (!novo) throw new ErroDeNegocio('dados_invalidos', 'Não foi possível cadastrar o cliente')
  return novo.id
}

/** Clientes que já agendaram na barbearia, para o passo "Cliente" do novo agendamento. */
export async function buscarClientes(
  ctx: Contexto,
  usuario: Usuario,
  params: { barbeariaId: string; termo: string },
): Promise<{ id: string; nome: string; celular: string | null; visitas: number }[]> {
  await exigirMembro(ctx.sql, usuario, params.barbeariaId)
  const termo = `%${params.termo.trim()}%`
  return ctx.sql<{ id: string; nome: string; celular: string | null; visitas: number }[]>`
    select c.id, c.nome, c.celular, count(a.id)::int as visitas
    from public.clientes c
    join public.agendamentos a on a.cliente_id = c.id and a.barbearia_id = ${params.barbeariaId}
    where c.nome ilike ${termo} or coalesce(c.celular, '') like ${termo}
    group by c.id
    order by max(a.inicio) desc
    limit 10`
}
