import type { Minutos } from './disponibilidade'

// Conversão entre o horário da barbearia (data + minuto do dia no fuso dela) e instantes UTC.
// Usa o Intl do runtime, sem tabela própria de fusos.

const MINUTO_MS = 60_000

export interface PartesLocais {
  /** YYYY-MM-DD no fuso da barbearia. */
  data: string
  minutos: Minutos
  /** 0 = domingo … 6 = sábado. */
  diaSemana: number
}

export function partesLocais(instante: Date, fuso: string): PartesLocais {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: fuso,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(instante)
  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((p) => p.type === tipo)?.value ?? ''
  const dias = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return {
    data: `${valor('year')}-${valor('month')}-${valor('day')}`,
    minutos: Number(valor('hour')) * 60 + Number(valor('minute')),
    diaSemana: dias.indexOf(valor('weekday')),
  }
}

export function instanteLocal(data: string, minutos: Minutos, fuso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data)
  if (!m) throw new RangeError(`Data inválida: ${data}`)
  // Chuta o instante como se o fuso fosse UTC e corrige pela diferença observada.
  const chute = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) + minutos * MINUTO_MS
  const observado = partesLocais(new Date(chute), fuso)
  const diferenca =
    (Date.UTC(
      Number(observado.data.slice(0, 4)),
      Number(observado.data.slice(5, 7)) - 1,
      Number(observado.data.slice(8, 10)),
    ) +
      observado.minutos * MINUTO_MS -
      chute) /
    MINUTO_MS
  return new Date(chute - diferenca * MINUTO_MS)
}
