import { afterAll, describe, expect, it } from 'vitest'
import {
  abrirBanco,
  criarAgendamento,
  criarBarbearia,
  criarCliente,
  criarContexto,
} from '../../test/cenarios'
import { ErroDeNegocio } from '../erros'
import { avaliarAtendimento } from './avaliacao'
import { buscarBarbearias } from './vitrine'

const sql = abrirBanco()
afterAll(() => sql.end())

async function erroDe(promessa: Promise<unknown>): Promise<ErroDeNegocio> {
  try {
    await promessa
  } catch (erro) {
    if (erro instanceof ErroDeNegocio) return erro
    throw erro
  }
  throw new Error('era esperado um ErroDeNegocio')
}

describe('avaliarAtendimento (Cliente 16)', () => {
  it('quem foi atendido avalia uma vez; antes de concluir, não', async () => {
    const t = criarContexto(sql)
    const b = await criarBarbearia(sql, t.pagamentos)
    const c = await criarCliente(sql)
    const cliente = { id: c.usuarioId, anonimo: false }
    const concluido = await criarAgendamento(sql, t.pagamentos, b, c, {
      meio: 'pix',
      status: 'concluido',
      inicio: new Date('2026-10-19T13:00:00Z'),
    })
    const futuro = await criarAgendamento(sql, t.pagamentos, b, c, {
      meio: 'pix',
      inicio: new Date('2026-10-21T13:00:00Z'),
    })

    await avaliarAtendimento(t.ctx, cliente, {
      agendamentoId: concluido.agendamentoId,
      nota: 5,
      comentario: '  Ótimo  ',
    })
    const [avaliacao] = await sql<{ nota: number; comentario: string }[]>`
      select nota, comentario from public.avaliacoes where agendamento_id = ${concluido.agendamentoId}`
    expect(avaliacao).toEqual({ nota: 5, comentario: 'Ótimo' })

    expect(
      (
        await erroDe(
          avaliarAtendimento(t.ctx, cliente, { agendamentoId: concluido.agendamentoId, nota: 4 }),
        )
      ).codigo,
    ).toBe('estado_invalido')
    expect(
      (
        await erroDe(
          avaliarAtendimento(t.ctx, cliente, { agendamentoId: futuro.agendamentoId, nota: 4 }),
        )
      ).codigo,
    ).toBe('estado_invalido')
    const outro = await criarCliente(sql)
    expect(
      (
        await erroDe(
          avaliarAtendimento(
            t.ctx,
            { id: outro.usuarioId, anonimo: false },
            {
              agendamentoId: concluido.agendamentoId,
              nota: 1,
            },
          ),
        )
      ).codigo,
    ).toBe('nao_encontrado')
  })
})

describe('buscarBarbearias (Cliente 04)', () => {
  it('acha pelo nome e esconde quem não quer aparecer nas buscas', async () => {
    const t = criarContexto(sql)
    const visivel = await criarBarbearia(sql, t.pagamentos, { nasBuscas: true })
    const oculta = await criarBarbearia(sql, t.pagamentos)
    const [linha] = await sql<{ nome: string }[]>`
      select nome from public.barbearias where id = ${visivel.barbeariaId}`
    const [escondida] = await sql<{ nome: string }[]>`
      select nome from public.barbearias where id = ${oculta.barbeariaId}`

    const achadas = await buscarBarbearias(t.ctx, linha?.nome ?? '')
    expect(achadas.map((b) => b.nome)).toEqual([linha?.nome])
    expect(await buscarBarbearias(t.ctx, escondida?.nome ?? '')).toEqual([])
  })
})
