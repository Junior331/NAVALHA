import { describe, expect, it } from 'vitest'
import { interpretarWebhookAsaas, tokenDoWebhookValido } from './webhook'

// regras-de-negocio §Ações do backend por evento: PAYMENT_RECEIVED (Pix), PAYMENT_CONFIRMED
// (cartão) e PAYMENT_REFUNDED (estorno concluído). O token vem no header asaas-access-token.

const evento = (event: string, payment: Record<string, unknown> = {}) => ({
  id: 'evt_05b708f961d739ea7eba7e4db318f621&368604920',
  event,
  dateCreated: '2026-10-23 16:45:03',
  payment: {
    object: 'payment',
    id: 'pay_080225913252',
    value: 70,
    netValue: 66.42,
    billingType: 'CREDIT_CARD',
    status: 'CONFIRMED',
    externalReference: 'a9e0000e-0000-0000-0000-000000000001',
    ...payment,
  },
})

describe('tokenDoWebhookValido', () => {
  it('aceita só o token configurado', () => {
    expect(tokenDoWebhookValido('segredo-do-webhook', 'segredo-do-webhook')).toBe(true)
    expect(tokenDoWebhookValido('segredo-do-webhooK', 'segredo-do-webhook')).toBe(false)
    expect(tokenDoWebhookValido('curto', 'segredo-do-webhook')).toBe(false)
    expect(tokenDoWebhookValido(null, 'segredo-do-webhook')).toBe(false)
  })

  it('nunca aceita quando o token esperado está vazio (configuração faltando)', () => {
    expect(tokenDoWebhookValido('', '')).toBe(false)
  })
})

describe('interpretarWebhookAsaas', () => {
  it('Pix recebido', () => {
    expect(
      interpretarWebhookAsaas(
        evento('PAYMENT_RECEIVED', { billingType: 'PIX', status: 'RECEIVED', netValue: 70 }),
      ),
    ).toEqual({
      id: 'evt_05b708f961d739ea7eba7e4db318f621&368604920',
      tipoOriginal: 'PAYMENT_RECEIVED',
      tipo: 'pix_pago',
      cobrancaId: 'pay_080225913252',
      referencia: 'a9e0000e-0000-0000-0000-000000000001',
      valor: 7000,
      taxaGateway: 0,
    })
  })

  it('cartão capturado traz G como valor − valor líquido', () => {
    expect(interpretarWebhookAsaas(evento('PAYMENT_CONFIRMED'))).toMatchObject({
      tipo: 'cartao_capturado',
      valor: 7000,
      taxaGateway: 358,
    })
  })

  it('pré-autorização aprovada', () => {
    expect(
      interpretarWebhookAsaas(evento('PAYMENT_AUTHORIZED', { status: 'AUTHORIZED' })),
    ).toMatchObject({
      tipo: 'cartao_pre_autorizado',
      taxaGateway: 0,
    })
  })

  it.each(['PAYMENT_REFUNDED', 'PAYMENT_PARTIALLY_REFUNDED'])('%s confirma o estorno', (tipo) => {
    expect(interpretarWebhookAsaas(evento(tipo))).toMatchObject({ tipo: 'estorno_concluido' })
  })

  it('cobrança removida (Pix expirado)', () => {
    expect(interpretarWebhookAsaas(evento('PAYMENT_DELETED'))).toMatchObject({
      tipo: 'cobranca_cancelada',
    })
  })

  it('evento que o Navalha não usa vem como "outro", sem erro', () => {
    expect(interpretarWebhookAsaas(evento('PAYMENT_CREATED'))).toMatchObject({ tipo: 'outro' })
  })

  it('corpo malformado devolve null', () => {
    expect(interpretarWebhookAsaas(null)).toBeNull()
    expect(interpretarWebhookAsaas({ event: 'PAYMENT_RECEIVED' })).toBeNull()
    expect(
      interpretarWebhookAsaas({ id: 'evt_1', event: 'PAYMENT_RECEIVED', payment: { id: 3 } }),
    ).toBeNull()
  })
})
