import { describe, expect, it } from 'vitest'
import { minutosEmTexto, reais, soDigitos } from './formato'

describe('formato', () => {
  it('reais em pt-BR com espaço comum depois do R$', () => {
    expect(reais(5500)).toBe('R$ 55,00')
    expect(reais(150000)).toBe('R$ 1.500,00')
  })

  it('duração em texto curto', () => {
    expect(minutosEmTexto(40)).toBe('40 min')
    expect(minutosEmTexto(60)).toBe('1h')
    expect(minutosEmTexto(65)).toBe('1h05')
  })

  it('só os dígitos de celular e documento', () => {
    expect(soDigitos('(11) 98765-4321')).toBe('11987654321')
  })
})
