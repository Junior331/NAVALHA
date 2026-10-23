import { describe, expect, it } from 'vitest'
import { SAQUE_MINIMO, saldoDisponivel, validarSaque } from './carteira'

// cartao-pre-autorizado §Transferência: disponível = saldo − taxas a transferir;
// regras-de-negocio §Decisões: saque manual, mínimo de R$ 50, verificado sobre o disponível.
describe('saldoDisponivel', () => {
  it('desconta as taxas da Navalha ainda não transferidas', () => {
    expect(saldoDisponivel({ saldo: 128040, taxasATransferir: 4800 })).toBe(123240)
  })

  it('nunca fica negativo', () => {
    expect(saldoDisponivel({ saldo: 1000, taxasATransferir: 4800 })).toBe(0)
  })
})

describe('validarSaque', () => {
  it('o mínimo é R$ 50', () => {
    expect(SAQUE_MINIMO).toBe(5000)
    expect(validarSaque({ valor: 4999, disponivel: 100000 })).toEqual({
      ok: false,
      motivo: 'abaixo_do_minimo',
    })
    expect(validarSaque({ valor: 5000, disponivel: 100000 })).toEqual({ ok: true })
  })

  it('não saca mais do que o disponível (mesmo com saldo bruto maior)', () => {
    const disponivel = saldoDisponivel({ saldo: 6000, taxasATransferir: 2000 })
    expect(validarSaque({ valor: 6000, disponivel })).toEqual({
      ok: false,
      motivo: 'acima_do_disponivel',
    })
  })
})
