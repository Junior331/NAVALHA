import { describe, expect, it } from 'vitest'
import {
  EVENTOS_AGENDAMENTO,
  STATUS_AGENDAMENTO,
  TransicaoInvalida,
  ehFinal,
  transicionar,
  type EventoAgendamento,
  type StatusAgendamento,
} from './agendamento'

const VALIDAS: [StatusAgendamento, EventoAgendamento, StatusAgendamento][] = [
  ['reservado', 'pre_autorizacao_aprovada', 'confirmado'],
  ['reservado', 'pagamento_regularizado', 'confirmado'],
  ['reservado', 'regularizacao_expirada', 'liberado'],
  ['reservado', 'cliente_cancelou_no_prazo', 'cancelado_no_prazo'],
  ['reservado', 'barbearia_cancelou', 'cancelado_pela_barbearia'],
  ['confirmado', 'atendimento_iniciado', 'em_atendimento'],
  ['confirmado', 'cliente_cancelou_no_prazo', 'cancelado_no_prazo'],
  ['confirmado', 'cliente_cancelou_fora_do_prazo', 'cancelado_fora_do_prazo'],
  ['confirmado', 'barbearia_cancelou', 'cancelado_pela_barbearia'],
  ['confirmado', 'no_show', 'no_show'],
  ['em_atendimento', 'atendimento_concluido', 'concluido'],
]

describe('transicionar', () => {
  it.each(VALIDAS)('%s + %s → %s', (de, evento, para) => {
    expect(transicionar(de, evento)).toBe(para)
  })

  it('rejeita toda transição que não está na lista', () => {
    const validas = new Set(VALIDAS.map(([de, evento]) => `${de}|${evento}`))
    let rejeitadas = 0
    for (const status of STATUS_AGENDAMENTO) {
      for (const evento of EVENTOS_AGENDAMENTO) {
        if (validas.has(`${status}|${evento}`)) continue
        expect(() => transicionar(status, evento)).toThrow(TransicaoInvalida)
        rejeitadas++
      }
    }
    expect(rejeitadas).toBe(STATUS_AGENDAMENTO.length * EVENTOS_AGENDAMENTO.length - VALIDAS.length)
  })

  it('não tem status Pendente (CLAUDE.md: agendamento instantâneo)', () => {
    expect(STATUS_AGENDAMENTO).not.toContain('pendente')
  })

  it('no-show é um status próprio, separado dos cancelamentos', () => {
    expect(transicionar('confirmado', 'no_show')).not.toMatch(/^cancelado/)
  })

  it('não deixa cancelar fora do prazo um agendamento ainda reservado', () => {
    expect(() => transicionar('reservado', 'cliente_cancelou_fora_do_prazo')).toThrow(
      TransicaoInvalida,
    )
  })
})

describe('ehFinal', () => {
  it('marca como finais os status que encerram o agendamento', () => {
    const finais = STATUS_AGENDAMENTO.filter(ehFinal)
    expect(finais).toEqual([
      'concluido',
      'cancelado_no_prazo',
      'cancelado_fora_do_prazo',
      'cancelado_pela_barbearia',
      'no_show',
      'liberado',
    ])
  })
})
