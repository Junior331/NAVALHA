import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import {
  abrirBanco,
  criarAgendamento,
  criarBarbearia,
  criarCliente,
  criarContexto,
  type BarbeariaDeTeste,
} from '../../test/cenarios'
import { fecharLoteDaSemana } from './lote-semanal'

// Taxa da Navalha transferida em lote semanal, por Pix, da subconta para a chave da Navalha
// (cartao-pre-autorizado §Transferência; ajustes-taxas §Transferência).
const sql = abrirBanco()
afterAll(() => sql.end())

async function taxa(
  ctx: ReturnType<typeof criarContexto>,
  b: BarbeariaDeTeste,
  valor: number,
): Promise<void> {
  const c = await criarCliente(sql)
  const { agendamentoId } = await criarAgendamento(sql, ctx.pagamentos, b, c, {
    meio: 'nenhum',
    status: 'concluido',
    inicio: new Date(Date.UTC(2026, 9, 10, 12, Math.floor(Math.random() * 600))),
  })
  await sql`
    insert into public.taxas_a_transferir (barbearia_id, agendamento_id, valor_centavos)
    values (${b.barbeariaId}, ${agendamentoId}, ${valor})`
}

describe('fecharLoteDaSemana', () => {
  it('soma as taxas pendentes da barbearia e faz uma transferência só', async () => {
    const teste = criarContexto(sql)
    const b = await criarBarbearia(sql, teste.pagamentos)
    await taxa(teste, b, 800)
    await taxa(teste, b, 652)
    const semana = `2026-${String(1 + Math.floor(Math.random() * 12)).padStart(2, '0')}-0${1 + Math.floor(Math.random() * 7)}`

    const r = await fecharLoteDaSemana(teste.ctx, { semana, barbeariaIds: [b.barbeariaId] })

    expect(r.resultado).toBe('fechado')
    expect(teste.pagamentos.transferencias).toEqual([
      expect.objectContaining({
        subcontaId: b.subcontaId,
        chavePix: 'financeiro@navalha.app',
        valor: 1452,
      }),
    ])
    const [lote] = await sql<{ valor_centavos: number; status: string }[]>`
      select valor_centavos, status from public.lotes_semanais where barbearia_id = ${b.barbeariaId}`
    expect(lote).toEqual({ valor_centavos: 1452, status: 'concluida' })
    const pendentes = await sql`
      select 1 from public.taxas_a_transferir where barbearia_id = ${b.barbeariaId} and lote_id is null`
    expect(pendentes).toHaveLength(0)
  })

  it('rodar de novo na mesma semana não transfere de novo', async () => {
    const teste = criarContexto(sql)
    const b = await criarBarbearia(sql, teste.pagamentos)
    await taxa(teste, b, 800)
    const semana = '2026-10-19'

    await fecharLoteDaSemana(teste.ctx, { semana, barbeariaIds: [b.barbeariaId] })
    await fecharLoteDaSemana(teste.ctx, { semana, barbeariaIds: [b.barbeariaId] })

    expect(teste.pagamentos.transferencias).toHaveLength(1)
  })

  it('saldo zero ou negativo (G maior que a parte da Navalha) fica para a próxima semana', async () => {
    const teste = criarContexto(sql)
    const b = await criarBarbearia(sql, teste.pagamentos)
    await taxa(teste, b, 200)
    await taxa(teste, b, -348)

    const r = await fecharLoteDaSemana(teste.ctx, {
      semana: '2026-10-19',
      barbeariaIds: [b.barbeariaId],
    })

    expect(r.resultado).toBe('fechado')
    expect(teste.pagamentos.transferencias).toEqual([])
    const pendentes = await sql`
      select 1 from public.taxas_a_transferir where barbearia_id = ${b.barbeariaId} and lote_id is null`
    expect(pendentes).toHaveLength(2)
  })

  it('ignora barbearias de fora da lista pedida', async () => {
    const teste = criarContexto(sql)
    const b = await criarBarbearia(sql, teste.pagamentos)
    await taxa(teste, b, 800)

    await fecharLoteDaSemana(teste.ctx, { semana: '2026-10-19', barbeariaIds: [randomUUID()] })

    expect(teste.pagamentos.transferencias).toEqual([])
  })
})
