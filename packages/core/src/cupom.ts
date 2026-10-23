import { percentualPraBaixo, type Centavos } from './money'

// Cupons e ofertas: regras-de-negocio §Outras regras (cupom só na barbearia que o criou;
// desconto sai do valor da barbearia). A taxa de 8% e a retenção usam o valor já com desconto.

export type Desconto = { tipo: 'percentual'; pct: number } | { tipo: 'fixo'; valor: Centavos }

export interface Cupom {
  barbeariaId: string
  desconto: Desconto
  servicoIds: string[] | 'todos'
  /** 0 = domingo … 6 = sábado. null: vale em qualquer dia. */
  diasSemana: number[] | null
  inicio: Date
  fim: Date
  limiteUsos: number | null
  umUsoPorCliente: boolean
}

export type MotivoCupomInvalido =
  | 'outra_barbearia'
  | 'fora_do_periodo'
  | 'dia_invalido'
  | 'servico_nao_abrangido'
  | 'esgotado'
  | 'ja_usado'

export type ResultadoCupom = { ok: true } | { ok: false; motivo: MotivoCupomInvalido }

export interface ItemDoPedido {
  servicoId: string
  preco: Centavos
}

export interface ValorComDesconto {
  valorBruto: Centavos
  desconto: Centavos
  valorPago: Centavos
}

export function validarCupom(params: {
  cupom: Cupom
  barbeariaId: string
  inicioDoAtendimento: Date
  /** Dia da semana do atendimento no fuso da barbearia (calculado pela API). */
  diaDaSemana: number
  servicoIds: string[]
  usosTotais: number
  usosDoCliente: number
}): ResultadoCupom {
  const { cupom } = params
  const quando = params.inicioDoAtendimento.getTime()

  if (cupom.barbeariaId !== params.barbeariaId) return invalido('outra_barbearia')
  if (quando < cupom.inicio.getTime() || quando > cupom.fim.getTime()) {
    return invalido('fora_do_periodo')
  }
  if (cupom.diasSemana && !cupom.diasSemana.includes(params.diaDaSemana)) {
    return invalido('dia_invalido')
  }
  if (!params.servicoIds.some((id) => abrange(cupom, id))) return invalido('servico_nao_abrangido')
  if (cupom.limiteUsos !== null && params.usosTotais >= cupom.limiteUsos) return invalido('esgotado')
  if (cupom.umUsoPorCliente && params.usosDoCliente > 0) return invalido('ja_usado')
  return { ok: true }
}

export function aplicarCupom(itens: ItemDoPedido[], cupom: Cupom): ValorComDesconto {
  const valorBruto = somaDosPrecos(itens)
  const abrangido = somaDosPrecos(itens.filter((i) => abrange(cupom, i.servicoId)))
  const desconto =
    cupom.desconto.tipo === 'percentual'
      ? percentualPraBaixo(abrangido, cupom.desconto.pct * 100)
      : Math.min(cupom.desconto.valor, abrangido)
  return { valorBruto, desconto, valorPago: valorBruto - desconto }
}

export function somaDosPrecos(itens: ItemDoPedido[]): Centavos {
  return itens.reduce((total, i) => total + i.preco, 0)
}

function abrange(cupom: Cupom, servicoId: string): boolean {
  return cupom.servicoIds === 'todos' || cupom.servicoIds.includes(servicoId)
}

function invalido(motivo: MotivoCupomInvalido): ResultadoCupom {
  return { ok: false, motivo }
}
