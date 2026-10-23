import { FakePaymentProvider } from '@navalha/pagamentos'
import { afterAll, describe, expect, it } from 'vitest'
import {
  CARTAO_OK,
  abrirBanco,
  criarAgendamento,
  criarBarbearia,
  criarCliente,
  criarContexto,
} from '../../test/cenarios'
import {
  capturarAgendamento,
  liberarPorFaltaDeRegularizacao,
  preAutorizarAgendamento,
} from './cobranca-cartao'

// cartao-pre-autorizado §Cartão: pré-autorização na janela de 72h, 12h para regularizar,
// captura no fim do prazo grátis.
const sql = abrirBanco()
afterAll(() => sql.end())

const CARTAO_RECUSADO = { ...CARTAO_OK, numero: FakePaymentProvider.CARTAO_RECUSADO }

async function estado(agendamentoId: string) {
  const [linha] = await sql<
    {
      status: string
      status_pagamento: string
      asaas_cobranca_id: string | null
      regularizar_ate: Date | null
      taxa: number
    }[]
  >`
    select a.status, p.status as status_pagamento, p.asaas_cobranca_id, p.regularizar_ate,
      p.taxa_gateway_centavos as taxa
    from public.agendamentos a join public.pagamentos p on p.agendamento_id = a.id
    where a.id = ${agendamentoId}`
  return linha
}

describe('preAutorizarAgendamento', () => {
  it('aprovada: o agendamento Reservado vira Confirmado', async () => {
    const { ctx, pagamentos } = criarContexto(sql)
    const b = await criarBarbearia(sql, pagamentos)
    const c = await criarCliente(sql)
    const { agendamentoId } = await criarAgendamento(sql, pagamentos, b, c, {
      meio: 'cartao',
      status: 'reservado',
      etapaCartao: 'tokenizado',
    })

    const r = await preAutorizarAgendamento(ctx, agendamentoId)

    expect(r.resultado).toBe('aprovada')
    expect(await estado(agendamentoId)).toMatchObject({
      status: 'confirmado',
      status_pagamento: 'pre_autorizado',
      asaas_cobranca_id: expect.any(String),
    })
  })

  it('recusada: fica Reservado, com 12h para regularizar, e o cliente é avisado', async () => {
    const { ctx, pagamentos, notificador } = criarContexto(sql, new Date('2026-10-18T14:30:00Z'))
    const b = await criarBarbearia(sql, pagamentos)
    const c = await criarCliente(sql)
    const { agendamentoId } = await criarAgendamento(sql, pagamentos, b, c, {
      meio: 'cartao',
      status: 'reservado',
      etapaCartao: 'tokenizado',
      cartao: CARTAO_RECUSADO,
    })

    const r = await preAutorizarAgendamento(ctx, agendamentoId)

    expect(r.resultado).toBe('recusada')
    expect(await estado(agendamentoId)).toMatchObject({
      status: 'reservado',
      status_pagamento: 'recusado',
      regularizar_ate: new Date('2026-10-19T02:30:00Z'),
    })
    expect(notificador.avisos).toEqual([
      expect.objectContaining({ usuarioId: c.usuarioId, tipo: 'pagamento_recusado' }),
    ])
  })

  it('não faz nada se o agendamento já foi cancelado', async () => {
    const { ctx, pagamentos } = criarContexto(sql)
    const b = await criarBarbearia(sql, pagamentos)
    const c = await criarCliente(sql)
    const { agendamentoId } = await criarAgendamento(sql, pagamentos, b, c, {
      meio: 'cartao',
      status: 'cancelado_no_prazo',
      etapaCartao: 'tokenizado',
    })

    expect((await preAutorizarAgendamento(ctx, agendamentoId)).resultado).toBe('ignorado')
  })
})

describe('capturarAgendamento', () => {
  it('captura a pré-autorização no fim do prazo grátis e guarda G', async () => {
    const { ctx, pagamentos } = criarContexto(sql)
    const b = await criarBarbearia(sql, pagamentos)
    const c = await criarCliente(sql)
    const { agendamentoId } = await criarAgendamento(sql, pagamentos, b, c, {
      meio: 'cartao',
      status: 'confirmado',
      etapaCartao: 'pre_autorizado',
    })

    expect((await capturarAgendamento(ctx, agendamentoId)).resultado).toBe('capturado')
    expect(await estado(agendamentoId)).toMatchObject({ status_pagamento: 'capturado', taxa: 348 })
  })

  it('não captura agendamento cancelado', async () => {
    const { ctx, pagamentos } = criarContexto(sql)
    const b = await criarBarbearia(sql, pagamentos)
    const c = await criarCliente(sql)
    const { agendamentoId } = await criarAgendamento(sql, pagamentos, b, c, {
      meio: 'cartao',
      status: 'cancelado_no_prazo',
      etapaCartao: 'pre_autorizado',
    })

    expect((await capturarAgendamento(ctx, agendamentoId)).resultado).toBe('ignorado')
  })
})

describe('liberarPorFaltaDeRegularizacao', () => {
  it('sem regularização em 12h, o horário é liberado e ninguém paga nada', async () => {
    const { ctx, pagamentos, notificador } = criarContexto(sql)
    const b = await criarBarbearia(sql, pagamentos)
    const c = await criarCliente(sql)
    const { agendamentoId } = await criarAgendamento(sql, pagamentos, b, c, {
      meio: 'cartao',
      status: 'reservado',
      etapaCartao: 'tokenizado',
      cartao: CARTAO_RECUSADO,
    })
    await preAutorizarAgendamento(ctx, agendamentoId)

    const r = await liberarPorFaltaDeRegularizacao(ctx, agendamentoId)

    expect(r.resultado).toBe('liberado')
    expect((await estado(agendamentoId))?.status).toBe('liberado')
    expect(notificador.avisos.at(-1)).toMatchObject({ tipo: 'horario_liberado' })
  })

  it('não libera quem já regularizou', async () => {
    const { ctx, pagamentos } = criarContexto(sql)
    const b = await criarBarbearia(sql, pagamentos)
    const c = await criarCliente(sql)
    const { agendamentoId } = await criarAgendamento(sql, pagamentos, b, c, {
      meio: 'cartao',
      status: 'confirmado',
      etapaCartao: 'pre_autorizado',
    })

    expect((await liberarPorFaltaDeRegularizacao(ctx, agendamentoId)).resultado).toBe('ignorado')
  })
})
