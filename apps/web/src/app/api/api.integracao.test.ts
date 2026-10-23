import { randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Rotas da API chamadas como o Next chama: Request entra, Response sai. Banco local; o envio de
// eventos ao Inngest é simulado.
const enviados = vi.hoisted(() => [] as unknown[])
vi.mock('@navalha/servidor/inngest', async (original) => ({
  ...(await original<object>()),
  inngest: { send: async (eventos: unknown) => void enviados.push(eventos) },
}))

process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:55322/postgres'
process.env.ASAAS_WEBHOOK_TOKEN = 'token-do-webhook-de-teste'

const { POST: webhook } = await import('./webhooks/asaas/route')
const { POST: agendar } = await import('./agendamentos/route')
const { GET: disponibilidade } = await import('./barbearias/[id]/disponibilidade/route')

beforeEach(() => {
  enviados.length = 0
})

const chamarWebhook = (corpo: unknown, token = 'token-do-webhook-de-teste') =>
  webhook(
    new Request('http://localhost/api/webhooks/asaas', {
      method: 'POST',
      headers: { 'asaas-access-token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    }),
  )

describe('POST /api/webhooks/asaas', () => {
  const evento = () => ({
    id: `evt_${randomUUID()}`,
    event: 'PAYMENT_RECEIVED',
    payment: { id: 'pay_1', value: 70, netValue: 70, billingType: 'PIX', externalReference: 'r' },
  })

  it('token errado: 401 e nada é guardado', async () => {
    const resposta = await chamarWebhook(evento(), 'token-errado')
    expect(resposta.status).toBe(401)
    expect(enviados).toEqual([])
  })

  it('evento novo: 200 e vai para o Inngest; repetido: 200 sem processar de novo', async () => {
    const corpo = evento()

    expect((await chamarWebhook(corpo)).status).toBe(200)
    expect(enviados).toEqual([
      [{ name: 'pagamento/webhook-recebido', data: { eventoId: corpo.id } }],
    ])

    expect((await chamarWebhook(corpo)).status).toBe(200)
    expect(enviados).toHaveLength(1)
  })

  it('corpo sem id: 400', async () => {
    expect((await chamarWebhook({ event: 'PAYMENT_RECEIVED' })).status).toBe(400)
  })
})

describe('rotas protegidas', () => {
  it('agendar sem sessão: 401 com mensagem para o usuário', async () => {
    const resposta = await agendar(
      new Request('http://localhost/api/agendamentos', { method: 'POST', body: '{}' }),
    )
    expect(resposta.status).toBe(401)
    expect(await resposta.json()).toEqual({
      erro: { codigo: 'nao_autenticado', mensagem: 'Entre na sua conta para continuar' },
    })
  })
})

describe('GET /api/barbearias/[id]/disponibilidade', () => {
  it('sem data: 400', async () => {
    const resposta = await disponibilidade(
      new Request('http://localhost/api/barbearias/x/disponibilidade?servicos=a'),
      { params: Promise.resolve({ id: randomUUID() }) },
    )
    expect(resposta.status).toBe(400)
  })

  it('barbearia que não existe: 404', async () => {
    const resposta = await disponibilidade(
      new Request(
        `http://localhost/api/barbearias/x/disponibilidade?data=2026-10-21&servicos=${randomUUID()}`,
      ),
      { params: Promise.resolve({ id: randomUUID() }) },
    )
    expect(resposta.status).toBe(404)
  })
})
