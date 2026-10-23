// Formatação em pt-BR no fuso da barbearia (padrão: São Paulo), igual ao painel web.

const FUSO = 'America/Sao_Paulo'
const ESPACO_FIXO = new RegExp(String.fromCharCode(0xa0), 'g')

export function reais(centavos: number): string {
  return (centavos / 100)
    .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    .replace(ESPACO_FIXO, ' ')
}

export function hora(iso: string | Date, fuso = FUSO): string {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: fuso,
  })
}

export function dataLonga(iso: string | Date, fuso = FUSO): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    timeZone: fuso,
  })
}

export function dataCurta(iso: string | Date, fuso = FUSO): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    timeZone: fuso,
  })
}

export function minutosEmTexto(minutos: number): string {
  if (minutos < 60) return `${minutos} min`
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  return resto ? `${horas}h${String(resto).padStart(2, '0')}` : `${horas}h`
}

export const soDigitos = (texto: string) => texto.replace(/\D/g, '')
