import { afterAll, describe, expect, it } from 'vitest'
import {
  abrirBanco,
  criarAgendamento,
  criarBarbearia,
  criarCliente,
  criarContexto,
  criarReservaPix,
  criarServico,
} from '../../test/cenarios'
import { confirmarPixPago, expirarReserva } from './pix'

// Pix: o agendamento só existe depois de pago (regras-de-negocio §Outras regras: "Pagou, está
// confirmado"). Enquanto o QR Code está aberto, o horário fica numa reserva temporária.
const sql = abrirBanco()
afterAll(() => sql.end())

async function agendamento(id: string) {
  const [linha] = await sql<{ status: string; codigo: string }[]>`
    select status, codigo from public.agendamentos where id = ${id}`
  return linha
}

async function reservaExiste(id: string) {
  const linhas = await sql`select 1 from public.reservas_horario where id = ${id}`
  return linhas.length > 0
}

describe('confirmarPixPago', () => {
  it('cria o agendamento Confirmado a partir da reserva e pede os jobs do agendamento', async () => {
    const { ctx, pagamentos } = criarContexto(sql)
    const b = await criarBarbearia(sql, pagamentos)
    const c = await criarCliente(sql)
    const servicoId = await criarServico(sql, b)
    const { reservaId, cobrancaId } = await criarReservaPix(sql, pagamentos, b, c, { servicoId })
    pagamentos.simularPixPago(cobrancaId)

    const r = await confirmarPixPago(ctx, { cobrancaId, referencia: reservaId, taxaGateway: 0 })

    expect(r.resultado).toBe('confirmado')
    expect(r.eventos).toEqual([{ name: 'agendamento/criado', data: { agendamentoId: reservaId } }])
    expect(await agendamento(reservaId)).toMatchObject({
      status: 'confirmado',
      codigo: expect.stringMatching(/^NV-/),
    })
    expect(await reservaExiste(reservaId)).toBe(false)
    const [servico] = await sql<{ preco_centavos: number }[]>`
      select preco_centavos from public.agendamento_servicos where agendamento_id = ${reservaId}`
    expect(servico?.preco_centavos).toBe(10000)
  })

  it('webhook repetido não cria outro agendamento', async () => {
    const { ctx, pagamentos } = criarContexto(sql)
    const b = await criarBarbearia(sql, pagamentos)
    const c = await criarCliente(sql)
    const servicoId = await criarServico(sql, b)
    const { reservaId, cobrancaId } = await criarReservaPix(sql, pagamentos, b, c, { servicoId })
    pagamentos.simularPixPago(cobrancaId)

    await confirmarPixPago(ctx, { cobrancaId, referencia: reservaId, taxaGateway: 0 })
    const segunda = await confirmarPixPago(ctx, {
      cobrancaId,
      referencia: reservaId,
      taxaGateway: 0,
    })

    expect(segunda.resultado).toBe('ja_processado')
    expect(segunda.eventos).toEqual([])
  })

  it('se o horário foi ocupado nesse meio-tempo, devolve o Pix inteiro', async () => {
    const { ctx, pagamentos, notificador } = criarContexto(sql)
    const b = await criarBarbearia(sql, pagamentos)
    const c = await criarCliente(sql)
    const servicoId = await criarServico(sql, b)
    const inicio = new Date('2026-10-23T13:00:00Z')
    await criarAgendamento(sql, pagamentos, b, c, { meio: 'nenhum', status: 'confirmado', inicio })
    const { reservaId, cobrancaId } = await criarReservaPix(sql, pagamentos, b, c, {
      servicoId,
      inicio,
    })
    pagamentos.simularPixPago(cobrancaId)

    const r = await confirmarPixPago(ctx, { cobrancaId, referencia: reservaId, taxaGateway: 0 })

    expect(r.resultado).toBe('estornado_sem_horario')
    const cobranca = await pagamentos.consultarCobranca({ subcontaId: b.subcontaId, cobrancaId })
    expect(cobranca.status).toBe('estornada')
    expect(notificador.avisos.at(-1)).toMatchObject({ tipo: 'estorno' })
  })

  it('regulariza o agendamento Reservado cujo cartão foi recusado', async () => {
    const { ctx, pagamentos } = criarContexto(sql)
    const b = await criarBarbearia(sql, pagamentos)
    const c = await criarCliente(sql)
    const { agendamentoId } = await criarAgendamento(sql, pagamentos, b, c, {
      meio: 'cartao',
      status: 'reservado',
      etapaCartao: 'tokenizado',
    })
    const { clienteId } = await pagamentos.garantirCliente({
      subcontaId: b.subcontaId,
      cliente: { referencia: c.clienteId, nome: 'Cliente' },
    })
    const pix = await pagamentos.criarCobrancaPix({
      subcontaId: b.subcontaId,
      clienteId,
      valor: 10000,
      expiraEm: new Date('2026-10-21T00:00:00Z'),
      referencia: `${agendamentoId}:regularizacao`,
    })
    pagamentos.simularPixPago(pix.cobrancaId)

    const r = await confirmarPixPago(ctx, {
      cobrancaId: pix.cobrancaId,
      referencia: `${agendamentoId}:regularizacao`,
      taxaGateway: 0,
    })

    expect(r.resultado).toBe('regularizado')
    expect(r.eventos).toEqual([{ name: 'pagamento/regularizado', data: { agendamentoId } }])
    expect((await agendamento(agendamentoId))?.status).toBe('confirmado')
    const [pagamento] = await sql<{ meio: string; status: string }[]>`
      select meio, status from public.pagamentos where agendamento_id = ${agendamentoId}`
    expect(pagamento).toEqual({ meio: 'pix', status: 'pix_pago' })
  })
})

describe('expirarReserva', () => {
  it('reserva vencida e não paga: cancela o Pix e solta o horário', async () => {
    const { ctx, pagamentos, definirAgora } = criarContexto(sql)
    const b = await criarBarbearia(sql, pagamentos)
    const c = await criarCliente(sql)
    const servicoId = await criarServico(sql, b)
    const { reservaId, cobrancaId } = await criarReservaPix(sql, pagamentos, b, c, {
      servicoId,
      expiraEm: new Date('2026-10-20T12:20:00Z'),
    })
    definirAgora(new Date('2026-10-20T12:21:00Z'))

    expect((await expirarReserva(ctx, reservaId)).resultado).toBe('expirada')
    expect(await reservaExiste(reservaId)).toBe(false)
    expect(
      (await pagamentos.consultarCobranca({ subcontaId: b.subcontaId, cobrancaId })).status,
    ).toBe('cancelada')
  })

  it('se o Pix foi pago no último segundo, confirma em vez de expirar', async () => {
    const { ctx, pagamentos, definirAgora } = criarContexto(sql)
    const b = await criarBarbearia(sql, pagamentos)
    const c = await criarCliente(sql)
    const servicoId = await criarServico(sql, b)
    const { reservaId, cobrancaId } = await criarReservaPix(sql, pagamentos, b, c, {
      servicoId,
      expiraEm: new Date('2026-10-20T12:20:00Z'),
    })
    pagamentos.simularPixPago(cobrancaId)
    definirAgora(new Date('2026-10-20T12:21:00Z'))

    const r = await expirarReserva(ctx, reservaId)

    expect(r.resultado).toBe('confirmado')
    expect((await agendamento(reservaId))?.status).toBe('confirmado')
  })

  it('não mexe em reserva que ainda está no prazo', async () => {
    const { ctx, pagamentos } = criarContexto(sql, new Date('2026-10-20T12:05:00Z'))
    const b = await criarBarbearia(sql, pagamentos)
    const c = await criarCliente(sql)
    const servicoId = await criarServico(sql, b)
    const { reservaId } = await criarReservaPix(sql, pagamentos, b, c, {
      servicoId,
      expiraEm: new Date('2026-10-20T12:20:00Z'),
    })

    expect((await expirarReserva(ctx, reservaId)).resultado).toBe('ainda_valida')
    expect(await reservaExiste(reservaId)).toBe(true)
  })
})
