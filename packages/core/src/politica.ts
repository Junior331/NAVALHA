import type { EventoAgendamento, StatusAgendamento } from './agendamento'

// Política de cancelamento configurada por cada barbearia: regras-de-negocio §Política de
// cancelamento. Passada a tolerância de atraso sem o atendimento começar, conta como no-show.

export interface PoliticaCancelamento {
  prazoGratisHoras: number
  /** % retido no cancelamento tardio e no no-show (0 a 100). */
  retencaoPct: number
  toleranciaMin: number
}

const HORA_MS = 3_600_000
const MINUTO_MS = 60_000

export function validarPolitica(politica: PoliticaCancelamento): void {
  if (!Number.isFinite(politica.prazoGratisHoras) || politica.prazoGratisHoras < 0) {
    throw new RangeError(`Prazo grátis inválido: ${politica.prazoGratisHoras}h`)
  }
  if (
    !Number.isInteger(politica.retencaoPct) ||
    politica.retencaoPct < 0 ||
    politica.retencaoPct > 100
  ) {
    throw new RangeError(`Retenção inválida: ${politica.retencaoPct}%`)
  }
  if (!Number.isFinite(politica.toleranciaMin) || politica.toleranciaMin < 0) {
    throw new RangeError(`Tolerância inválida: ${politica.toleranciaMin} min`)
  }
}

export function fimDoPrazoGratis(inicio: Date, politica: PoliticaCancelamento): Date {
  return new Date(inicio.getTime() - politica.prazoGratisHoras * HORA_MS)
}

export function fimDaTolerancia(inicio: Date, politica: PoliticaCancelamento): Date {
  return new Date(inicio.getTime() + politica.toleranciaMin * MINUTO_MS)
}

export function classificarCancelamentoDoCliente(params: {
  agora: Date
  inicio: Date
  politica: PoliticaCancelamento
}): Extract<EventoAgendamento, 'cliente_cancelou_no_prazo' | 'cliente_cancelou_fora_do_prazo'> {
  const limite = fimDoPrazoGratis(params.inicio, params.politica)
  return params.agora.getTime() <= limite.getTime()
    ? 'cliente_cancelou_no_prazo'
    : 'cliente_cancelou_fora_do_prazo'
}

export function deveMarcarNoShow(params: {
  agora: Date
  inicio: Date
  politica: PoliticaCancelamento
  status: StatusAgendamento
}): boolean {
  if (params.status !== 'confirmado') return false
  return params.agora.getTime() > fimDaTolerancia(params.inicio, params.politica).getTime()
}
