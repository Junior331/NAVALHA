// Cálculos da grade da agenda (Figma Admin 02 e 02c), sem React, para testar à parte.

export interface Intervalo {
  inicioMin: number
  fimMin: number
}

/**
 * Atendimentos que se sobrepõem ficam lado a lado (backlog Admin 02: separar por barbeiro e não
 * empilhar eventos). Cada evento recebe a faixa que ocupa e quantas faixas o grupo dele usa.
 */
export function distribuirEmFaixas<T extends Intervalo>(
  eventos: T[],
): (T & { faixa: number; faixas: number })[] {
  const ordenados = [...eventos].sort((a, b) => a.inicioMin - b.inicioMin || b.fimMin - a.fimMin)
  const saida: (T & { faixa: number; faixas: number })[] = []
  let grupo: (T & { faixa: number; faixas: number })[] = []
  let fimDoGrupo = -Infinity
  let fimDasFaixas: number[] = []

  const fecharGrupo = () => {
    for (const evento of grupo) evento.faixas = fimDasFaixas.length
    saida.push(...grupo)
    grupo = []
    fimDasFaixas = []
  }

  for (const evento of ordenados) {
    if (evento.inicioMin >= fimDoGrupo) fecharGrupo()
    let faixa = fimDasFaixas.findIndex((fim) => fim <= evento.inicioMin)
    if (faixa === -1) faixa = fimDasFaixas.push(evento.fimMin) - 1
    else fimDasFaixas[faixa] = evento.fimMin
    grupo.push({ ...evento, faixa, faixas: 1 })
    fimDoGrupo = Math.max(fimDoGrupo, evento.fimMin)
  }
  fecharGrupo()
  return saida
}

export function somarDias(data: string, dias: number): string {
  const [a, m, d] = data.split('-').map(Number)
  return new Date(Date.UTC(a ?? 1970, (m ?? 1) - 1, (d ?? 1) + dias)).toISOString().slice(0, 10)
}

/** Dia da semana de uma data (0 = domingo), sem depender do fuso de quem roda. */
export function diaDaSemana(data: string): number {
  const [a, m, d] = data.split('-').map(Number)
  return new Date(Date.UTC(a ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay()
}

/** Segunda a domingo da semana da data. */
export function semanaDe(data: string): string[] {
  const segunda = somarDias(data, -((diaDaSemana(data) + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => somarDias(segunda, i))
}

/**
 * Faixa de horas da grade: da abertura mais cedo ao fechamento mais tarde dos dias exibidos
 * (backlog Admin 02: a grade vai até o fechamento), arredondada para horas cheias. Eventos fora do
 * expediente (encaixe no balcão) alargam a faixa.
 */
export function faixaDaGrade(
  horarios: { abre: string; fecha: string }[],
  eventos: Intervalo[] = [],
): { inicioMin: number; fimMin: number } {
  const minutos = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number)
    return (h ?? 0) * 60 + (m ?? 0)
  }
  const inicios = [...horarios.map((h) => minutos(h.abre)), ...eventos.map((e) => e.inicioMin)]
  const fins = [...horarios.map((h) => minutos(h.fecha)), ...eventos.map((e) => e.fimMin)]
  if (inicios.length === 0) return { inicioMin: 8 * 60, fimMin: 20 * 60 }
  return {
    inicioMin: Math.floor(Math.min(...inicios) / 60) * 60,
    fimMin: Math.min(24 * 60, Math.ceil(Math.max(...fins) / 60) * 60),
  }
}

/** Link do WhatsApp com a mensagem pronta (aviso manual do MVP; API oficial depois). */
export function linkDoWhatsapp(celular: string | null, mensagem: string): string | null {
  const digitos = (celular ?? '').replace(/\D/g, '').replace(/^55/, '')
  if (digitos.length < 10) return null
  return `https://wa.me/55${digitos}?text=${encodeURIComponent(mensagem)}`
}
