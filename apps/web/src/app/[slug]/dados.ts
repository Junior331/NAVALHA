import 'server-only'
import { cache } from 'react'
import { partesLocais } from '@navalha/core'
import { paginaDaBarbearia, type PaginaDaBarbearia } from '@navalha/servidor'
import { contexto } from '@/server/contexto'

// Dados da página pública, uma consulta por requisição (página, metadados e fluxo de agendar).
export const barbeariaPublica = cache((slug: string) => paginaDaBarbearia(contexto(), slug))

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

/** "Aberto agora · fecha às 21:00" no fuso da barbearia (backlog Admin: status bate com o relógio). */
export function situacaoDoHorario(
  pagina: Pick<PaginaDaBarbearia, 'fuso' | 'horarios'>,
  agora = new Date(),
): string {
  const local = partesLocais(agora, pagina.fuso)
  const minutos = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number)
    return (h ?? 0) * 60 + (m ?? 0)
  }
  const hoje = pagina.horarios.find((h) => h.diaSemana === local.diaSemana)
  if (hoje && local.minutos >= minutos(hoje.abre) && local.minutos < minutos(hoje.fecha)) {
    return `Aberto agora · fecha às ${hoje.fecha}`
  }
  for (let i = 0; i < 7; i++) {
    const dia = (local.diaSemana + i) % 7
    const horario = pagina.horarios.find((h) => h.diaSemana === dia)
    if (!horario || (i === 0 && local.minutos >= minutos(horario.abre))) continue
    const quando = i === 0 ? 'hoje' : i === 1 ? 'amanhã' : DIAS[dia]
    return `Fechado agora · abre ${quando} às ${horario.abre}`
  }
  return 'Sem horário de funcionamento cadastrado'
}
