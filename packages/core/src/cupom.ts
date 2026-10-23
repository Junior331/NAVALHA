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
  if (cupom.limiteUsos !== null && params.usosTotais >= cupom.limiteUsos)
    return invalido('esgotado')
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

/**
 * Oferta automática (Admin 07, tipo "automática"): vale sem código. Entre as que valem para o
 * pedido, fica a de maior desconto; não soma com cupom nem com outra oferta.
 */
export function melhorOferta(
  ofertas: { id: string; cupom: Cupom; usosTotais: number; usosDoCliente: number }[],
  pedido: {
    barbeariaId: string
    inicioDoAtendimento: Date
    diaDaSemana: number
    itens: ItemDoPedido[]
  },
): { promocaoId: string; valor: ValorComDesconto } | null {
  let melhor: { promocaoId: string; valor: ValorComDesconto } | null = null
  for (const oferta of ofertas) {
    const validacao = validarCupom({
      cupom: oferta.cupom,
      barbeariaId: pedido.barbeariaId,
      inicioDoAtendimento: pedido.inicioDoAtendimento,
      diaDaSemana: pedido.diaDaSemana,
      servicoIds: pedido.itens.map((i) => i.servicoId),
      usosTotais: oferta.usosTotais,
      usosDoCliente: oferta.usosDoCliente,
    })
    if (!validacao.ok) continue
    const valor = aplicarCupom(pedido.itens, oferta.cupom)
    if (valor.desconto > 0 && (!melhor || valor.desconto > melhor.valor.desconto)) {
      melhor = { promocaoId: oferta.id, valor }
    }
  }
  return melhor
}

function abrange(cupom: Cupom, servicoId: string): boolean {
  return cupom.servicoIds === 'todos' || cupom.servicoIds.includes(servicoId)
}

function invalido(motivo: MotivoCupomInvalido): ResultadoCupom {
  return { ok: false, motivo }
}

/** Preço do serviço com o desconto cadastrado no próprio serviço (Admin 05 e 05c). */
export function precoDoServico(preco: Centavos, desconto: Desconto | null): Centavos {
  if (!desconto) return preco
  if (desconto.tipo === 'percentual') return preco - percentualPraBaixo(preco, desconto.pct * 100)
  return Math.max(0, preco - desconto.valor)
}
