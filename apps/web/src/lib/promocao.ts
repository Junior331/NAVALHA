import type { Desconto } from '@navalha/core'
import { reais } from './formato'

// Promoções do painel (Figma Admin 07 e 07b). A descrição sai das próprias regras (backlog 07:
// os "Dias válidos" geram o texto, para a promessa bater com o que o sistema aplica).

const DIAS: Record<number, { nome: string; masculino: boolean }> = {
  1: { nome: 'segundas', masculino: false },
  2: { nome: 'terças', masculino: false },
  3: { nome: 'quartas', masculino: false },
  4: { nome: 'quintas', masculino: false },
  5: { nome: 'sextas', masculino: false },
  6: { nome: 'sábados', masculino: true },
  0: { nome: 'domingos', masculino: true },
}
const ORDEM_DA_SEMANA = [1, 2, 3, 4, 5, 6, 0]

function lista(itens: string[]): string {
  if (itens.length <= 1) return itens.join('')
  return `${itens.slice(0, -1).join(', ')} e ${itens.at(-1)}`
}

export function textoDosDias(dias: number[] | null): string | null {
  if (!dias || dias.length === 0 || dias.length === 7) return null
  const ordenados = ORDEM_DA_SEMANA.filter((d) => dias.includes(d))
  if (ordenados.join() === '1,2,3,4,5') return 'de segunda a sexta'
  const femininos = ordenados.filter((d) => !DIAS[d]?.masculino).map((d) => DIAS[d]?.nome ?? '')
  const masculinos = ordenados.filter((d) => DIAS[d]?.masculino).map((d) => DIAS[d]?.nome ?? '')
  const partes = [
    femininos.length ? `às ${lista(femininos)}` : null,
    masculinos.length ? `aos ${lista(masculinos)}` : null,
  ].filter(Boolean)
  return partes.join(' e ')
}

export function textoDoDesconto(desconto: Desconto): string {
  return desconto.tipo === 'percentual'
    ? `${desconto.pct}% de desconto`
    : `${reais(desconto.valor)} de desconto`
}

export function descreverPromocao(params: {
  desconto: Desconto
  servicos: string[] | 'todos'
  dias: number[] | null
  fim: Date
  fuso: string
}): string {
  const onde =
    params.servicos === 'todos'
      ? 'em todos os serviços'
      : params.servicos.length > 3
        ? `em ${params.servicos.length} serviços`
        : `em ${lista(params.servicos)}`
  const quando = textoDosDias(params.dias)
  const ate = params.fim.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: params.fuso,
  })
  return `${[`${textoDoDesconto(params.desconto)} ${onde}`, quando, `até ${ate}`].filter(Boolean).join(', ')}.`
}

export type StatusDaPromocao = 'ativa' | 'agendada' | 'pausada' | 'encerrada'

/** Backlog 07b: a agendada mostra quando começa, para não parecer encerrada. */
export function statusDaPromocao(
  p: { ativa: boolean; inicio: Date; fim: Date },
  agora: Date,
): StatusDaPromocao {
  if (agora.getTime() > p.fim.getTime()) return 'encerrada'
  if (!p.ativa) return 'pausada'
  if (agora.getTime() < p.inicio.getTime()) return 'agendada'
  return 'ativa'
}
