import { limiteDeRegularizacao, transicionar } from '@navalha/core'
import type { Contexto, Resultado } from '../contexto'
import { ErroDeNegocio } from '../erros'
import { carregarAgendamento, clienteNoGateway, exigirSubconta, horaLocal } from '../repositorio'

// Cartão pré-autorizado (cartao-pre-autorizado §Cartão e §Fluxo do cartão): o job pré-autoriza na
// janela de 72h antes do fim do prazo grátis, dá 12h para regularizar se falhar e captura quando
// o prazo grátis acaba.

export async function preAutorizarAgendamento(
  ctx: Contexto,
  agendamentoId: string,
): Promise<Resultado<'aprovada' | 'recusada' | 'ignorado'>> {
  const ag = await carregarAgendamento(ctx.sql, agendamentoId)
  const pagamento = ag.pagamento
  if (
    ag.status !== 'reservado' ||
    pagamento?.meio !== 'cartao' ||
    pagamento.status !== 'tokenizado'
  ) {
    return { resultado: 'ignorado', eventos: [] }
  }
  if (!pagamento.cartaoToken)
    throw new ErroDeNegocio('estado_invalido', 'Pagamento sem cartão tokenizado')
  const subcontaId = exigirSubconta(ag)
  const clienteId = await clienteNoGateway(ctx.sql, ag.clienteId, ag.barbeariaId)
  if (!clienteId) throw new ErroDeNegocio('estado_invalido', 'Cliente sem cadastro no gateway')

  const cobranca = await ctx.pagamentos.preAutorizar({
    subcontaId,
    clienteId,
    token: pagamento.cartaoToken,
    valor: ag.valorPagoCentavos,
    referencia: ag.id,
    ipRemoto: pagamento.ipRemoto ?? '0.0.0.0',
  })

  if (cobranca.status === 'pre_autorizada') {
    await ctx.sql.begin(async (tx) => {
      await tx`
        update public.pagamentos
        set status = 'pre_autorizado', asaas_cobranca_id = ${cobranca.cobrancaId}, atualizado_em = now()
        where id = ${pagamento.id}`
      await tx`
        update public.agendamentos set status = ${transicionar('reservado', 'pre_autorizacao_aprovada')}
        where id = ${ag.id} and status = 'reservado'`
    })
    return { resultado: 'aprovada', eventos: [] }
  }

  const limite = limiteDeRegularizacao(ctx.agora())
  await ctx.sql`
    update public.pagamentos
    set status = 'recusado', falhou_em = ${ctx.agora()}, regularizar_ate = ${limite},
      motivo_recusa = ${cobranca.motivoRecusa ?? null}, atualizado_em = now()
    where id = ${pagamento.id}`
  if (ag.clienteUsuarioId) {
    await ctx.notificador.notificar({
      usuarioId: ag.clienteUsuarioId,
      titulo: 'Não conseguimos validar seu cartão',
      corpo: `Troque o cartão ou pague com Pix até as ${horaLocal(limite)} para manter seu horário na ${ag.barbeariaNome}.`,
      tipo: 'pagamento_recusado',
      dados: { agendamentoId: ag.id },
    })
  }
  return { resultado: 'recusada', eventos: [] }
}

export async function capturarAgendamento(
  ctx: Contexto,
  agendamentoId: string,
): Promise<Resultado<'capturado' | 'ignorado'>> {
  const ag = await carregarAgendamento(ctx.sql, agendamentoId)
  const pagamento = ag.pagamento
  const ativo = ag.status === 'confirmado' || ag.status === 'em_atendimento'
  if (!ativo || pagamento?.status !== 'pre_autorizado' || !pagamento.cobrancaId) {
    return { resultado: 'ignorado', eventos: [] }
  }
  const cobranca = await ctx.pagamentos.capturar({
    subcontaId: exigirSubconta(ag),
    cobrancaId: pagamento.cobrancaId,
  })
  await ctx.sql`
    update public.pagamentos
    set status = 'capturado', taxa_gateway_centavos = ${cobranca.taxaGateway}, atualizado_em = now()
    where id = ${pagamento.id}`
  return { resultado: 'capturado', eventos: [] }
}

export async function liberarPorFaltaDeRegularizacao(
  ctx: Contexto,
  agendamentoId: string,
): Promise<Resultado<'liberado' | 'ignorado'>> {
  const ag = await carregarAgendamento(ctx.sql, agendamentoId)
  if (ag.status !== 'reservado') return { resultado: 'ignorado', eventos: [] }

  const alterados = await ctx.sql`
    update public.agendamentos set status = ${transicionar('reservado', 'regularizacao_expirada')}
    where id = ${ag.id} and status = 'reservado'
    returning id`
  if (alterados.length === 0) return { resultado: 'ignorado', eventos: [] }

  if (ag.clienteUsuarioId) {
    await ctx.notificador.notificar({
      usuarioId: ag.clienteUsuarioId,
      titulo: 'Horário liberado',
      corpo: `Como o pagamento não foi regularizado, liberamos o horário na ${ag.barbeariaNome}. Nada foi cobrado.`,
      tipo: 'horario_liberado',
      dados: { agendamentoId: ag.id },
    })
  }
  return { resultado: 'liberado', eventos: [] }
}
