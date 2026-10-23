import { centavos, percentualPraBaixo, type Centavos } from './money'

// Liquidação no evento final: regras-de-negocio §Cenários de liquidação, §Política de
// cancelamento e §Decisões. Cada evento final tem uma única regra de divisão.

export type Plano = 'free' | 'basic' | 'pro'
export type MeioPagamento = 'pix' | 'cartao'
export type EventoFinal =
  | 'concluido'
  | 'cancelado_no_prazo'
  | 'cancelado_fora_do_prazo'
  | 'no_show'
  | 'cancelado_pela_barbearia'
export type EscolhaPixNoPrazo = 'credito' | 'reembolso'
export type PagadorGateway = 'barbearia' | 'navalha' | 'cliente' | 'ninguem'

export interface EntradaLiquidacao {
  evento: EventoFinal
  plano: Plano
  meio: MeioPagamento
  /** Valor efetivamente pago pelo cliente, já com o desconto do cupom. */
  valorPago: Centavos
  /** % retido no cancelamento tardio e no no-show, configurado pela barbearia (0 a 100). */
  retencaoPct: number
  /** G: taxa do gateway sobre a transação capturada. */
  taxaGateway: Centavos
  /** Custo do estorno quando a barbearia cancela. */
  custoEstorno?: Centavos
  /** Cancelamento no prazo via Pix: crédito de 100% ou reembolso descontando o custo do Pix. */
  escolhaPix?: EscolhaPixNoPrazo
  custoPix?: Centavos
}

export interface Liquidacao {
  /** Valor que volta ao cliente (estorno, ou pré-autorização não capturada). */
  devolvidoAoCliente: Centavos
  /** Crédito do cliente na barbearia. */
  creditoAoCliente: Centavos
  /** Pode ser negativo: a barbearia paga o custo do estorno quando cancela. */
  barbearia: number
  /** Pode ser negativo: G sai da parte da Navalha no cancelamento tardio e no no-show. */
  navalha: number
  /** Total de tarifas do gateway nesta liquidação (G, custo do estorno ou do Pix). */
  custoGateway: Centavos
  quemPagaGateway: PagadorGateway
}

const TAXA_FREE_PB = 800 // 8% sobre o bruto (regras-de-negocio §Decisões)
const PARTE_NAVALHA_NO_RETIDO_PB = 2000 // 20% do valor retido

export function liquidar(entrada: EntradaLiquidacao): Liquidacao {
  const valor = centavos(entrada.valorPago)
  const g = centavos(entrada.taxaGateway)
  validarRetencao(entrada.retencaoPct)

  switch (entrada.evento) {
    case 'concluido': {
      const navalha = entrada.plano === 'free' ? percentualPraBaixo(valor, TAXA_FREE_PB) : 0
      return resultado({ barbearia: valor - navalha - g, navalha, custoGateway: g }, 'barbearia')
    }

    case 'cancelado_no_prazo':
      return cancelamentoNoPrazo(entrada, valor)

    case 'cancelado_fora_do_prazo':
    case 'no_show': {
      const retido = percentualPraBaixo(valor, entrada.retencaoPct * 100)
      const parteNavalha = percentualPraBaixo(retido, PARTE_NAVALHA_NO_RETIDO_PB)
      return resultado(
        {
          devolvidoAoCliente: valor - retido,
          barbearia: retido - parteNavalha,
          navalha: parteNavalha - g,
          custoGateway: g,
        },
        'navalha',
      )
    }

    case 'cancelado_pela_barbearia': {
      const custo = centavos(entrada.custoEstorno ?? 0)
      return resultado(
        { devolvidoAoCliente: valor, barbearia: -custo, custoGateway: custo },
        'barbearia',
      )
    }
  }
}

function cancelamentoNoPrazo(entrada: EntradaLiquidacao, valor: Centavos): Liquidacao {
  // Cartão: pré-autorizado e só capturado no fim do prazo grátis, então nada foi cobrado.
  if (entrada.meio === 'cartao') {
    return resultado({ devolvidoAoCliente: valor }, 'ninguem')
  }

  if (entrada.escolhaPix === 'credito') {
    return resultado({ creditoAoCliente: valor }, 'ninguem')
  }
  if (entrada.escolhaPix === 'reembolso') {
    const custoPix = centavos(entrada.custoPix ?? 0)
    if (custoPix > valor) {
      throw new RangeError('O custo do Pix não pode ser maior que o valor pago')
    }
    return resultado({ devolvidoAoCliente: valor - custoPix, custoGateway: custoPix }, 'cliente')
  }
  throw new Error('Cancelamento no prazo via Pix exige a escolha entre crédito e reembolso')
}

function resultado(partes: Partial<Liquidacao>, pagador: PagadorGateway): Liquidacao {
  const custoGateway = partes.custoGateway ?? 0
  return {
    devolvidoAoCliente: partes.devolvidoAoCliente ?? 0,
    creditoAoCliente: partes.creditoAoCliente ?? 0,
    barbearia: partes.barbearia ?? 0,
    navalha: partes.navalha ?? 0,
    custoGateway,
    quemPagaGateway: custoGateway === 0 ? 'ninguem' : pagador,
  }
}

function validarRetencao(pct: number): void {
  if (!Number.isInteger(pct) || pct < 0 || pct > 100) {
    throw new RangeError(`Retenção inválida: ${pct}%`)
  }
}
