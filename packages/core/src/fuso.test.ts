import { describe, expect, it } from 'vitest'
import { instanteLocal, partesLocais } from './fuso'

// A agenda é pensada no horário da barbearia; o banco guarda instantes (UTC).
const SP = 'America/Sao_Paulo'

describe('instanteLocal', () => {
  it('converte data e minuto locais de São Paulo (UTC−3) em instante', () => {
    expect(instanteLocal('2026-10-21', 16 * 60 + 30, SP)).toEqual(new Date('2026-10-21T19:30:00Z'))
  })

  it('funciona em outro fuso (Manaus, UTC−4)', () => {
    expect(instanteLocal('2026-10-21', 9 * 60, 'America/Manaus')).toEqual(
      new Date('2026-10-21T13:00:00Z'),
    )
  })

  it('rejeita data malformada', () => {
    expect(() => instanteLocal('21/10/2026', 0, SP)).toThrow(RangeError)
  })
})

describe('partesLocais', () => {
  it('devolve data, minuto do dia e dia da semana no fuso da barbearia', () => {
    expect(partesLocais(new Date('2026-10-21T19:30:00Z'), SP)).toEqual({
      data: '2026-10-21',
      minutos: 16 * 60 + 30,
      diaSemana: 3,
    })
  })

  it('perto da meia-noite UTC, ainda é o dia anterior em São Paulo', () => {
    expect(partesLocais(new Date('2026-10-22T02:00:00Z'), SP)).toEqual({
      data: '2026-10-21',
      minutos: 23 * 60,
      diaSemana: 3,
    })
  })

  it('ida e volta preservam o instante', () => {
    const instante = new Date('2026-12-31T23:45:00Z')
    const p = partesLocais(instante, SP)
    expect(instanteLocal(p.data, p.minutos, SP)).toEqual(instante)
  })
})
