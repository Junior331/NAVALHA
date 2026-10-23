import { afterAll, describe, expect, it } from 'vitest'
import {
  abrirBanco,
  criarAgendamento,
  criarBarbearia,
  criarCliente,
  criarContexto,
} from '../../test/cenarios'
import { enviarLembrete, marcarNoShowSeVencido } from './rotina'

// No-show automático ao fim da tolerância (regras-de-negocio §Política de cancelamento; decisão
// em aberto no roadmap: automático) e lembrete 1h antes (Figma Cliente 12).
const sql = abrirBanco()
afterAll(() => sql.end())

const inicio = new Date('2026-10-21T16:30:00Z')

describe('marcarNoShowSeVencido', () => {
  it('passou da tolerância sem o atendimento começar: marca no-show e pede a liquidação', async () => {
    const { ctx, pagamentos } = criarContexto(sql, new Date('2026-10-21T16:46:00Z'))
    const b = await criarBarbearia(sql, pagamentos)
    const c = await criarCliente(sql)
    const { agendamentoId } = await criarAgendamento(sql, pagamentos, b, c, {
      meio: 'cartao',
      inicio,
    })

    const r = await marcarNoShowSeVencido(ctx, agendamentoId)

    expect(r.resultado).toBe('no_show')
    expect(r.eventos).toEqual([{ name: 'agendamento/finalizado', data: { agendamentoId } }])
    const [linha] = await sql<
      { status: string }[]
    >`select status from public.agendamentos where id = ${agendamentoId}`
    expect(linha?.status).toBe('no_show')
  })

  it('ainda dentro da tolerância: não marca', async () => {
    const { ctx, pagamentos } = criarContexto(sql, new Date('2026-10-21T16:45:00Z'))
    const b = await criarBarbearia(sql, pagamentos)
    const c = await criarCliente(sql)
    const { agendamentoId } = await criarAgendamento(sql, pagamentos, b, c, {
      meio: 'cartao',
      inicio,
    })

    expect((await marcarNoShowSeVencido(ctx, agendamentoId)).resultado).toBe('ignorado')
  })

  it('atendimento já começou: não marca', async () => {
    const { ctx, pagamentos } = criarContexto(sql, new Date('2026-10-21T17:00:00Z'))
    const b = await criarBarbearia(sql, pagamentos)
    const c = await criarCliente(sql)
    const { agendamentoId } = await criarAgendamento(sql, pagamentos, b, c, {
      meio: 'cartao',
      inicio,
      status: 'em_atendimento',
    })

    expect((await marcarNoShowSeVencido(ctx, agendamentoId)).resultado).toBe('ignorado')
  })
})

describe('enviarLembrete', () => {
  it('avisa o cliente 1h antes de um agendamento confirmado', async () => {
    const { ctx, pagamentos, notificador } = criarContexto(sql)
    const b = await criarBarbearia(sql, pagamentos)
    const c = await criarCliente(sql)
    const { agendamentoId } = await criarAgendamento(sql, pagamentos, b, c, { meio: 'pix', inicio })

    expect((await enviarLembrete(ctx, agendamentoId)).resultado).toBe('enviado')
    expect(notificador.avisos).toEqual([
      expect.objectContaining({
        usuarioId: c.usuarioId,
        tipo: 'lembrete',
        corpo: expect.stringContaining('13:30'),
      }),
    ])
  })

  it('não lembra de agendamento cancelado', async () => {
    const { ctx, pagamentos, notificador } = criarContexto(sql)
    const b = await criarBarbearia(sql, pagamentos)
    const c = await criarCliente(sql)
    const { agendamentoId } = await criarAgendamento(sql, pagamentos, b, c, {
      meio: 'pix',
      inicio,
      status: 'cancelado_no_prazo',
    })

    expect((await enviarLembrete(ctx, agendamentoId)).resultado).toBe('ignorado')
    expect(notificador.avisos).toEqual([])
  })
})
