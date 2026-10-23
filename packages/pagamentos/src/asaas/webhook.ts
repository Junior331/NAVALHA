import { timingSafeEqual } from 'node:crypto'
import type { Centavos } from '@navalha/core'
import { paraCentavos } from './valores'

// Webhooks do Asaas: o token configurado chega no header asaas-access-token, e o corpo traz o
// evento com a cobrança. regras-de-negocio §Ações do backend por evento.

export type TipoEventoPagamento =
  | 'pix_pago'
  | 'cartao_pre_autorizado'
  | 'cartao_capturado'
  | 'estorno_concluido'
  | 'cobranca_cancelada'
  | 'outro'

export interface EventoPagamento {
  /** Id do evento no Asaas, usado para idempotência (webhook_eventos). */
  id: string
  tipoOriginal: string
  tipo: TipoEventoPagamento
  cobrancaId: string
  /** externalReference: id da reserva ou do agendamento no Navalha. */
  referencia: string | null
  valor: Centavos
  taxaGateway: Centavos
}

const TIPOS: Record<string, TipoEventoPagamento> = {
  PAYMENT_RECEIVED: 'pix_pago',
  PAYMENT_AUTHORIZED: 'cartao_pre_autorizado',
  PAYMENT_CONFIRMED: 'cartao_capturado',
  PAYMENT_REFUNDED: 'estorno_concluido',
  PAYMENT_PARTIALLY_REFUNDED: 'estorno_concluido',
  PAYMENT_DELETED: 'cobranca_cancelada',
}

export function tokenDoWebhookValido(recebido: string | null, esperado: string): boolean {
  if (!esperado || !recebido) return false
  const a = Buffer.from(recebido)
  const b = Buffer.from(esperado)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function interpretarWebhookAsaas(corpo: unknown): EventoPagamento | null {
  if (!ehObjeto(corpo) || typeof corpo.id !== 'string' || typeof corpo.event !== 'string') {
    return null
  }
  const pagamento = corpo.payment
  if (
    !ehObjeto(pagamento) ||
    typeof pagamento.id !== 'string' ||
    typeof pagamento.value !== 'number'
  ) {
    return null
  }

  const tipo = TIPOS[corpo.event] ?? 'outro'
  const valor = paraCentavos(pagamento.value)
  const liquido = typeof pagamento.netValue === 'number' ? paraCentavos(pagamento.netValue) : valor
  const cobrado = tipo === 'pix_pago' || tipo === 'cartao_capturado'

  return {
    id: corpo.id,
    tipoOriginal: corpo.event,
    tipo,
    cobrancaId: pagamento.id,
    referencia:
      typeof pagamento.externalReference === 'string' ? pagamento.externalReference : null,
    valor,
    taxaGateway: cobrado ? Math.max(0, valor - liquido) : 0,
  }
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null
}
