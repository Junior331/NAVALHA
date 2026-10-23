import { transicionar, type Plano } from '@navalha/core'
import type { Enum } from '@navalha/db'
import type { Contexto, Resultado } from '../contexto'
import { reais } from '../repositorio'

// Pix: o agendamento só existe depois de pago (regras-de-negocio §Outras regras). Enquanto o QR
// Code está aberto, o horário fica preso numa reserva temporária, cujo id vira o id do
// agendamento. A referência ":regularizacao" é o Pix de quem teve o cartão recusado.

export const SUFIXO_REGULARIZACAO = ':regularizacao'

export interface DadosReserva {
  cobrancaId: string
  servicos: { servicoId: string; nome: string; duracaoMin: number; precoCentavos: number }[]
  valorBrutoCentavos: number
  descontoCentavos: number
  valorPagoCentavos: number
  promocaoId: string | null
  usouPremioFidelidade: boolean
  plano: Plano
  retencaoPct: number
  prazoGratisAte: string
  toleranciaAte: string
  origem: Enum<'origem_agendamento'>
}

interface Reserva {
  id: string
  barbearia_id: string
  barbeiro_id: string
  cliente_id: string
  inicio: Date
  fim: Date
  expira_em: Date
  dados: DadosReserva
  subconta_id: string | null
  cliente_usuario_id: string | null
}

type ResultadoPix =
  'confirmado' | 'regularizado' | 'ja_processado' | 'estornado_sem_horario' | 'ignorado'

export async function confirmarPixPago(
  ctx: Contexto,
  params: { cobrancaId: string; referencia: string | null; taxaGateway: number },
): Promise<Resultado<ResultadoPix>> {
  const processado = await ctx.sql`
    select 1 from public.pagamentos where asaas_cobranca_id = ${params.cobrancaId}`
  if (processado.length > 0) return { resultado: 'ja_processado', eventos: [] }
  if (!params.referencia) return { resultado: 'ignorado', eventos: [] }

  if (params.referencia.endsWith(SUFIXO_REGULARIZACAO)) {
    return regularizar(ctx, params.referencia.slice(0, -SUFIXO_REGULARIZACAO.length), params)
  }

  const reserva = await buscarReserva(ctx, params.referencia)
  if (!reserva) return { resultado: 'ignorado', eventos: [] }

  try {
    await criarAgendamentoDaReserva(ctx, reserva, params)
  } catch (erro) {
    if ((erro as { code?: string }).code !== '23P01') throw erro
    return devolverSemHorario(ctx, reserva, params.cobrancaId)
  }

  if (reserva.cliente_usuario_id) {
    await ctx.notificador.notificar({
      usuarioId: reserva.cliente_usuario_id,
      titulo: 'Agendamento confirmado',
      corpo: `Pagamento de ${reais(reserva.dados.valorPagoCentavos)} via Pix recebido.`,
      tipo: 'confirmacao',
      dados: { agendamentoId: reserva.id },
    })
  }
  return {
    resultado: 'confirmado',
    eventos: [{ name: 'agendamento/criado', data: { agendamentoId: reserva.id } }],
  }
}

export async function expirarReserva(
  ctx: Contexto,
  reservaId: string,
): Promise<Resultado<'expirada' | 'ainda_valida' | 'ja_resolvida' | ResultadoPix>> {
  const reserva = await buscarReserva(ctx, reservaId)
  if (!reserva) return { resultado: 'ja_resolvida', eventos: [] }
  if (reserva.expira_em.getTime() > ctx.agora().getTime())
    return { resultado: 'ainda_valida', eventos: [] }

  if (reserva.subconta_id) {
    const cobranca = await ctx.pagamentos.consultarCobranca({
      subcontaId: reserva.subconta_id,
      cobrancaId: reserva.dados.cobrancaId,
    })
    // Pago no último segundo: o webhook pode estar a caminho, mas a confirmação não espera por ele.
    if (cobranca.status === 'paga') {
      return confirmarPixPago(ctx, {
        cobrancaId: cobranca.cobrancaId,
        referencia: reserva.id,
        taxaGateway: cobranca.taxaGateway,
      })
    }
    if (cobranca.status === 'aguardando_pagamento') {
      await ctx.pagamentos.cancelarCobranca({
        subcontaId: reserva.subconta_id,
        cobrancaId: cobranca.cobrancaId,
      })
    }
  }
  await ctx.sql`delete from public.reservas_horario where id = ${reserva.id}`
  return { resultado: 'expirada', eventos: [] }
}

async function buscarReserva(ctx: Contexto, reservaId: string): Promise<Reserva | null> {
  const [reserva] = await ctx.sql<Reserva[]>`
    select r.id, r.barbearia_id, r.barbeiro_id, r.cliente_id, r.inicio, r.fim, r.expira_em, r.dados,
      s.asaas_conta_id as subconta_id, c.usuario_id as cliente_usuario_id
    from public.reservas_horario r
    join public.clientes c on c.id = r.cliente_id
    left join public.subcontas_asaas s on s.barbearia_id = r.barbearia_id
    where r.id = ${reservaId}`
  return reserva ?? null
}

async function criarAgendamentoDaReserva(
  ctx: Contexto,
  reserva: Reserva,
  params: { cobrancaId: string; taxaGateway: number },
): Promise<void> {
  const d = reserva.dados
  await ctx.sql.begin(async (tx) => {
    const travada =
      await tx`select 1 from public.reservas_horario where id = ${reserva.id} for update`
    if (travada.length === 0) return

    await tx`
      insert into public.agendamentos (id, barbearia_id, cliente_id, barbeiro_id, inicio, fim, status,
        valor_bruto_centavos, desconto_centavos, valor_pago_centavos, promocao_id, usou_premio_fidelidade,
        prazo_gratis_ate, tolerancia_ate, retencao_pct, plano, origem)
      values (${reserva.id}, ${reserva.barbearia_id}, ${reserva.cliente_id}, ${reserva.barbeiro_id},
        ${reserva.inicio}, ${reserva.fim}, 'confirmado', ${d.valorBrutoCentavos}, ${d.descontoCentavos},
        ${d.valorPagoCentavos}, ${d.promocaoId}, ${d.usouPremioFidelidade}, ${new Date(d.prazoGratisAte)},
        ${new Date(d.toleranciaAte)}, ${d.retencaoPct}, ${d.plano}, ${d.origem})`
    for (const s of d.servicos) {
      await tx`
        insert into public.agendamento_servicos (agendamento_id, servico_id, nome, duracao_min, preco_centavos)
        values (${reserva.id}, ${s.servicoId}, ${s.nome}, ${s.duracaoMin}, ${s.precoCentavos})`
    }
    await tx`
      insert into public.pagamentos (agendamento_id, barbearia_id, meio, status, valor_centavos,
        taxa_gateway_centavos, asaas_cobranca_id)
      values (${reserva.id}, ${reserva.barbearia_id}, 'pix', 'pix_pago', ${d.valorPagoCentavos},
        ${params.taxaGateway}, ${params.cobrancaId})`
    if (d.promocaoId) {
      await tx`
        insert into public.cupom_usos (promocao_id, cliente_id, agendamento_id)
        values (${d.promocaoId}, ${reserva.cliente_id}, ${reserva.id})`
    }
    await tx`delete from public.reservas_horario where id = ${reserva.id}`
  })
}

async function devolverSemHorario(
  ctx: Contexto,
  reserva: Reserva,
  cobrancaId: string,
): Promise<Resultado<ResultadoPix>> {
  if (reserva.subconta_id) {
    await ctx.pagamentos.estornar({ subcontaId: reserva.subconta_id, cobrancaId })
  }
  await ctx.sql`delete from public.reservas_horario where id = ${reserva.id}`
  if (reserva.cliente_usuario_id) {
    await ctx.notificador.notificar({
      usuarioId: reserva.cliente_usuario_id,
      titulo: 'O horário foi ocupado',
      corpo: `Outra pessoa confirmou esse horário antes. Devolvemos ${reais(reserva.dados.valorPagoCentavos)} do seu Pix.`,
      tipo: 'estorno',
      dados: { reservaId: reserva.id },
    })
  }
  return { resultado: 'estornado_sem_horario', eventos: [] }
}

async function regularizar(
  ctx: Contexto,
  agendamentoId: string,
  params: { cobrancaId: string; taxaGateway: number },
): Promise<Resultado<ResultadoPix>> {
  const regularizado = await ctx.sql.begin(async (tx) => {
    const [ag] = await tx<{ status: string }[]>`
      select status from public.agendamentos where id = ${agendamentoId} for update`
    if (ag?.status !== 'reservado') return false
    await tx`
      update public.pagamentos
      set meio = 'pix', status = 'pix_pago', asaas_cobranca_id = ${params.cobrancaId},
        taxa_gateway_centavos = ${params.taxaGateway}, cartao_token = null, regularizar_ate = null,
        atualizado_em = now()
      where agendamento_id = ${agendamentoId}`
    await tx`
      update public.agendamentos set status = ${transicionar('reservado', 'pagamento_regularizado')}
      where id = ${agendamentoId}`
    return true
  })
  if (!regularizado) return { resultado: 'ignorado', eventos: [] }
  return {
    resultado: 'regularizado',
    eventos: [{ name: 'pagamento/regularizado', data: { agendamentoId } }],
  }
}
