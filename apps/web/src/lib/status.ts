import type { StatusAgendamento } from '@navalha/core'
import type { Tom } from '@/componentes/ui'

// Rótulo e cor de cada status (backlog Admin 02: legenda única; sem Pendente).
export const STATUS: Record<StatusAgendamento, { rotulo: string; tom: Tom }> = {
  reservado: { rotulo: 'Reservado', tom: 'informativo' },
  confirmado: { rotulo: 'Confirmado', tom: 'sucesso' },
  em_atendimento: { rotulo: 'Em atendimento', tom: 'alerta' },
  concluido: { rotulo: 'Concluído', tom: 'neutro' },
  cancelado_no_prazo: { rotulo: 'Cancelado', tom: 'risco' },
  cancelado_fora_do_prazo: { rotulo: 'Cancelado fora do prazo', tom: 'risco' },
  cancelado_pela_barbearia: { rotulo: 'Cancelado pela barbearia', tom: 'risco' },
  no_show: { rotulo: 'No-show', tom: 'risco' },
  liberado: { rotulo: 'Liberado', tom: 'neutro' },
}

export const ATIVOS: StatusAgendamento[] = ['reservado', 'confirmado', 'em_atendimento']

export function diasAntes(data: string, dias: number): string {
  const [a, m, d] = data.split('-').map(Number)
  const utc = Date.UTC(a ?? 1970, (m ?? 1) - 1, (d ?? 1) - dias)
  return new Date(utc).toISOString().slice(0, 10)
}
