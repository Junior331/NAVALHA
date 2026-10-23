import { afterAll, describe, expect, it } from 'vitest'
import {
  abrirBanco,
  criarAgendamento,
  criarBarbearia,
  criarCliente,
  criarContexto,
} from '../../test/cenarios'
import { ErroDeNegocio } from '../erros'
import { liquidarAgendamento } from './liquidacao'

// Liquidação no evento final, contra o banco local e o gateway fake.
// regras-de-negocio §Cenários de liquidação; cartao-pre-autorizado §Cartão.
const sql = abrirBanco()
afterAll(() => sql.end())

const G_100 = 348 // cartão a preço cheio em R$ 100: 2,99% + R$ 0,49

async function consultar(
  pagamentos: ReturnType<typeof criarContexto>['pagamentos'],
  subcontaId: string,
  cobrancaId: string | null,
) {
  if (!cobrancaId) throw new Error('cenário sem cobrança')
  return pagamentos.consultarCobranca({ subcontaId, cobrancaId })
}

async function lancamento(agendamentoId: string) {
  const linhas = await sql<
    {
      evento_final: string
      cliente_centavos: number
      credito_cliente_centavos: number
      barbearia_centavos: number
      navalha_centavos: number
      taxa_gateway_centavos: number
      quem_paga_gateway: string
    }[]
  >`select * from public.lancamentos where agendamento_id = ${agendamentoId} and tipo = 'liquidacao'`
  return linhas
}

async function taxaATransferir(agendamentoId: string) {
  const [linha] = await sql<{ valor_centavos: number }[]>`
    select valor_centavos from public.taxas_a_transferir where agendamento_id = ${agendamentoId}`
  return linha?.valor_centavos ?? null
}

async function statusPagamento(agendamentoId: string) {
  const [linha] = await sql<{ status: string; valor_estornado_centavos: number }[]>`
    select status, valor_estornado_centavos from public.pagamentos where agendamento_id = ${agendamentoId}`
  return linha
}

describe('liquidarAgendamento', () => {
  it('concluído · Free · cartão: barbearia R$ 92 − G, Navalha R$ 8 a transferir, Escrow liberado', async () => {
    const { ctx, pagamentos } = criarContexto(sql)
    const b = await criarBarbearia(sql, pagamentos, { plano: 'free' })
    const c = await criarCliente(sql)
    const { agendamentoId, cobrancaId } = await criarAgendamento(sql, pagamentos, b, c, {
      meio: 'cartao',
      status: 'concluido',
    })

    const r = await liquidarAgendamento(ctx, { agendamentoId })

    expect(r.resultado).toBe('liquidado')
    expect(await lancamento(agendamentoId)).toEqual([
      expect.objectContaining({
        evento_final: 'concluido',
        barbearia_centavos: 9200 - G_100,
        navalha_centavos: 800,
        taxa_gateway_centavos: G_100,
        quem_paga_gateway: 'barbearia',
      }),
    ])
    expect(await taxaATransferir(agendamentoId)).toBe(800)
    const cobranca = await consultar(pagamentos, b.subcontaId, cobrancaId)
    expect(cobranca.retencaoLiberada).toBe(true)
  })

  it('concluído · Pro · Pix: barbearia fica com tudo, sem taxa Navalha', async () => {
    const { ctx, pagamentos } = criarContexto(sql)
    const b = await criarBarbearia(sql, pagamentos, { plano: 'pro' })
    const c = await criarCliente(sql)
    const { agendamentoId } = await criarAgendamento(sql, pagamentos, b, c, {
      meio: 'pix',
      status: 'concluido',
      plano: 'pro',
    })

    await liquidarAgendamento(ctx, { agendamentoId })

    expect(await lancamento(agendamentoId)).toEqual([
      expect.objectContaining({ barbearia_centavos: 10000, navalha_centavos: 0 }),
    ])
    expect(await taxaATransferir(agendamentoId)).toBeNull()
  })

  it('cliente cancela no prazo · cartão: cancela a pré-autorização e ninguém paga nada', async () => {
    const { ctx, pagamentos } = criarContexto(sql)
    const b = await criarBarbearia(sql, pagamentos)
    const c = await criarCliente(sql)
    const { agendamentoId, cobrancaId } = await criarAgendamento(sql, pagamentos, b, c, {
      meio: 'cartao',
      status: 'cancelado_no_prazo',
      etapaCartao: 'pre_autorizado',
    })

    await liquidarAgendamento(ctx, { agendamentoId })

    const cobranca = await consultar(pagamentos, b.subcontaId, cobrancaId)
    expect(cobranca.status).toBe('pre_autorizacao_cancelada')
    expect(await lancamento(agendamentoId)).toEqual([
      expect.objectContaining({
        cliente_centavos: 10000,
        barbearia_centavos: 0,
        navalha_centavos: 0,
      }),
    ])
    expect((await statusPagamento(agendamentoId))?.status).toBe('pre_autorizacao_cancelada')
  })

  it('cliente cancela no prazo · Pix · crédito: vira crédito de 100% na barbearia', async () => {
    const { ctx, pagamentos } = criarContexto(sql)
    const b = await criarBarbearia(sql, pagamentos)
    const c = await criarCliente(sql)
    const { agendamentoId } = await criarAgendamento(sql, pagamentos, b, c, {
      meio: 'pix',
      status: 'cancelado_no_prazo',
    })

    await liquidarAgendamento(ctx, { agendamentoId, escolhaPix: 'credito' })

    const [credito] = await sql<{ valor_centavos: number }[]>`
      select valor_centavos from public.creditos_cliente where origem_agendamento_id = ${agendamentoId}`
    expect(credito?.valor_centavos).toBe(10000)
    expect((await statusPagamento(agendamentoId))?.valor_estornado_centavos).toBe(0)
  })

  it('cliente cancela no prazo · Pix · reembolso: devolve o valor pelo gateway', async () => {
    const { ctx, pagamentos } = criarContexto(sql)
    const b = await criarBarbearia(sql, pagamentos)
    const c = await criarCliente(sql)
    const { agendamentoId, cobrancaId } = await criarAgendamento(sql, pagamentos, b, c, {
      meio: 'pix',
      status: 'cancelado_no_prazo',
    })

    await liquidarAgendamento(ctx, { agendamentoId, escolhaPix: 'reembolso' })

    const cobranca = await consultar(pagamentos, b.subcontaId, cobrancaId)
    expect(cobranca.valorEstornado).toBe(10000)
    expect((await statusPagamento(agendamentoId))?.status).toBe('estornado')
  })

  it('cancelamento fora do prazo · cartão · 50%: estorna R$ 50, barbearia R$ 40 limpo, Navalha R$ 10 − G', async () => {
    const { ctx, pagamentos } = criarContexto(sql)
    const b = await criarBarbearia(sql, pagamentos, { retencaoPct: 50 })
    const c = await criarCliente(sql)
    const { agendamentoId, cobrancaId } = await criarAgendamento(sql, pagamentos, b, c, {
      meio: 'cartao',
      status: 'cancelado_fora_do_prazo',
      retencaoPct: 50,
    })

    await liquidarAgendamento(ctx, { agendamentoId })

    const cobranca = await consultar(pagamentos, b.subcontaId, cobrancaId)
    expect(cobranca.valorEstornado).toBe(5000)
    expect(await lancamento(agendamentoId)).toEqual([
      expect.objectContaining({
        cliente_centavos: 5000,
        barbearia_centavos: 4000,
        navalha_centavos: 1000 - G_100,
      }),
    ])
    expect(await taxaATransferir(agendamentoId)).toBe(1000 - G_100)
    expect((await statusPagamento(agendamentoId))?.status).toBe('estornado_parcial')
  })

  it('no-show com cartão ainda não capturado: captura antes de reter', async () => {
    const { ctx, pagamentos } = criarContexto(sql)
    const b = await criarBarbearia(sql, pagamentos, { retencaoPct: 100 })
    const c = await criarCliente(sql)
    const { agendamentoId, cobrancaId } = await criarAgendamento(sql, pagamentos, b, c, {
      meio: 'cartao',
      status: 'no_show',
      etapaCartao: 'pre_autorizado',
      retencaoPct: 100,
    })

    await liquidarAgendamento(ctx, { agendamentoId })

    const cobranca = await consultar(pagamentos, b.subcontaId, cobrancaId)
    expect(cobranca.status).toBe('capturada')
    expect(cobranca.valorEstornado).toBe(0)
    expect(await lancamento(agendamentoId)).toEqual([
      expect.objectContaining({
        evento_final: 'no_show',
        barbearia_centavos: 8000,
        navalha_centavos: 2000 - G_100,
      }),
    ])
  })

  it('barbearia cancela · cartão capturado: estorno integral e a barbearia paga o custo (G)', async () => {
    const { ctx, pagamentos } = criarContexto(sql)
    const b = await criarBarbearia(sql, pagamentos)
    const c = await criarCliente(sql)
    const { agendamentoId, cobrancaId } = await criarAgendamento(sql, pagamentos, b, c, {
      meio: 'cartao',
      status: 'cancelado_pela_barbearia',
    })

    await liquidarAgendamento(ctx, { agendamentoId })

    const cobranca = await consultar(pagamentos, b.subcontaId, cobrancaId)
    expect(cobranca.valorEstornado).toBe(10000)
    expect(await lancamento(agendamentoId)).toEqual([
      expect.objectContaining({
        cliente_centavos: 10000,
        barbearia_centavos: -G_100,
        navalha_centavos: 0,
      }),
    ])
  })

  it('é idempotente: liquidar de novo não estorna nem lança duas vezes', async () => {
    const { ctx, pagamentos } = criarContexto(sql)
    const b = await criarBarbearia(sql, pagamentos)
    const c = await criarCliente(sql)
    const { agendamentoId, cobrancaId } = await criarAgendamento(sql, pagamentos, b, c, {
      meio: 'cartao',
      status: 'cancelado_fora_do_prazo',
    })

    await liquidarAgendamento(ctx, { agendamentoId })
    const segunda = await liquidarAgendamento(ctx, { agendamentoId })

    expect(segunda.resultado).toBe('ja_liquidado')
    expect(await lancamento(agendamentoId)).toHaveLength(1)
    const cobranca = await consultar(pagamentos, b.subcontaId, cobrancaId)
    expect(cobranca.valorEstornado).toBe(5000)
  })

  it('não liquida agendamento que ainda não terminou', async () => {
    const { ctx, pagamentos } = criarContexto(sql)
    const b = await criarBarbearia(sql, pagamentos)
    const c = await criarCliente(sql)
    const { agendamentoId } = await criarAgendamento(sql, pagamentos, b, c, {
      meio: 'cartao',
      status: 'confirmado',
    })

    await expect(liquidarAgendamento(ctx, { agendamentoId })).rejects.toBeInstanceOf(ErroDeNegocio)
  })

  it('conta um corte na fidelidade quando o atendimento é concluído', async () => {
    const { ctx, pagamentos } = criarContexto(sql)
    const b = await criarBarbearia(sql, pagamentos, { fidelidade: { cortes: 5 } })
    const c = await criarCliente(sql)
    const { agendamentoId } = await criarAgendamento(sql, pagamentos, b, c, {
      meio: 'pix',
      status: 'concluido',
    })

    await liquidarAgendamento(ctx, { agendamentoId })

    const [progresso] = await sql<{ cortes: number }[]>`
      select cortes from public.fidelidade_progresso where barbearia_id = ${b.barbeariaId} and cliente_id = ${c.clienteId}`
    expect(progresso?.cortes).toBe(1)
  })

  it('avisa o cliente quando a barbearia cancela, com o valor devolvido', async () => {
    const { ctx, pagamentos, notificador } = criarContexto(sql)
    const b = await criarBarbearia(sql, pagamentos)
    const c = await criarCliente(sql)
    const { agendamentoId } = await criarAgendamento(sql, pagamentos, b, c, {
      meio: 'cartao',
      status: 'cancelado_pela_barbearia',
    })

    await liquidarAgendamento(ctx, { agendamentoId })

    expect(notificador.avisos).toEqual([
      expect.objectContaining({
        usuarioId: c.usuarioId,
        tipo: 'estorno',
        corpo: expect.stringContaining('R$ 100,00'),
      }),
    ])
  })
})
