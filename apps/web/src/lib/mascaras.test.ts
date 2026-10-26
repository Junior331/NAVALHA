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
  it('entra pelos centavos, como na maquininha', () => {
    expect(mascararReais('2')).toBe('0,02')
    expect(mascararReais('0,025')).toBe('0,25')
    expect(mascararReais('0,250')).toBe('2,50')
    expect(mascararReais('2000000')).toBe('20.000,00')
    expect(mascararReais('R$ 1.234,567')).toBe('12.345,67')
    expect(mascararReais('0')).toBe('0,00')
    expect(mascararReais('abc')).toBe('')
  })

  it('apagar volta uma casa', () => {
    expect(mascararReais('0,2')).toBe('0,02')
    expect(mascararReais('2,5')).toBe('0,25')
  })

  it('converte de e para centavos', () => {
    expect(centavosDe('2.428,76')).toBe(242876)
    expect(centavosDe('50,00')).toBe(5000)
    expect(centavosDe('0,02')).toBe(2)
    expect(centavosDe('')).toBe(0)
    expect(reaisParaCampo(242876)).toBe('2.428,76')
    expect(reaisParaCampo(5000)).toBe('50,00')
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
    expect(posicaoDoCursor('1198', 4, '(11) 98')).toBe(7)
    expect(posicaoDoCursor('11987654321', 2, '(11) 98765-4321')).toBe(3)
  })
})
