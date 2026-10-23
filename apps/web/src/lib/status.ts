import type { StatusAgendamento } from '@navalha/core'
import type { Tom } from '@/componentes/ui'

// Rótulo e cor de cada status (backlog Admin 02: legenda única; sem Pendente).
export const STATUS: Record<StatusAgendamento, { rotulo: string; tom: Tom }> = {
  reservado: { rotulo: 'Reservado', tom: 'alerta' },
  confirmado: { rotulo: 'Confirmado', tom: 'sucesso' },
  em_atendimento: { rotulo: 'Em atendimento', tom: 'sucesso' },
  concluido: { rotulo: 'Concluído', tom: 'neutro' },
  cancelado_no_prazo: { rotulo: 'Cancelado', tom: 'risco' },
  cancelado_fora_do_prazo: { rotulo: 'Cancelado fora do prazo', tom: 'risco' },
  cancelado_pela_barbearia: { rotulo: 'Cancelado pela barbearia', tom: 'risco' },
  no_show: { rotulo: 'No-show', tom: 'risco' },
  liberado: { rotulo: 'Liberado', tom: 'neutro' },
}

export const ATIVOS: StatusAgendamento[] = ['reservado', 'confirmado', 'em_atendimento']

/**
 * Grupos do filtro da agenda (Figma Admin 02 · Filtros). "Pendentes" do Figma virou
 * "Reservados" (cartão aguardando a pré-autorização): não existe status Pendente. No-show tem
 * grupo próprio, separado de cancelamento.
 */
export const GRUPOS_DE_STATUS: { chave: string; rotulo: string; status: StatusAgendamento[] }[] = [
  { chave: 'confirmados', rotulo: 'Confirmados', status: ['confirmado', 'em_atendimento'] },
  { chave: 'reservados', rotulo: 'Reservados', status: ['reservado'] },
  { chave: 'concluidos', rotulo: 'Concluídos', status: ['concluido'] },
  {
    chave: 'cancelados',
    rotulo: 'Cancelados',
    status: ['cancelado_no_prazo', 'cancelado_fora_do_prazo', 'cancelado_pela_barbearia'],
  },
  { chave: 'no_show', rotulo: 'No-show', status: ['no_show'] },
]

export function diasAntes(data: string, dias: number): string {
  const [a, m, d] = data.split('-').map(Number)
  const utc = Date.UTC(a ?? 1970, (m ?? 1) - 1, (d ?? 1) - dias)
  return new Date(utc).toISOString().slice(0, 10)
}
