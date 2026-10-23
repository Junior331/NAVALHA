import { describe, expect, it } from 'vitest'
import { centavos, deReais, percentualPraBaixo, somar } from './money'

describe('centavos', () => {
  it('aceita inteiros não negativos', () => {
    expect(centavos(0)).toBe(0)
    expect(centavos(7000)).toBe(7000)
  })

  it('rejeita fração de centavo e valor negativo', () => {
    expect(() => centavos(10.5)).toThrow(RangeError)
    expect(() => centavos(-1)).toThrow(RangeError)
    expect(() => centavos(Number.NaN)).toThrow(RangeError)
  })
})

describe('deReais', () => {
  it('converte reais em centavos sem erro de ponto flutuante', () => {
    expect(deReais(70)).toBe(7000)
    expect(deReais(0.1 + 0.2)).toBe(30)
    expect(deReais(23.33)).toBe(2333)
  })
})

describe('percentualPraBaixo', () => {
  it('calcula em pontos-base e arredonda para baixo', () => {
    expect(percentualPraBaixo(10000, 800)).toBe(800)
    expect(percentualPraBaixo(7000, 800)).toBe(560)
    expect(percentualPraBaixo(999, 800)).toBe(79)
    expect(percentualPraBaixo(5000, 2000)).toBe(1000)
  })

  it('aceita 0% e 100%', () => {
    expect(percentualPraBaixo(5000, 0)).toBe(0)
    expect(percentualPraBaixo(5000, 10000)).toBe(5000)
  })

  it('rejeita pontos-base fora de 0 a 10000', () => {
    expect(() => percentualPraBaixo(5000, -1)).toThrow(RangeError)
    expect(() => percentualPraBaixo(5000, 10001)).toThrow(RangeError)
  })
})

describe('somar', () => {
  it('soma valores em centavos', () => {
    expect(somar(5500, 1500)).toBe(7000)
    expect(somar()).toBe(0)
  })
})
