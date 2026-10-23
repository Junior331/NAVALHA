import { describe, expect, it } from 'vitest'
import {
  barbeirosQueFazem,
  duracaoTotal,
  horariosLivres,
  minutos,
  paraHHMM,
  type Expediente,
} from './disponibilidade'

// Figma Barbeiro 09 Disponibilidade: segunda 09:00–19:00 com intervalo às 12:00;
// Barbeiro 10 Folgas: folga de dia inteiro ou parcial. Cliente 09: horários do barbeiro
// para a duração somada dos serviços (Corte + Barba 50 min + Sobrancelha 15 min = 65 min).
const segunda: Expediente = {
  inicio: minutos('09:00'),
  fim: minutos('19:00'),
  pausas: [{ inicio: minutos('12:00'), fim: minutos('13:00') }],
}

const livres = (params: Partial<Parameters<typeof horariosLivres>[0]>) =>
  horariosLivres({
    expediente: segunda,
    bloqueios: [],
    ocupados: [],
    duracaoMin: 60,
    passoMin: 60,
    ...params,
  }).map(paraHHMM)

describe('minutos e paraHHMM', () => {
  it('converte entre HH:MM e minutos desde a meia-noite', () => {
    expect(minutos('09:30')).toBe(570)
    expect(paraHHMM(570)).toBe('09:30')
    expect(paraHHMM(minutos('00:05'))).toBe('00:05')
  })

  it('rejeita horário inválido', () => {
    expect(() => minutos('25:00')).toThrow(RangeError)
    expect(() => minutos('9h')).toThrow(RangeError)
  })
})

describe('horariosLivres', () => {
  it('respeita o expediente e o intervalo', () => {
    expect(livres({})).toEqual([
      '09:00',
      '10:00',
      '11:00',
      '13:00',
      '14:00',
      '15:00',
      '16:00',
      '17:00',
      '18:00',
    ])
  })

  it('não oferece horário que termina depois do fim do expediente', () => {
    expect(livres({ duracaoMin: 65, passoMin: 15 }).at(-1)).toBe('17:45')
  })

  it('não oferece horário que atravessa o intervalo', () => {
    const r = livres({ duracaoMin: 65, passoMin: 15 })
    expect(r).toContain('10:45')
    expect(r).not.toContain('11:00')
    expect(r).toContain('13:00')
  })

  it('tira os horários já ocupados', () => {
    const r = livres({ ocupados: [{ inicio: minutos('14:00'), fim: minutos('15:05') }] })
    expect(r).not.toContain('14:00')
    expect(r).not.toContain('15:00')
    expect(r).toContain('16:00')
  })

  it('tira os horários de uma folga parcial', () => {
    const r = livres({ bloqueios: [{ inicio: minutos('14:00'), fim: minutos('16:00') }] })
    expect(r).not.toContain('14:00')
    expect(r).not.toContain('15:00')
    expect(r).toContain('16:00')
  })

  it('dia fechado ou folga de dia inteiro não tem horário', () => {
    expect(livres({ expediente: null })).toEqual([])
  })

  it('não oferece horário que já passou', () => {
    expect(livres({ aPartirDe: minutos('15:10') })[0]).toBe('16:00')
  })

  it('rejeita duração ou passo inválidos', () => {
    expect(() => livres({ duracaoMin: 0 })).toThrow(RangeError)
    expect(() => livres({ passoMin: 0 })).toThrow(RangeError)
  })
})

describe('duracaoTotal', () => {
  it('soma a duração dos serviços escolhidos', () => {
    expect(duracaoTotal([{ duracaoMin: 50 }, { duracaoMin: 15 }])).toBe(65)
  })

  it('exige ao menos um serviço', () => {
    expect(() => duracaoTotal([])).toThrow(RangeError)
  })
})

describe('barbeirosQueFazem', () => {
  // Figma Cliente 08: Carlos não faz sobrancelha, então fica indisponível.
  const barbeiros = [
    { id: 'ze', servicoIds: ['corte-barba', 'sobrancelha'] },
    { id: 'rafael', servicoIds: ['corte-barba', 'degrade', 'sobrancelha'] },
    { id: 'carlos', servicoIds: ['corte-barba'] },
  ]

  it('mostra só quem faz todos os serviços escolhidos', () => {
    expect(barbeirosQueFazem(['corte-barba', 'sobrancelha'], barbeiros)).toEqual(['ze', 'rafael'])
  })

  it('devolve lista vazia quando ninguém faz a combinação (Figma 08b)', () => {
    expect(barbeirosQueFazem(['degrade', 'pigmentacao'], barbeiros)).toEqual([])
  })
})
