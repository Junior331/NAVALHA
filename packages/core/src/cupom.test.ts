import { describe, expect, it } from 'vitest'
import { aplicarCupom, validarCupom, type Cupom, type MotivoCupomInvalido } from './cupom'

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
