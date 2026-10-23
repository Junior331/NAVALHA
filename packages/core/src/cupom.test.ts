import { describe, expect, it } from 'vitest'
import {
  aplicarCupom,
  melhorOferta,
  precoDoServico,
  validarCupom,
  type Cupom,
  type MotivoCupomInvalido,
} from './cupom'

// regras-de-negocio §Outras regras: cupom criado por cada barbearia e válido só nela; o desconto
// sai do valor da barbearia. Backlog Admin 07: campo "Dias válidos" aplicado pelo sistema.
const fimDeSemana: Cupom = {
  barbeariaId: 'ze',
  desconto: { tipo: 'percentual', pct: 10 },
  servicoIds: ['hidratacao', 'pigmentacao'],
  diasSemana: [0, 6],
  inicio: new Date('2026-10-18T00:00:00-03:00'),
  fim: new Date('2026-10-25T23:59:59-03:00'),
  limiteUsos: 100,
  umUsoPorCliente: true,
}

const sabado = new Date('2026-10-24T10:00:00-03:00')
const terca = new Date('2026-10-20T10:00:00-03:00')

const validar = (parcial: Partial<Parameters<typeof validarCupom>[0]>) =>
  validarCupom({
    cupom: fimDeSemana,
    barbeariaId: 'ze',
    inicioDoAtendimento: sabado,
    diaDaSemana: 6,
    servicoIds: ['pigmentacao'],
    usosTotais: 0,
    usosDoCliente: 0,
    ...parcial,
  })

describe('validarCupom', () => {
  it('aceita o cupom dentro das regras', () => {
    expect(validar({})).toEqual({ ok: true })
  })

  it.each([
    [{ barbeariaId: 'outra' }, 'outra_barbearia'],
    [
      { inicioDoAtendimento: new Date('2026-10-26T10:00:00-03:00'), diaDaSemana: 1 },
      'fora_do_periodo',
    ],
    [{ inicioDoAtendimento: terca, diaDaSemana: 2 }, 'dia_invalido'],
    [{ servicoIds: ['corte'] }, 'servico_nao_abrangido'],
    [{ usosTotais: 100 }, 'esgotado'],
    [{ usosDoCliente: 1 }, 'ja_usado'],
  ] satisfies [Partial<Parameters<typeof validarCupom>[0]>, MotivoCupomInvalido][])(
    'recusa %o com motivo %s',
    (parcial, motivo) => {
      expect(validar(parcial)).toEqual({ ok: false, motivo })
    },
  )

  it('sem limite de usos e sem restrição de dia, aceita qualquer dia', () => {
    const livre: Cupom = { ...fimDeSemana, limiteUsos: null, diasSemana: null }
    expect(validar({ cupom: livre, usosTotais: 9999, diaDaSemana: 2 })).toEqual({ ok: true })
  })
})

describe('aplicarCupom', () => {
  const itens = [
    { servicoId: 'corte', preco: 4000 },
    { servicoId: 'pigmentacao', preco: 6000 },
  ]

  it('percentual: desconta só dos serviços abrangidos, arredondando o desconto para baixo', () => {
    expect(aplicarCupom(itens, fimDeSemana)).toEqual({
      valorBruto: 10000,
      desconto: 600,
      valorPago: 9400,
    })
  })

  it('valor fixo: nunca passa do total dos serviços abrangidos', () => {
    const fixo: Cupom = { ...fimDeSemana, desconto: { tipo: 'fixo', valor: 9000 } }
    expect(aplicarCupom(itens, fixo)).toEqual({
      valorBruto: 10000,
      desconto: 6000,
      valorPago: 4000,
    })
  })

  it('"todos os serviços" abrange o pedido inteiro', () => {
    const todos: Cupom = {
      ...fimDeSemana,
      servicoIds: 'todos',
      desconto: { tipo: 'fixo', valor: 1000 },
    }
    expect(aplicarCupom(itens, todos).valorPago).toBe(9000)
  })
})

describe('precoDoServico', () => {
  it('sem desconto, é o preço de tabela', () => {
    expect(precoDoServico(5500, null)).toBe(5500)
  })

  it('desconto percentual arredonda o desconto para baixo (Admin 05: R$ 70 com −15%)', () => {
    expect(precoDoServico(7000, { tipo: 'percentual', pct: 15 })).toBe(5950)
    expect(precoDoServico(999, { tipo: 'percentual', pct: 15 })).toBe(850)
  })

  it('desconto fixo nunca deixa o preço negativo (Admin 05: R$ 95 com −R$ 10)', () => {
    expect(precoDoServico(9500, { tipo: 'fixo', valor: 1000 })).toBe(8500)
    expect(precoDoServico(500, { tipo: 'fixo', valor: 1000 })).toBe(0)
  })
})

describe('melhorOferta (oferta automática, sem código)', () => {
  const itens = [
    { servicoId: 'corte', preco: 4000 },
    { servicoId: 'pigmentacao', preco: 6000 },
  ]
  const oferta = (id: string, parcial: Partial<Cupom>) => ({
    id,
    cupom: { ...fimDeSemana, servicoIds: 'todos' as const, ...parcial },
    usosTotais: 0,
    usosDoCliente: 0,
  })
  const pedido = {
    barbeariaId: 'ze',
    inicioDoAtendimento: sabado,
    diaDaSemana: 6,
    itens,
  }

  it('escolhe a oferta válida de maior desconto', () => {
    const r = melhorOferta(
      [
        oferta('dez-por-cento', { desconto: { tipo: 'percentual', pct: 10 } }),
        oferta('quinze-reais', { desconto: { tipo: 'fixo', valor: 1500 } }),
      ],
      pedido,
    )
    expect(r).toEqual({
      promocaoId: 'quinze-reais',
      valor: { valorBruto: 10000, desconto: 1500, valorPago: 8500 },
    })
  })

  it('ignora as ofertas que não valem para o pedido (dia, esgotada, já usada)', () => {
    const r = melhorOferta(
      [
        oferta('so-terca', { diasSemana: [2], desconto: { tipo: 'percentual', pct: 50 } }),
        { ...oferta('esgotada', { limiteUsos: 3 }), usosTotais: 3 },
        { ...oferta('ja-usada', {}), usosDoCliente: 1 },
        oferta('vale', { desconto: { tipo: 'percentual', pct: 5 } }),
      ],
      pedido,
    )
    expect(r?.promocaoId).toBe('vale')
  })

  it('sem oferta válida, não há desconto', () => {
    expect(melhorOferta([oferta('so-terca', { diasSemana: [2] })], pedido)).toBeNull()
    expect(melhorOferta([], { ...pedido, diaDaSemana: 2, inicioDoAtendimento: terca })).toBeNull()
  })
})
