import { somaDosPrecos, type ItemDoPedido, type ValorComDesconto } from './cupom'
import type { EventoFinal } from './liquidacao'

// Fidelidade por barbearia: regras-de-negocio §Outras regras e §Decisões.
// O serviço grátis tem custo 100% da barbearia (sem taxa Navalha e sem repasse);
// no-show no corte grátis consome o prêmio.

export interface ConfigFidelidade {
  ativa: boolean
  cortesNecessarios: number
  servicoGratisId: string
}

export function temPremio(cortesConcluidos: number, config: ConfigFidelidade): boolean {
  return config.ativa && cortesConcluidos >= config.cortesNecessarios
}

export function atualizarFidelidade(
  cortesConcluidos: number,
  config: ConfigFidelidade,
  params: { evento: EventoFinal; usouPremio: boolean },
): number {
  if (!config.ativa) return cortesConcluidos

  if (params.usouPremio) {
    const consome = params.evento === 'concluido' || params.evento === 'no_show'
    return consome ? 0 : cortesConcluidos
  }

  if (params.evento === 'concluido') {
    return Math.min(cortesConcluidos + 1, config.cortesNecessarios)
  }
  return cortesConcluidos
}

export function aplicarPremio(itens: ItemDoPedido[], config: ConfigFidelidade): ValorComDesconto {
  const valorBruto = somaDosPrecos(itens)
  const gratis = itens.find((i) => i.servicoId === config.servicoGratisId)
  const desconto = gratis?.preco ?? 0
  return { valorBruto, desconto, valorPago: valorBruto - desconto }
}
