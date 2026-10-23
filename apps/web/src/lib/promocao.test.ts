import { describe, expect, it } from 'vitest'
import { descreverPromocao, statusDaPromocao, textoDosDias } from './promocao'

const FUSO = 'America/Sao_Paulo'
const fim = new Date('2026-11-22T23:59:59-03:00')

describe('textoDosDias', () => {
  it('todos os dias (ou nenhum marcado) não restringe', () => {
    expect(textoDosDias(null)).toBeNull()
    expect(textoDosDias([0, 1, 2, 3, 4, 5, 6])).toBeNull()
  })

  it('fim de semana e dias úteis têm o texto de sempre', () => {
    expect(textoDosDias([0, 6])).toBe('aos sábados e domingos')
    expect(textoDosDias([5, 1, 2, 3, 4])).toBe('de segunda a sexta')
  })

  it('mistura dias com "às" e "aos"', () => {
    expect(textoDosDias([3])).toBe('às quartas')
    expect(textoDosDias([1, 3, 6])).toBe('às segundas e quartas e aos sábados')
  })
})

describe('descreverPromocao', () => {
  it('monta a frase com desconto, serviços, dias e validade (backlog Admin 07)', () => {
    expect(
      descreverPromocao({
        desconto: { tipo: 'percentual', pct: 10 },
        servicos: ['Hidratação', 'Pigmentação'],
        dias: [0, 6],
        fim,
        fuso: FUSO,
      }),
    ).toBe('10% de desconto em Hidratação e Pigmentação, aos sábados e domingos, até 22/11.')
  })

  it('valor fixo em todos os serviços, qualquer dia', () => {
    expect(
      descreverPromocao({
        desconto: { tipo: 'fixo', valor: 1500 },
        servicos: 'todos',
        dias: null,
        fim,
        fuso: FUSO,
      }),
    ).toBe('R$ 15,00 de desconto em todos os serviços, até 22/11.')
  })
})

describe('statusDaPromocao', () => {
  const p = { ativa: true, inicio: new Date('2026-10-18T00:00:00-03:00'), fim }

  it('agendada antes de começar, ativa no período e encerrada depois', () => {
    expect(statusDaPromocao(p, new Date('2026-10-10T12:00:00Z'))).toBe('agendada')
    expect(statusDaPromocao(p, new Date('2026-10-20T12:00:00Z'))).toBe('ativa')
    expect(statusDaPromocao(p, new Date('2026-12-01T12:00:00Z'))).toBe('encerrada')
  })

  it('pausada pelo dono enquanto não encerra', () => {
    expect(statusDaPromocao({ ...p, ativa: false }, new Date('2026-10-20T12:00:00Z'))).toBe(
      'pausada',
    )
  })
})
