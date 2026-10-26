import { describe, expect, it } from 'vitest'
import { diaPorExtenso, iniciais, intervaloDeDias, variacaoPct } from './formato'

describe('formato do painel', () => {
  it('escreve o dia como no cabeçalho do Figma', () => {
    expect(diaPorExtenso('2026-10-07T15:00:00Z')).toBe('Quarta, 07 de outubro')
    expect(diaPorExtenso('2026-10-10T15:00:00Z')).toBe('Sábado, 10 de outubro')
  })

  it('resume o intervalo da semana no mesmo mês e na virada do mês', () => {
    expect(intervaloDeDias('2026-10-05', '2026-10-10')).toBe('05 – 10 out')
    expect(intervaloDeDias('2026-09-28', '2026-10-03')).toBe('28 set – 03 out')
    expect(intervaloDeDias('2026-10-07', '2026-10-07')).toBe('07 out')
  })

  it('calcula a variação e as iniciais', () => {
    expect(variacaoPct(112, 100)).toBeCloseTo(12)
    expect(variacaoPct(5, 0)).toBeNull()
    expect(iniciais('Zé Barbosa')).toBe('ZB')
    expect(iniciais('Rafael de Lima Souza')).toBe('RS')
    expect(iniciais('Barbearia do Zé')).toBe('BZ')
    expect(iniciais('Dono')).toBe('D')
  })
})
