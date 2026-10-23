import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { liquidar, type EntradaLiquidacao } from './liquidacao'

// Referências: regras-de-negocio §Cenários de liquidação, §Política de cancelamento e §Decisões.
// Exemplo dos docs: serviço de R$ 100 e retenção de 50%. G = taxa do gateway.
const R100 = 10000
const G = 348 // cartão a preço cheio: 2,99% + R$ 0,49 (ajustes-taxas §G com preço cheio)

const base = (parcial: Partial<EntradaLiquidacao>): EntradaLiquidacao => ({
  evento: 'concluido',
  plano: 'free',
  meio: 'cartao',
  valorPago: R100,
  retencaoPct: 50,
  taxaGateway: G,
  ...parcial,
})

describe('concluído', () => {
  it('Free: barbearia R$ 92 − G, Navalha R$ 8, G pago pela barbearia', () => {
    expect(liquidar(base({ evento: 'concluido', plano: 'free' }))).toEqual({
      devolvidoAoCliente: 0,
      creditoAoCliente: 0,
      barbearia: 9200 - G,
      navalha: 800,
      custoGateway: G,
      quemPagaGateway: 'barbearia',
    })
  })

  it.each(['basic', 'pro'] as const)('%s: barbearia R$ 100 − G, Navalha R$ 0', (plano) => {
    expect(liquidar(base({ evento: 'concluido', plano }))).toEqual({
      devolvidoAoCliente: 0,
      creditoAoCliente: 0,
      barbearia: R100 - G,
      navalha: 0,
      custoGateway: G,
      quemPagaGateway: 'barbearia',
    })
  })

  it('Free com cupom: os 8% são calculados sobre o valor pago, já com desconto', () => {
    const r = liquidar(base({ evento: 'concluido', plano: 'free', valorPago: 9000 }))
    expect(r.navalha).toBe(720)
    expect(r.barbearia).toBe(9000 - 720 - G)
  })

  it('serviço grátis da fidelidade: sem taxa Navalha e sem repasse', () => {
    expect(
      liquidar(base({ evento: 'concluido', plano: 'free', valorPago: 0, taxaGateway: 0 })),
    ).toEqual({
      devolvidoAoCliente: 0,
      creditoAoCliente: 0,
      barbearia: 0,
      navalha: 0,
      custoGateway: 0,
      quemPagaGateway: 'ninguem',
    })
  })
})

describe('cliente cancela no prazo', () => {
  it('cartão: nada foi capturado, cliente fica com 100% e ninguém paga G', () => {
    expect(liquidar(base({ evento: 'cancelado_no_prazo', meio: 'cartao' }))).toEqual({
      devolvidoAoCliente: R100,
      creditoAoCliente: 0,
      barbearia: 0,
      navalha: 0,
      custoGateway: 0,
      quemPagaGateway: 'ninguem',
    })
  })

  it('Pix com crédito: crédito de 100% na barbearia, ninguém paga nada', () => {
    expect(
      liquidar(base({ evento: 'cancelado_no_prazo', meio: 'pix', escolhaPix: 'credito' })),
    ).toEqual({
      devolvidoAoCliente: 0,
      creditoAoCliente: R100,
      barbearia: 0,
      navalha: 0,
      custoGateway: 0,
      quemPagaGateway: 'ninguem',
    })
  })

  it('Pix com reembolso: devolve descontando o custo do Pix, pago pelo cliente', () => {
    expect(
      liquidar(
        base({ evento: 'cancelado_no_prazo', meio: 'pix', escolhaPix: 'reembolso', custoPix: 99 }),
      ),
    ).toEqual({
      devolvidoAoCliente: R100 - 99,
      creditoAoCliente: 0,
      barbearia: 0,
      navalha: 0,
      custoGateway: 99,
      quemPagaGateway: 'cliente',
    })
  })

  it('Pix exige a escolha entre crédito e reembolso', () => {
    expect(() => liquidar(base({ evento: 'cancelado_no_prazo', meio: 'pix' }))).toThrow(/escolha/i)
  })
})

describe('cancelamento fora do prazo e no-show', () => {
  it.each(['cancelado_fora_do_prazo', 'no_show'] as const)(
    '%s com 50%%: cliente R$ 50, barbearia R$ 40 limpo, Navalha R$ 10 − G',
    (evento) => {
      expect(liquidar(base({ evento, retencaoPct: 50 }))).toEqual({
        devolvidoAoCliente: 5000,
        creditoAoCliente: 0,
        barbearia: 4000,
        navalha: 1000 - G,
        custoGateway: G,
        quemPagaGateway: 'navalha',
      })
    },
  )

  // Tabela de regras-de-negocio §Política de cancelamento (sem G, que sai da parte da Navalha).
  it.each([
    [100, 0, 8000, 2000],
    [80, 2000, 6400, 1600],
    [50, 5000, 4000, 1000],
    [30, 7000, 2400, 600],
    [0, 10000, 0, 0],
  ])('retenção de %i%%: cliente %i, barbearia %i, Navalha %i', (pct, cliente, barb, nav) => {
    const r = liquidar(base({ evento: 'no_show', retencaoPct: pct, taxaGateway: 0 }))
    expect(r.devolvidoAoCliente).toBe(cliente)
    expect(r.barbearia).toBe(barb)
    expect(r.navalha).toBe(nav)
  })

  it('a taxa de 8% do Free não se aplica: Free e Pro dão o mesmo resultado', () => {
    for (const evento of ['cancelado_fora_do_prazo', 'no_show'] as const) {
      expect(liquidar(base({ evento, plano: 'free' }))).toEqual(
        liquidar(base({ evento, plano: 'pro' })),
      )
    }
  })

  it('a barbearia nunca vê G: a parte dela não muda com G', () => {
    const semG = liquidar(base({ evento: 'no_show', taxaGateway: 0 }))
    const comG = liquidar(base({ evento: 'no_show', taxaGateway: 999 }))
    expect(comG.barbearia).toBe(semG.barbearia)
  })

  it('com cupom: a retenção é calculada sobre o valor pago, já com desconto', () => {
    const r = liquidar(
      base({ evento: 'no_show', valorPago: 8000, retencaoPct: 50, taxaGateway: 0 }),
    )
    expect(r.devolvidoAoCliente).toBe(4000)
    expect(r.barbearia).toBe(3200)
    expect(r.navalha).toBe(800)
  })
})

describe('barbearia cancela', () => {
  it('cliente recebe 100% e a barbearia paga o custo do estorno, sem multa', () => {
    expect(liquidar(base({ evento: 'cancelado_pela_barbearia', custoEstorno: 150 }))).toEqual({
      devolvidoAoCliente: R100,
      creditoAoCliente: 0,
      barbearia: -150,
      navalha: 0,
      custoGateway: 150,
      quemPagaGateway: 'barbearia',
    })
  })
})

describe('validação', () => {
  it('rejeita retenção fora de 0 a 100 ou fracionária', () => {
    expect(() => liquidar(base({ retencaoPct: 101 }))).toThrow(RangeError)
    expect(() => liquidar(base({ retencaoPct: -1 }))).toThrow(RangeError)
    expect(() => liquidar(base({ retencaoPct: 12.5 }))).toThrow(RangeError)
  })

  it('rejeita valor pago inválido', () => {
    expect(() => liquidar(base({ valorPago: -1 }))).toThrow(RangeError)
  })

  it('rejeita custo do Pix maior que o valor pago', () => {
    expect(() =>
      liquidar(
        base({
          evento: 'cancelado_no_prazo',
          meio: 'pix',
          escolhaPix: 'reembolso',
          valorPago: 50,
          custoPix: 99,
        }),
      ),
    ).toThrow(RangeError)
  })
})

describe('propriedades', () => {
  const entrada: fc.Arbitrary<EntradaLiquidacao> = fc
    .record({
      evento: fc.constantFrom(
        'concluido',
        'cancelado_no_prazo',
        'cancelado_fora_do_prazo',
        'no_show',
        'cancelado_pela_barbearia',
      ),
      plano: fc.constantFrom('free', 'basic', 'pro'),
      meio: fc.constantFrom('pix', 'cartao'),
      valorPago: fc.integer({ min: 0, max: 1_000_000 }),
      retencaoPct: fc.integer({ min: 0, max: 100 }),
      taxaGateway: fc.integer({ min: 0, max: 5_000 }),
      custoEstorno: fc.integer({ min: 0, max: 1_000 }),
      escolhaPix: fc.constantFrom('credito', 'reembolso'),
      custoPix: fc.integer({ min: 0, max: 500 }),
    })
    .map((e) => ({ ...e, custoPix: Math.min(e.custoPix, e.valorPago) }))

  it('as partes sempre somam o valor pago', () => {
    fc.assert(
      fc.property(entrada, (e) => {
        const r = liquidar(e)
        const soma =
          r.devolvidoAoCliente + r.creditoAoCliente + r.barbearia + r.navalha + r.custoGateway
        expect(soma).toBe(e.valorPago)
      }),
    )
  })

  it('o cliente nunca recebe valor negativo nem mais do que pagou', () => {
    fc.assert(
      fc.property(entrada, (e) => {
        const r = liquidar(e)
        expect(r.devolvidoAoCliente).toBeGreaterThanOrEqual(0)
        expect(r.creditoAoCliente).toBeGreaterThanOrEqual(0)
        expect(r.devolvidoAoCliente + r.creditoAoCliente).toBeLessThanOrEqual(e.valorPago)
      }),
    )
  })

  it('no cancelamento tardio e no no-show, a barbearia fica com pelo menos 80% do retido', () => {
    fc.assert(
      fc.property(entrada, (e) => {
        fc.pre(e.evento === 'cancelado_fora_do_prazo' || e.evento === 'no_show')
        const r = liquidar(e)
        const retido = e.valorPago - r.devolvidoAoCliente
        expect(r.barbearia * 10).toBeGreaterThanOrEqual(retido * 8)
      }),
    )
  })
})
