import { afterAll, describe, expect, it } from 'vitest'
import {
  abrirBanco,
  criarAgendamento,
  criarBarbeariaPronta,
  criarCliente,
  criarContexto,
} from '../../test/cenarios'
import { ErroDeNegocio } from '../erros'
import { aceitarConvite, criarConvite } from './cadastro'
import { agendamentosAfetados, pausarAgenda, removerBarbeiro } from './equipe'

// Admin 03c: pausar agenda e remover barbeiro, com os agendamentos afetados.
const sql = abrirBanco()
afterAll(() => sql.end())

const AGORA = new Date('2026-10-20T12:00:00Z')

async function equipeComBarbeiro() {
  const teste = criarContexto(sql, AGORA)
  const b = await criarBarbeariaPronta(sql, teste.pagamentos)
  const dono = { id: b.donoUsuarioId, anonimo: false }
  const { token } = await criarConvite(teste.ctx, dono, {
    barbeariaId: b.barbeariaId,
    nome: 'Rafael',
    servicoIds: [b.servicoId],
  })
  const novo = await criarCliente(sql)
  const barbeiro = { id: novo.usuarioId, anonimo: false }
  const { membroId } = await aceitarConvite(teste.ctx, barbeiro, { token })
  const cliente = await criarCliente(sql)
  const agendar = (inicio: string) =>
    criarAgendamento(sql, teste.pagamentos, { ...b, barbeiroId: membroId }, cliente, {
      meio: 'cartao',
      etapaCartao: 'pre_autorizado',
      inicio: new Date(inicio),
    })
  return { ...teste, b, dono, barbeiro, membroId, agendar }
}

async function erroDe(promessa: Promise<unknown>): Promise<ErroDeNegocio> {
  try {
    await promessa
  } catch (erro) {
    if (erro instanceof ErroDeNegocio) return erro
    throw erro
  }
  throw new Error('era esperado um ErroDeNegocio')
}

describe('pausarAgenda', () => {
  it('o próprio barbeiro pausa um período e vê quantos agendamentos já estavam marcados', async () => {
    const t = await equipeComBarbeiro()
    await t.agendar('2026-10-22T14:00:00Z')

    const r = await pausarAgenda(t.ctx, t.barbeiro, {
      membroId: t.membroId,
      inicio: '2026-10-22T12:00:00Z',
      fim: '2026-10-22T22:00:00Z',
      motivo: 'Consulta',
    })

    expect(r.afetados).toBe(1)
    const [bloqueio] = await sql<
      { motivo: string }[]
    >`select motivo from public.bloqueios where id = ${r.bloqueioId}`
    expect(bloqueio?.motivo).toBe('Consulta')
  })

  it('fim antes do início é recusado', async () => {
    const t = await equipeComBarbeiro()
    const erro = await erroDe(
      pausarAgenda(t.ctx, t.barbeiro, {
        membroId: t.membroId,
        inicio: '2026-10-22T22:00:00Z',
        fim: '2026-10-22T12:00:00Z',
      }),
    )
    expect(erro.codigo).toBe('dados_invalidos')
  })
})

describe('removerBarbeiro', () => {
  it('mostra os afetados, tira o barbeiro da equipe e cancela os futuros pela barbearia', async () => {
    const t = await equipeComBarbeiro()
    await t.agendar('2026-10-22T14:00:00Z')
    await t.agendar('2026-10-23T14:00:00Z')

    expect((await agendamentosAfetados(t.ctx, t.dono, { membroId: t.membroId })).quantidade).toBe(2)
    const r = await removerBarbeiro(t.ctx, t.dono, { membroId: t.membroId })

    expect(r.cancelados).toBe(2)
    expect(r.eventos.filter((e) => e.name === 'agendamento/finalizado')).toHaveLength(2)
    const [membro] = await sql<
      { ativo: boolean }[]
    >`select ativo from public.membros where id = ${t.membroId}`
    expect(membro?.ativo).toBe(false)
    const status = await sql<
      { status: string }[]
    >`select status from public.agendamentos where barbeiro_id = ${t.membroId}`
    expect(status.map((s) => s.status)).toEqual([
      'cancelado_pela_barbearia',
      'cancelado_pela_barbearia',
    ])
  })

  it('só o dono remove; o dono não pode ser removido', async () => {
    const t = await equipeComBarbeiro()
    expect(
      (await erroDe(removerBarbeiro(t.ctx, t.barbeiro, { membroId: t.membroId }))).codigo,
    ).toBe('sem_permissao')
    expect(
      (await erroDe(removerBarbeiro(t.ctx, t.dono, { membroId: t.b.barbeiroId }))).codigo,
    ).toBe('estado_invalido')
  })
})
