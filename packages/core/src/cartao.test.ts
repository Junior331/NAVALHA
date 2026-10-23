import { describe, expect, it } from 'vitest'
import { limiteDeRegularizacao, planejarCobrancaNoCartao } from './cartao'

// cartao-pre-autorizado §Cartão e §Fluxo do cartão: pré-autorização criada 72h antes do fim
// do prazo grátis (não do horário), captura no fim do prazo grátis, 12h para regularizar.
const em = (iso: string) => new Date(iso)
const fimPrazoGratis = em('2026-10-20T14:30:00-03:00')

describe('planejarCobrancaNoCartao', () => {
  it('com mais de 72h até o fim do prazo grátis: tokeniza agora e pré-autoriza na janela', () => {
    expect(
      planejarCobrancaNoCartao({ agora: em('2026-10-10T09:00:00-03:00'), fimPrazoGratis }),
    ).toEqual({
      preAutorizarAgora: false,
      preAutorizarEm: em('2026-10-17T14:30:00-03:00'),
      capturarEm: fimPrazoGratis,
    })
  })

  it('com exatamente 72h: pré-autoriza na hora', () => {
    expect(
      planejarCobrancaNoCartao({ agora: em('2026-10-17T14:30:00-03:00'), fimPrazoGratis }),
    ).toEqual({
      preAutorizarAgora: true,
      preAutorizarEm: em('2026-10-17T14:30:00-03:00'),
      capturarEm: fimPrazoGratis,
    })
  })

  it('com menos de 72h: pré-autoriza na hora e captura no fim do prazo grátis', () => {
    const agora = em('2026-10-19T08:00:00-03:00')
    expect(planejarCobrancaNoCartao({ agora, fimPrazoGratis })).toEqual({
      preAutorizarAgora: true,
      preAutorizarEm: agora,
      capturarEm: fimPrazoGratis,
    })
  })

  it('se o prazo grátis já acabou no momento do agendamento, captura na hora', () => {
    const agora = em('2026-10-20T15:00:00-03:00')
    expect(planejarCobrancaNoCartao({ agora, fimPrazoGratis })).toEqual({
      preAutorizarAgora: true,
      preAutorizarEm: agora,
      capturarEm: agora,
    })
  })

  it('a pré-autorização nunca fica mais de 72h antes da captura (validade do Asaas)', () => {
    for (const agora of ['2026-10-01T00:00:00Z', '2026-10-18T12:00:00Z', '2026-10-20T20:00:00Z']) {
      const plano = planejarCobrancaNoCartao({ agora: em(agora), fimPrazoGratis })
      const horas = (plano.capturarEm.getTime() - plano.preAutorizarEm.getTime()) / 3_600_000
      expect(horas).toBeLessThanOrEqual(72)
    }
  })
})

describe('limiteDeRegularizacao', () => {
  it('o cliente tem 12h depois da falha para trocar o cartão ou pagar com Pix', () => {
    expect(limiteDeRegularizacao(em('2026-10-17T14:30:00-03:00'))).toEqual(
      em('2026-10-18T02:30:00-03:00'),
    )
  })
})
