// Formatação em pt-BR, no fuso da barbearia (padrão: São Paulo).

const ESPACO_FIXO = new RegExp(String.fromCharCode(0xa0), 'g')

export function reais(centavos: number): string {
  return (centavos / 100)
    .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    .replace(ESPACO_FIXO, ' ')
}

export function reaisCompacto(centavos: number): string {
  const valor = centavos / 100
  if (Math.abs(valor) >= 1000) {
    return `R$ ${(valor / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
  }
  return `R$ ${valor.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
}

export function hora(iso: string | Date, fuso = 'America/Sao_Paulo'): string {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: fuso,
  })
}

export function dataCurta(iso: string | Date, fuso = 'America/Sao_Paulo'): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    timeZone: fuso,
  })
}

export function dataLonga(iso: string | Date, fuso = 'America/Sao_Paulo'): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    timeZone: fuso,
  })
}

export function minutosEmTexto(minutos: number): string {
  if (minutos < 60) return `${minutos} min`
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  return resto ? `${horas}h${String(resto).padStart(2, '0')}` : `${horas}h`
}

export function variacao(atual: number, anterior: number): string | null {
  if (anterior === 0) return null
  const pct = ((atual - anterior) / anterior) * 100
  const sinal = pct > 0 ? '+' : ''
  return `${sinal}${pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

/** "Quarta, 07 de outubro": cabeçalho do painel, agenda e evento (Figma Admin). */
export function diaPorExtenso(iso: string | Date, fuso = 'America/Sao_Paulo'): string {
  const d = new Date(iso)
  const semana = d
    .toLocaleDateString('pt-BR', { weekday: 'long', timeZone: fuso })
    .replace('-feira', '')
  const resto = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', timeZone: fuso })
  return `${semana.charAt(0).toUpperCase()}${semana.slice(1)}, ${resto}`
}

/** "05 – 10 out" ou "29 set – 04 out" (datas YYYY-MM-DD). */
export function intervaloDeDias(primeiro: string, ultimo: string): string {
  const mes = (data: string) =>
    new Date(`${data}T12:00:00Z`)
      .toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' })
      .replace('.', '')
  const dia = (data: string) => data.slice(8, 10)
  if (primeiro === ultimo) return `${dia(primeiro)} ${mes(primeiro)}`
  return mes(primeiro) === mes(ultimo)
    ? `${dia(primeiro)} – ${dia(ultimo)} ${mes(ultimo)}`
    : `${dia(primeiro)} ${mes(primeiro)} – ${dia(ultimo)} ${mes(ultimo)}`
}

/** Variação percentual com sinal (null sem base de comparação). */
export function variacaoPct(atual: number, anterior: number): number | null {
  if (anterior === 0) return null
  return ((atual - anterior) / anterior) * 100
}

export function iniciais(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .map((parte) => parte.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
