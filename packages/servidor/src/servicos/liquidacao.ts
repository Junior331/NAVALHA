import {
  atualizarFidelidade,
  liquidar,
  type EscolhaPixNoPrazo,
  type EventoFinal,
  type Liquidacao,
  type StatusAgendamento,
} from '@navalha/core'
import type { Enum } from '@navalha/db'
import type { Cobranca } from '@navalha/pagamentos'
import type { Contexto, Resultado } from '../contexto'
import { ErroDeNegocio } from '../erros'
import {
  carregarAgendamento,
  exigirSubconta,
  reais,
  type AgendamentoCompleto,
} from '../repositorio'

// Liquidação no evento final (regras-de-negocio §Cenários de liquidação e §Ações do backend por
// evento). Cada passo confere o estado no gateway antes de agir, para que rodar de novo depois de
// uma falha no meio (retry do Inngest) não estorne nem capture duas vezes.

const EVENTO_DO_STATUS: Partial<Record<StatusAgendamento, EventoFinal>> = {
  concluido: 'concluido',
  cancelado_no_prazo: 'cancelado_no_prazo',
  cancelado_fora_do_prazo: 'cancelado_fora_do_prazo',
  no_show: 'no_show',
  cancelado_pela_barbearia: 'cancelado_pela_barbearia',
}

const COBRADA = new Set<Cobranca['status']>([
  'paga',
  'capturada',
  'estornada_parcialmente',
  'estornada',
])

export async function liquidarAgendamento(
  ctx: Contexto,
  params: { agendamentoId: string; escolhaPix?: EscolhaPixNoPrazo },
): Promise<
  Resultado<'liquidado' | 'ja_liquidado' | 'nada_a_liquidar'> & { liquidacao?: Liquidacao }
> {
  const ag = await carregarAgendamento(ctx.sql, params.agendamentoId)
  if (ag.status === 'liberado') return { resultado: 'nada_a_liquidar', eventos: [] }

  const evento = EVENTO_DO_STATUS[ag.status]
  if (!evento) {
    throw new ErroDeNegocio('estado_invalido', `Agendamento ainda não terminou (${ag.status})`)
  }
  if (await jaLiquidado(ctx, ag.id)) return { resultado: 'ja_liquidado', eventos: [] }

  const retemDinheiro =
    evento === 'concluido' || evento === 'cancelado_fora_do_prazo' || evento === 'no_show'
  let cobranca = await cobrancaAtual(ctx, ag)

  // O cartão é capturado no fim do prazo grátis; se o job ainda não capturou, captura agora.
  if (cobranca?.status === 'pre_autorizada' && retemDinheiro) {
    cobranca = await ctx.pagamentos.capturar({
      subcontaId: exigirSubconta(ag),
      cobrancaId: cobranca.cobrancaId,
    })
  }

  const cobrada = cobranca !== null && COBRADA.has(cobranca.status)
  const g = cobranca?.taxaGateway ?? 0
  const liquidacao = liquidar({
    evento,
    plano: ag.plano,
    meio: ag.pagamento?.meio ?? 'pix',
    valorPago: cobranca ? ag.valorPagoCentavos : 0,
    retencaoPct: ag.retencaoPct,
    taxaGateway: cobrada ? g : 0,
    custoEstorno: evento === 'cancelado_pela_barbearia' && cobrada ? g : 0,
    escolhaPix: params.escolhaPix ?? 'credito',
    custoPix: ctx.config.custoEstornoPix,
  })

  if (cobranca) cobranca = await executarNoGateway(ctx, ag, cobranca, liquidacao)

  const registrado = await registrar(ctx, ag, evento, liquidacao, cobranca)
  if (registrado) await avisarCliente(ctx, ag, evento, liquidacao)
  return { resultado: registrado ? 'liquidado' : 'ja_liquidado', eventos: [], liquidacao }
}

async function jaLiquidado(ctx: Contexto, agendamentoId: string): Promise<boolean> {
  const [linha] = await ctx.sql`
    select 1 from public.lancamentos where agendamento_id = ${agendamentoId} and tipo = 'liquidacao'`
  return linha !== undefined
}

async function cobrancaAtual(ctx: Contexto, ag: AgendamentoCompleto): Promise<Cobranca | null> {
  const cobrancaId = ag.pagamento?.cobrancaId
  if (!cobrancaId) return null
  return ctx.pagamentos.consultarCobranca({ subcontaId: exigirSubconta(ag), cobrancaId })
}

async function executarNoGateway(
  ctx: Contexto,
  ag: AgendamentoCompleto,
  inicial: Cobranca,
  liquidacao: Liquidacao,
): Promise<Cobranca> {
  const subcontaId = exigirSubconta(ag)
  const cobrancaId = inicial.cobrancaId
  let cobranca = inicial

  // Pré-autorização nunca capturada (cancelado no prazo ou pela barbearia): só cancelar.
  if (cobranca.status === 'pre_autorizada') {
    return ctx.pagamentos.cancelarPreAutorizacao({ subcontaId, cobrancaId })
  }
  if (!COBRADA.has(cobranca.status)) return cobranca

  const falta = liquidacao.devolvidoAoCliente - cobranca.valorEstornado
  if (falta > 0) cobranca = await ctx.pagamentos.estornar({ subcontaId, cobrancaId, valor: falta })

  if (cobranca.status !== 'estornada' && !cobranca.retencaoLiberada) {
    cobranca = await ctx.pagamentos.liberarRetencao({ subcontaId, cobrancaId })
  }
  return cobranca
}

async function registrar(
  ctx: Contexto,
  ag: AgendamentoCompleto,
  evento: EventoFinal,
  l: Liquidacao,
  cobranca: Cobranca | null,
): Promise<boolean> {
  return ctx.sql.begin(async (tx) => {
    const inseridos = await tx`
      insert into public.lancamentos (barbearia_id, agendamento_id, tipo, evento_final, valor_pago_centavos,
        cliente_centavos, credito_cliente_centavos, barbearia_centavos, navalha_centavos,
        taxa_gateway_centavos, quem_paga_gateway)
      values (${ag.barbeariaId}, ${ag.id}, 'liquidacao', ${evento}, ${cobranca ? ag.valorPagoCentavos : 0},
        ${l.devolvidoAoCliente}, ${l.creditoAoCliente}, ${l.barbearia}, ${l.navalha},
        ${l.custoGateway}, ${l.quemPagaGateway})
      on conflict (agendamento_id) where tipo = 'liquidacao' do nothing
      returning id
    `
    if (inseridos.length === 0) return false

    if (l.navalha !== 0) {
      await tx`
        insert into public.taxas_a_transferir (barbearia_id, agendamento_id, valor_centavos)
        values (${ag.barbeariaId}, ${ag.id}, ${l.navalha})
        on conflict (agendamento_id) do nothing
      `
    }
    if (l.creditoAoCliente > 0) {
      await tx`
        insert into public.creditos_cliente (cliente_id, barbearia_id, valor_centavos, origem_agendamento_id)
        values (${ag.clienteId}, ${ag.barbeariaId}, ${l.creditoAoCliente}, ${ag.id})
        on conflict (origem_agendamento_id) do nothing
      `
    }
    if (ag.pagamento && cobranca) {
      await tx`
        update public.pagamentos
        set status = ${statusDoPagamento(cobranca.status)},
          taxa_gateway_centavos = ${cobranca.taxaGateway},
          valor_estornado_centavos = ${cobranca.valorEstornado},
          atualizado_em = now()
        where id = ${ag.pagamento.id}
      `
    }

    const [fidelidade] = await tx<
      { ativa: boolean; cortes_necessarios: number; servico_gratis_id: string | null }[]
    >`
      select ativa, cortes_necessarios, servico_gratis_id from public.fidelidade_config where barbearia_id = ${ag.barbeariaId}`
    if (fidelidade?.ativa) {
      const [atual] = await tx<{ cortes: number }[]>`
        select cortes from public.fidelidade_progresso
        where barbearia_id = ${ag.barbeariaId} and cliente_id = ${ag.clienteId} for update`
      const cortes = atualizarFidelidade(
        atual?.cortes ?? 0,
        {
          ativa: true,
          cortesNecessarios: fidelidade.cortes_necessarios,
          servicoGratisId: fidelidade.servico_gratis_id ?? '',
        },
        { evento, usouPremio: ag.usouPremioFidelidade },
      )
      await tx`
        insert into public.fidelidade_progresso (barbearia_id, cliente_id, cortes)
        values (${ag.barbeariaId}, ${ag.clienteId}, ${cortes})
        on conflict (barbearia_id, cliente_id) do update set cortes = excluded.cortes
      `
    }
    return true
  })
}

function statusDoPagamento(status: Cobranca['status']): Enum<'status_pagamento'> {
  const mapa: Record<Cobranca['status'], Enum<'status_pagamento'>> = {
    aguardando_pagamento: 'pix_aguardando',
    paga: 'pix_pago',
    cancelada: 'pix_aguardando',
    pre_autorizada: 'pre_autorizado',
    recusada: 'recusado',
    pre_autorizacao_cancelada: 'pre_autorizacao_cancelada',
    capturada: 'capturado',
    estornada_parcialmente: 'estornado_parcial',
    estornada: 'estornado',
  }
  return mapa[status]
}

async function avisarCliente(
  ctx: Contexto,
  ag: AgendamentoCompleto,
  evento: EventoFinal,
  l: Liquidacao,
): Promise<void> {
  if (!ag.clienteUsuarioId || evento === 'concluido') return
  const devolucao =
    l.creditoAoCliente > 0
      ? `${reais(l.creditoAoCliente)} ficaram de crédito na ${ag.barbeariaNome}.`
      : l.devolvidoAoCliente > 0
        ? `Devolvemos ${reais(l.devolvidoAoCliente)} para você.`
        : 'Não há valor a devolver, conforme a política de cancelamento.'
  const titulos: Record<Exclude<EventoFinal, 'concluido'>, string> = {
    cancelado_no_prazo: 'Agendamento cancelado',
    cancelado_fora_do_prazo: 'Agendamento cancelado fora do prazo',
    no_show: 'Você não compareceu',
    cancelado_pela_barbearia: `${ag.barbeariaNome} cancelou seu horário`,
  }
  await ctx.notificador.notificar({
    usuarioId: ag.clienteUsuarioId,
    titulo: titulos[evento],
    corpo: `${ag.codigo}: ${devolucao}`,
    tipo: 'estorno',
    dados: { agendamentoId: ag.id },
  })
}
