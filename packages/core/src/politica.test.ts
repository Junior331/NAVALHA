import { describe, expect, it } from 'vitest'
import {
  classificarCancelamentoDoCliente,
  deveMarcarNoShow,
  fimDaTolerancia,
  fimDoPrazoGratis,
  validarPolitica,
  type PoliticaCancelamento,
} from './politica'

// regras-de-negocio §Política de cancelamento: prazo grátis, % retido e tolerância de atraso.
const politica: PoliticaCancelamento = { prazoGratisHoras: 2, retencaoPct: 50, toleranciaMin: 15 }
const inicio = new Date('2026-10-07T16:30:00-03:00')
const em = (iso: string) => new Date(iso)

describe('validarPolitica', () => {
  it('aceita a política de exemplo dos docs', () => {
    expect(() => validarPolitica(politica)).not.toThrow()
  })

  it.each([
    { prazoGratisHoras: -1 },
    { retencaoPct: 101 },
    { retencaoPct: -1 },
    { retencaoPct: 12.5 },
    { toleranciaMin: -5 },
  ])('rejeita %o', (parcial) => {
    expect(() => validarPolitica({ ...politica, ...parcial })).toThrow(RangeError)
  })
})

describe('prazo grátis', () => {
  it('termina X horas antes do horário', () => {
    expect(fimDoPrazoGratis(inicio, politica)).toEqual(em('2026-10-07T14:30:00-03:00'))
  })

  it('cancelar até o fim do prazo é no prazo, inclusive no limite exato', () => {
    expect(
      classificarCancelamentoDoCliente({
        agora: em('2026-10-07T10:00:00-03:00'),
        inicio,
        politica,
      }),
    ).toBe('cliente_cancelou_no_prazo')
    expect(
      classificarCancelamentoDoCliente({
        agora: em('2026-10-07T14:30:00-03:00'),
        inicio,
        politica,
      }),
    ).toBe('cliente_cancelou_no_prazo')
  })

  it('cancelar depois do fim do prazo é fora do prazo', () => {
    expect(
      classificarCancelamentoDoCliente({
        agora: em('2026-10-07T14:30:01-03:00'),
        inicio,
        politica,
      }),
    ).toBe('cliente_cancelou_fora_do_prazo')
  })

  it('com prazo de 0 horas, qualquer cancelamento antes do horário é no prazo', () => {
    expect(
      classificarCancelamentoDoCliente({
        agora: em('2026-10-07T16:29:00-03:00'),
        inicio,
        politica: { ...politica, prazoGratisHoras: 0 },
      }),
    ).toBe('cliente_cancelou_no_prazo')
  })
})

describe('no-show', () => {
  it('a tolerância termina X minutos depois do horário', () => {
    expect(fimDaTolerancia(inicio, politica)).toEqual(em('2026-10-07T16:45:00-03:00'))
  })

  it('marca no-show só depois da tolerância e só se o atendimento não começou', () => {
    const dentro = em('2026-10-07T16:45:00-03:00')
    const depois = em('2026-10-07T16:45:01-03:00')
    expect(deveMarcarNoShow({ agora: dentro, inicio, politica, status: 'confirmado' })).toBe(false)
    expect(deveMarcarNoShow({ agora: depois, inicio, politica, status: 'confirmado' })).toBe(true)
    expect(deveMarcarNoShow({ agora: depois, inicio, politica, status: 'em_atendimento' })).toBe(
      false,
    )
    expect(
      deveMarcarNoShow({ agora: depois, inicio, politica, status: 'cancelado_no_prazo' }),
    ).toBe(false)
  })
})
