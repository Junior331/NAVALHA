import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import {
  abrirBanco,
  criarBarbearia,
  criarCliente,
  criarContexto,
  criarReservaPix,
  criarServico,
} from '../../test/cenarios'
import { processarWebhookDePagamento, registrarWebhook } from './webhook'

// Webhook do Asaas: guardado em webhook_eventos (idempotência pelo id do evento) e processado
// fora da request. regras-de-negocio §Ações do backend por evento.
const sql = abrirBanco()
afterAll(() => sql.end())

const pixRecebido = (cobrancaId: string, referencia: string) => ({
  id: `evt_${randomUUID()}`,
  event: 'PAYMENT_RECEIVED',
  payment: {
    id: cobrancaId,
    value: 100,
    netValue: 100,
    billingType: 'PIX',
    status: 'RECEIVED',
    externalReference: referencia,
  },
})

describe('registrarWebhook', () => {
  it('guarda o evento uma vez só', async () => {
    const corpo = pixRecebido('pay_x', 'ref')
    expect(await registrarWebhook(sql, corpo)).toBe('novo')
    expect(await registrarWebhook(sql, corpo)).toBe('repetido')
  })

  it('recusa corpo sem id ou sem tipo', async () => {
    expect(await registrarWebhook(sql, { event: 'PAYMENT_RECEIVED' })).toBe('invalido')
  })
})

describe('processarWebhookDePagamento', () => {
  it('Pix recebido confirma a reserva e marca o evento como processado', async () => {
    const { ctx, pagamentos } = criarContexto(sql)
    const b = await criarBarbearia(sql, pagamentos)
    const c = await criarCliente(sql)
    const servicoId = await criarServico(sql, b)
    const { reservaId, cobrancaId } = await criarReservaPix(sql, pagamentos, b, c, { servicoId })
    pagamentos.simularPixPago(cobrancaId)
    const corpo = pixRecebido(cobrancaId, reservaId)
    await registrarWebhook(sql, corpo)

    const r = await processarWebhookDePagamento(ctx, corpo.id)

    expect(r.resultado).toBe('confirmado')
    expect(r.eventos).toEqual([{ name: 'agendamento/criado', data: { agendamentoId: reservaId } }])
    const [evento] = await sql<{ processado_em: Date | null }[]>`
      select processado_em from public.webhook_eventos where id = ${corpo.id}`
    expect(evento?.processado_em).toBeInstanceOf(Date)
    expect((await processarWebhookDePagamento(ctx, corpo.id)).resultado).toBe('ja_processado')
  })

  it('evento que o Navalha não usa é marcado como processado e ignorado', async () => {
    const { ctx } = criarContexto(sql)
    const corpo = {
      id: `evt_${randomUUID()}`,
      event: 'PAYMENT_CREATED',
      payment: { id: 'pay_y', value: 10 },
    }
    await registrarWebhook(sql, corpo)

    expect((await processarWebhookDePagamento(ctx, corpo.id)).resultado).toBe('ignorado')
  })
})
