import { afterAll, describe, expect, it } from 'vitest'
import { abrirBanco, criarBarbeariaPronta, criarCliente, criarContexto } from '../../test/cenarios'
import { ErroDeNegocio } from '../erros'
import { confirmarPixPago } from '../servicos/pix'
import { criarAgendamento } from './agendar'
import { paginaDaBarbearia, situacaoDoAgendamento } from './vitrine'

// Página pública (navalha.app/<slug>) e situação do agendamento para o cliente (Cliente 11 e 12).
const sql = abrirBanco()
afterAll(() => sql.end())

const AGORA = new Date('2026-10-20T12:00:00Z')

async function erroDe(promessa: Promise<unknown>): Promise<ErroDeNegocio> {
  try {
    await promessa
  } catch (erro) {
    if (erro instanceof ErroDeNegocio) return erro
    throw erro
  }
  throw new Error('era esperado um ErroDeNegocio')
}

describe('paginaDaBarbearia', () => {
  it('traz serviços com quem faz cada um, a política e se aceita agendamentos', async () => {
    const t = criarContexto(sql, AGORA)
    const b = await criarBarbeariaPronta(sql, t.pagamentos, { retencaoPct: 30 })
    const [linha] = await sql<{ slug: string }[]>`
      select slug from public.barbearias where id = ${b.barbeariaId}`

    const pagina = await paginaDaBarbearia(t.ctx, linha?.slug ?? '')

    expect(pagina).toMatchObject({
      id: b.barbeariaId,
      aceitaAgendamentos: true,
      politica: { prazoGratisHoras: 2, retencaoPct: 30, toleranciaMin: 15 },
      servicos: [
        { id: b.servicoId, nome: 'Corte', precoCentavos: 10000, barbeiroIds: [b.barbeiroId] },
      ],
      barbeiros: [{ id: b.barbeiroId, avaliacoes: 0, nota: null }],
    })
    expect(pagina?.horarios).toHaveLength(7)
    expect(await paginaDaBarbearia(t.ctx, 'nao-existe-mesmo')).toBeNull()
  })

  it('sem recebimentos ativos, a página abre mas não aceita agendamentos', async () => {
    const t = criarContexto(sql, AGORA)
    const b = await criarBarbeariaPronta(sql, t.pagamentos, { recebimentosAtivos: false })
    const [linha] = await sql<{ slug: string }[]>`
      select slug from public.barbearias where id = ${b.barbeariaId}`
    expect((await paginaDaBarbearia(t.ctx, linha?.slug ?? ''))?.aceitaAgendamentos).toBe(false)
  })
})

describe('situacaoDoAgendamento', () => {
  it('Pix: reserva enquanto não paga, agendamento confirmado depois, e só para quem agendou', async () => {
    const t = criarContexto(sql, AGORA)
    const b = await criarBarbeariaPronta(sql, t.pagamentos)
    const c = await criarCliente(sql)
    const cliente = { id: c.usuarioId, anonimo: true }
    const r = await criarAgendamento(t.ctx, cliente, {
      barbeariaId: b.barbeariaId,
      servicoIds: [b.servicoId],
      barbeiroId: 'qualquer',
      inicio: '2026-10-21T17:00:00.000Z',
      meio: 'pix',
      ipRemoto: '127.0.0.1',
      origem: 'web',
    })
    if (r.saida.tipo !== 'pix') throw new Error('era esperado Pix')
    const id = r.saida.reservaId

    expect(await situacaoDoAgendamento(t.ctx, cliente, id)).toEqual({
      tipo: 'reserva',
      reservadoAte: r.saida.reservadoAte,
    })

    const [reserva] = await sql<{ cobranca: string }[]>`
      select dados->>'cobrancaId' as cobranca from public.reservas_horario where id = ${id}`
    t.pagamentos.simularPixPago(reserva?.cobranca ?? '')
    await confirmarPixPago(t.ctx, {
      cobrancaId: reserva?.cobranca ?? '',
      referencia: id,
      taxaGateway: 0,
    })

    expect(await situacaoDoAgendamento(t.ctx, cliente, id)).toMatchObject({
      tipo: 'agendamento',
      status: 'confirmado',
      meio: 'pix',
      barbeiro: 'Barbeiro',
      servicos: ['Corte'],
      valorPagoCentavos: 10000,
    })

    const outro = await criarCliente(sql)
    const erro = await erroDe(
      situacaoDoAgendamento(t.ctx, { id: outro.usuarioId, anonimo: true }, id),
    )
    expect(erro.codigo).toBe('nao_encontrado')
  })

  it('reserva de Pix vencida aparece como expirada', async () => {
    const t = criarContexto(sql, AGORA)
    const b = await criarBarbeariaPronta(sql, t.pagamentos)
    const c = await criarCliente(sql)
    const cliente = { id: c.usuarioId, anonimo: true }
    const r = await criarAgendamento(t.ctx, cliente, {
      barbeariaId: b.barbeariaId,
      servicoIds: [b.servicoId],
      barbeiroId: 'qualquer',
      inicio: '2026-10-21T17:00:00.000Z',
      meio: 'pix',
      ipRemoto: '127.0.0.1',
      origem: 'web',
    })
    if (r.saida.tipo !== 'pix') throw new Error('era esperado Pix')
    t.definirAgora(new Date('2026-10-20T12:30:00Z'))

    expect(await situacaoDoAgendamento(t.ctx, cliente, r.saida.reservaId)).toEqual({
      tipo: 'expirado',
    })
  })
})
