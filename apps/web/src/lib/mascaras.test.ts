import { describe, expect, it } from 'vitest'
import {
  aplicarMascara,
  centavosDe,
  mascararCelular,
  mascararCpfCnpj,
  mascararReais,
  posicaoDoCursor,
  reaisParaCampo,
} from './mascaras'

describe('máscara de dinheiro', () => {
  it('põe o ponto de milhar e aceita até dois centavos depois da vírgula', () => {
    expect(mascararReais('2000000')).toBe('2.000.000')
    expect(mascararReais('50')).toBe('50')
    expect(mascararReais('50,5')).toBe('50,5')
    expect(mascararReais('1234,567')).toBe('1.234,56')
    expect(mascararReais('R$ 0012,3a')).toBe('12,3')
    expect(mascararReais(',5')).toBe('0,5')
    expect(mascararReais('abc')).toBe('')
  })

  it('converte de e para centavos', () => {
    expect(centavosDe('2.428,76')).toBe(242876)
    expect(centavosDe('50,5')).toBe(5050)
    expect(centavosDe('50')).toBe(5000)
    expect(centavosDe('')).toBe(0)
    expect(reaisParaCampo(242876)).toBe('2.428,76')
    expect(reaisParaCampo(5000)).toBe('50')
    expect(reaisParaCampo(0)).toBe('')
  })
})

describe('máscaras de telefone, documento e cartão', () => {
  it('formata celular e fixo com DDD', () => {
    expect(mascararCelular('11987654321')).toBe('(11) 98765-4321')
    expect(mascararCelular('1134567890')).toBe('(11) 3456-7890')
    expect(mascararCelular('5511987654321')).toBe('(11) 98765-4321')
    expect(mascararCelular('119')).toBe('(11) 9')
  })

  it('troca de CPF para CNPJ pelo número de dígitos', () => {
    expect(mascararCpfCnpj('12345678901')).toBe('123.456.789-01')
    expect(mascararCpfCnpj('12345678000195')).toBe('12.345.678/0001-95')
  })

  it('formata cartão, validade, CEP e limita percentual a 100', () => {
    expect(aplicarMascara('cartao', '4111111111111111')).toBe('4111 1111 1111 1111')
    expect(aplicarMascara('validade', '1229')).toBe('12/29')
    expect(aplicarMascara('cep', '01310100')).toBe('01310-100')
    expect(aplicarMascara('cvv', '12a34')).toBe('1234')
    expect(aplicarMascara('percentual', '150')).toBe('100')
  })

  it('mantém o cursor depois do mesmo dígito ao formatar', () => {
    // "20000|00" (cursor no 5º dígito) vira "2.000.0|00"
    expect(posicaoDoCursor('2000000', 5, '2.000.000')).toBe(7)
    expect(posicaoDoCursor('1198', 4, '(11) 98')).toBe(7)
  })
})
