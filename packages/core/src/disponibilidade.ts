// Disponibilidade de um barbeiro num dia, em minutos desde a meia-noite no fuso da barbearia.
// A conversão de fuso fica na API; aqui só entra a agenda do dia.

/** Minutos desde 00:00. */
export type Minutos = number

/** Intervalo semiaberto [inicio, fim). */
export interface Intervalo {
  inicio: Minutos
  fim: Minutos
}

export interface Expediente extends Intervalo {
  pausas?: Intervalo[]
}

export function minutos(hhmm: string): Minutos {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm)
  if (!m) throw new RangeError(`Horário inválido: ${hhmm}`)
  return Number(m[1]) * 60 + Number(m[2])
}

export function paraHHMM(valor: Minutos): string {
  const h = Math.floor(valor / 60)
  const m = valor % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function sobrepoe(a: Intervalo, b: Intervalo): boolean {
  return a.inicio < b.fim && b.inicio < a.fim
}

export function horariosLivres(params: {
  /** null: dia fechado ou folga de dia inteiro. */
  expediente: Expediente | null
  /** Folgas parciais e pausa de agenda. */
  bloqueios: Intervalo[]
  /** Agendamentos existentes e reservas temporárias de Pix. */
  ocupados: Intervalo[]
  duracaoMin: number
  passoMin: number
  /** Primeiro minuto aceito, para não oferecer horário que já passou. */
  aPartirDe?: Minutos
}): Minutos[] {
  const { expediente, duracaoMin, passoMin } = params
  if (!Number.isInteger(duracaoMin) || duracaoMin <= 0) {
    throw new RangeError(`Duração inválida: ${duracaoMin} min`)
  }
  if (!Number.isInteger(passoMin) || passoMin <= 0) {
    throw new RangeError(`Passo inválido: ${passoMin} min`)
  }
  if (!expediente) return []

  const indisponiveis = [...(expediente.pausas ?? []), ...params.bloqueios, ...params.ocupados]
  const aPartirDe = params.aPartirDe ?? 0
  const livres: Minutos[] = []

  for (let inicio = expediente.inicio; inicio + duracaoMin <= expediente.fim; inicio += passoMin) {
    if (inicio < aPartirDe) continue
    const candidato = { inicio, fim: inicio + duracaoMin }
    if (!indisponiveis.some((i) => sobrepoe(candidato, i))) livres.push(inicio)
  }
  return livres
}

export function duracaoTotal(servicos: { duracaoMin: number }[]): number {
  if (servicos.length === 0) throw new RangeError('Escolha ao menos um serviço')
  return servicos.reduce((total, s) => total + s.duracaoMin, 0)
}

export function barbeirosQueFazem(
  servicoIds: string[],
  barbeiros: { id: string; servicoIds: string[] }[],
): string[] {
  return barbeiros
    .filter((b) => servicoIds.every((id) => b.servicoIds.includes(id)))
    .map((b) => b.id)
}
