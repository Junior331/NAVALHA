import { describe, expect, it } from 'vitest'
import { distribuirEmFaixas, faixaDaGrade, linkDoWhatsapp, semanaDe, somarDias } from './agenda'

const ev = (id: string, inicioMin: number, fimMin: number) => ({ id, inicioMin, fimMin })

describe('distribuirEmFaixas', () => {
  it('eventos sem sobreposição ocupam a largura toda', () => {
    const r = distribuirEmFaixas([ev('a', 540, 600), ev('b', 600, 660)])
    expect(r.map((e) => [e.id, e.faixa, e.faixas])).toEqual([
      ['a', 0, 1],
      ['b', 0, 1],
    ])
  })

  it('eventos simultâneos ficam lado a lado', () => {
    const r = distribuirEmFaixas([ev('a', 540, 600), ev('b', 540, 600), ev('c', 570, 630)])
    expect(r.map((e) => [e.id, e.faixa, e.faixas])).toEqual([
      ['a', 0, 3],
      ['b', 1, 3],
      ['c', 2, 3],
    ])
  })

  it('reaproveita a faixa que vagou dentro do mesmo grupo', () => {
    const r = distribuirEmFaixas([ev('a', 540, 660), ev('b', 540, 600), ev('c', 600, 640)])
    expect(r.map((e) => [e.id, e.faixa, e.faixas])).toEqual([
      ['a', 0, 2],
      ['b', 1, 2],
      ['c', 1, 2],
    ])
  })
})

describe('datas da grade', () => {
  it('a semana vai de segunda a domingo', () => {
    expect(semanaDe('2026-10-21')).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
    ])
    expect(semanaDe('2026-10-25')[0]).toBe('2026-10-19')
  })

  it('soma dias atravessando o mês', () => {
    expect(somarDias('2026-10-31', 1)).toBe('2026-11-01')
    expect(somarDias('2026-11-01', -1)).toBe('2026-10-31')
  })
})

describe('faixaDaGrade', () => {
  it('vai da abertura ao fechamento, em horas cheias', () => {
    expect(
      faixaDaGrade([
        { abre: '08:00', fecha: '21:00' },
        { abre: '09:30', fecha: '18:00' },
      ]),
    ).toEqual({ inicioMin: 480, fimMin: 1260 })
  })

  it('um encaixe fora do expediente alarga a grade', () => {
    expect(faixaDaGrade([{ abre: '09:00', fecha: '18:00' }], [ev('x', 1110, 1170)])).toEqual({
      inicioMin: 540,
      fimMin: 1200,
    })
  })
})

describe('linkDoWhatsapp', () => {
  it('monta o link com DDI do Brasil e a mensagem', () => {
    expect(linkDoWhatsapp('(11) 98888-7777', 'Oi!')).toBe('https://wa.me/5511988887777?text=Oi!')
  })

  it('sem celular válido não há link', () => {
    expect(linkDoWhatsapp(null, 'Oi')).toBeNull()
    expect(linkDoWhatsapp('1234', 'Oi')).toBeNull()
  })
})
