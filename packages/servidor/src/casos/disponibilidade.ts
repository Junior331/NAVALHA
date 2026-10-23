import {
  barbeirosQueFazem,
  duracaoTotal,
  horariosLivres,
  instanteLocal,
  minutos,
  partesLocais,
  precoDoServico,
  type Desconto,
  type Intervalo,
} from '@navalha/core'
import type { Contexto } from '../contexto'
import { ErroDeNegocio } from '../erros'

// Horários livres de um dia, por barbeiro, para os serviços escolhidos (Figma Cliente 08 e 09).
// Considera o expediente do barbeiro dentro do horário da barbearia, intervalo, folgas,
// agendamentos ativos e reservas de Pix ainda abertas.

const PASSO_MIN = 15
const ANTECEDENCIA_MINIMA_MIN = 15

export interface ServicoEscolhido {
  servicoId: string
  nome: string
  duracaoMin: number
  precoCentavos: number
}

export interface Disponibilidade {
  data: string
  duracaoMin: number
  valorBrutoCentavos: number
  servicos: ServicoEscolhido[]
  barbeiros: { barbeiroId: string; nome: string; inicios: string[] }[]
}

export async function carregarServicos(
  ctx: Contexto,
  barbeariaId: string,
  servicoIds: string[],
): Promise<ServicoEscolhido[]> {
  if (servicoIds.length === 0)
    throw new ErroDeNegocio('dados_invalidos', 'Escolha ao menos um serviço')
  const linhas = await ctx.sql<
    {
      id: string
      nome: string
      duracao_min: number
      preco_centavos: number
      desconto_tipo: 'percentual' | 'fixo' | null
      desconto_valor: number | null
    }[]
  >`
    select id, nome, duracao_min, preco_centavos, desconto_tipo, desconto_valor
    from public.servicos
    where barbearia_id = ${barbeariaId} and ativo and id in ${ctx.sql(servicoIds)}`
  if (linhas.length !== new Set(servicoIds).size) {
    throw new ErroDeNegocio('dados_invalidos', 'Algum serviço não existe ou não está disponível')
  }
  return linhas.map((s) => {
    const desconto: Desconto | null =
      s.desconto_tipo === 'percentual'
        ? { tipo: 'percentual', pct: s.desconto_valor ?? 0 }
        : s.desconto_tipo === 'fixo'
          ? { tipo: 'fixo', valor: s.desconto_valor ?? 0 }
          : null
    return {
      servicoId: s.id,
      nome: s.nome,
      duracaoMin: s.duracao_min,
      precoCentavos: precoDoServico(s.preco_centavos, desconto),
    }
  })
}

export async function consultarDisponibilidade(
  ctx: Contexto,
  params: { barbeariaId: string; data: string; servicoIds: string[]; barbeiroId?: string },
): Promise<Disponibilidade> {
  const [barbearia] = await ctx.sql<{ fuso: string }[]>`
    select fuso from public.barbearias where id = ${params.barbeariaId}`
  if (!barbearia) throw new ErroDeNegocio('nao_encontrado', 'Barbearia não encontrada')
  const fuso = barbearia.fuso

  const servicos = await carregarServicos(ctx, params.barbeariaId, params.servicoIds)
  const duracaoMin = duracaoTotal(servicos)
  const valorBrutoCentavos = servicos.reduce((total, s) => total + s.precoCentavos, 0)

  const equipe = await ctx.sql<{ id: string; nome: string; servico_ids: string[] }[]>`
    select m.id, coalesce(pp.nome_exibicao, pe.nome, 'Barbeiro') as nome,
      coalesce(array_agg(sb.servico_id) filter (where sb.servico_id is not null), '{}') as servico_ids
    from public.membros m
    left join public.perfis_profissionais pp on pp.membro_id = m.id
    left join public.perfis pe on pe.usuario_id = m.usuario_id
    left join public.servico_barbeiro sb on sb.membro_id = m.id
    where m.barbearia_id = ${params.barbeariaId} and m.ativo
    group by m.id, pp.nome_exibicao, pe.nome
    order by nome`
  const aptos = barbeirosQueFazem(
    params.servicoIds,
    equipe.map((b) => ({ id: b.id, servicoIds: b.servico_ids })),
  ).filter((id) => !params.barbeiroId || id === params.barbeiroId)

  const inicioDoDia = instanteLocal(params.data, 0, fuso)
  const fimDoDia = instanteLocal(params.data, 24 * 60, fuso)
  const hoje = partesLocais(ctx.agora(), fuso)
  const diaSemana = partesLocais(instanteLocal(params.data, 12 * 60, fuso), fuso).diaSemana
  if (params.data < hoje.data || aptos.length === 0) {
    return { data: params.data, duracaoMin, valorBrutoCentavos, servicos, barbeiros: [] }
  }
  const aPartirDe = params.data === hoje.data ? hoje.minutos + ANTECEDENCIA_MINIMA_MIN : 0

  const [loja] = await ctx.sql<{ abre: string; fecha: string }[]>`
    select abre::text, fecha::text from public.horarios_barbearia
    where barbearia_id = ${params.barbeariaId} and dia_semana = ${diaSemana}`
  const turnos = await ctx.sql<
    {
      membro_id: string
      inicio: string
      fim: string
      pausa_inicio: string | null
      pausa_fim: string | null
    }[]
  >`
    select membro_id, inicio::text, fim::text, pausa_inicio::text, pausa_fim::text
    from public.horarios_atendimento
    where membro_id in ${ctx.sql(aptos)} and dia_semana = ${diaSemana}`
  const bloqueios = await ctx.sql<{ membro_id: string | null; inicio: Date; fim: Date }[]>`
    select membro_id, inicio, fim from public.bloqueios
    where barbearia_id = ${params.barbeariaId}
      and (membro_id is null or membro_id in ${ctx.sql(aptos)})
      and tstzrange(inicio, fim) && tstzrange(${inicioDoDia}, ${fimDoDia})`
  const ocupados = await ctx.sql<{ barbeiro_id: string; inicio: Date; fim: Date }[]>`
    select barbeiro_id, inicio, fim from public.agendamentos
    where barbeiro_id in ${ctx.sql(aptos)}
      and status in ('reservado', 'confirmado', 'em_atendimento')
      and tstzrange(inicio, fim) && tstzrange(${inicioDoDia}, ${fimDoDia})
    union all
    select barbeiro_id, inicio, fim from public.reservas_horario
    where barbeiro_id in ${ctx.sql(aptos)} and expira_em > ${ctx.agora()}
      and tstzrange(inicio, fim) && tstzrange(${inicioDoDia}, ${fimDoDia})`

  const noDia = (inicio: Date, fim: Date): Intervalo => ({
    inicio: Math.max(0, (inicio.getTime() - inicioDoDia.getTime()) / 60_000),
    fim: Math.min(24 * 60, (fim.getTime() - inicioDoDia.getTime()) / 60_000),
  })
  const hhmm = (valor: string) => minutos(valor.slice(0, 5))

  const barbeiros = aptos.map((barbeiroId) => {
    const turno = turnos.find((t) => t.membro_id === barbeiroId)
    const nome = equipe.find((b) => b.id === barbeiroId)?.nome ?? 'Barbeiro'
    if (!turno || !loja) return { barbeiroId, nome, inicios: [] }
    const livres = horariosLivres({
      expediente: {
        inicio: Math.max(hhmm(turno.inicio), hhmm(loja.abre)),
        fim: Math.min(hhmm(turno.fim), hhmm(loja.fecha)),
        pausas:
          turno.pausa_inicio && turno.pausa_fim
            ? [{ inicio: hhmm(turno.pausa_inicio), fim: hhmm(turno.pausa_fim) }]
            : [],
      },
      bloqueios: bloqueios
        .filter((b) => b.membro_id === null || b.membro_id === barbeiroId)
        .map((b) => noDia(b.inicio, b.fim)),
      ocupados: ocupados
        .filter((o) => o.barbeiro_id === barbeiroId)
        .map((o) => noDia(o.inicio, o.fim)),
      duracaoMin,
      passoMin: PASSO_MIN,
      aPartirDe,
    })
    return {
      barbeiroId,
      nome,
      inicios: livres.map((m) => instanteLocal(params.data, m, fuso).toISOString()),
    }
  })

  return { data: params.data, duracaoMin, valorBrutoCentavos, servicos, barbeiros }
}
