// Estados do agendamento: docs/mapa.md §3, cartao-pre-autorizado §Cartão e CLAUDE.md
// (agendamento instantâneo, sem Pendente; no-show separado de cancelamento).
// O Pix só cria o agendamento depois de pago: a reserva do horário durante o QR Code
// é um bloqueio temporário de agenda, não um status.

export const STATUS_AGENDAMENTO = [
  'reservado',
  'confirmado',
  'em_atendimento',
  'concluido',
  'cancelado_no_prazo',
  'cancelado_fora_do_prazo',
  'cancelado_pela_barbearia',
  'no_show',
  'liberado',
] as const

export type StatusAgendamento = (typeof STATUS_AGENDAMENTO)[number]

export const EVENTOS_AGENDAMENTO = [
  'pre_autorizacao_aprovada',
  'pagamento_regularizado',
  'regularizacao_expirada',
  'atendimento_iniciado',
  'atendimento_concluido',
  'cliente_cancelou_no_prazo',
  'cliente_cancelou_fora_do_prazo',
  'barbearia_cancelou',
  'no_show',
] as const

export type EventoAgendamento = (typeof EVENTOS_AGENDAMENTO)[number]

const TRANSICOES: Record<
  StatusAgendamento,
  Partial<Record<EventoAgendamento, StatusAgendamento>>
> = {
  reservado: {
    pre_autorizacao_aprovada: 'confirmado',
    pagamento_regularizado: 'confirmado',
    regularizacao_expirada: 'liberado',
    cliente_cancelou_no_prazo: 'cancelado_no_prazo',
    barbearia_cancelou: 'cancelado_pela_barbearia',
  },
  confirmado: {
    atendimento_iniciado: 'em_atendimento',
    cliente_cancelou_no_prazo: 'cancelado_no_prazo',
    cliente_cancelou_fora_do_prazo: 'cancelado_fora_do_prazo',
    barbearia_cancelou: 'cancelado_pela_barbearia',
    no_show: 'no_show',
  },
  em_atendimento: {
    atendimento_concluido: 'concluido',
  },
  concluido: {},
  cancelado_no_prazo: {},
  cancelado_fora_do_prazo: {},
  cancelado_pela_barbearia: {},
  no_show: {},
  liberado: {},
}

export class TransicaoInvalida extends Error {
  constructor(
    readonly status: StatusAgendamento,
    readonly evento: EventoAgendamento,
  ) {
    super(`Transição inválida: ${status} + ${evento}`)
    this.name = 'TransicaoInvalida'
  }
}

export function transicionar(
  status: StatusAgendamento,
  evento: EventoAgendamento,
): StatusAgendamento {
  const proximo = TRANSICOES[status][evento]
  if (!proximo) throw new TransicaoInvalida(status, evento)
  return proximo
}

export function ehFinal(status: StatusAgendamento): boolean {
  return Object.keys(TRANSICOES[status]).length === 0
}
