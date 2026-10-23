/** Valor monetário em centavos inteiros. Nunca use reais com ponto flutuante nas regras. */
export type Centavos = number

/** 100% em pontos-base. 800 pontos-base = 8%. */
export const CEM_POR_CENTO = 10000

export function centavos(valor: number): Centavos {
  if (!Number.isSafeInteger(valor) || valor < 0) {
    throw new RangeError(`Valor em centavos inválido: ${valor}`)
  }
  return valor
}

export function deReais(reais: number): Centavos {
  return centavos(Math.round(reais * 100))
}

/**
 * Aplica um percentual em pontos-base e arredonda para baixo.
 * Regra provisória de arredondamento (decisão em aberto no roadmap):
 * a parte calculada fica com o centavo a menos, e a sobra vai para quem recebe o restante.
 */
export function percentualPraBaixo(valor: Centavos, pontosBase: number): Centavos {
  if (!Number.isInteger(pontosBase) || pontosBase < 0 || pontosBase > CEM_POR_CENTO) {
    throw new RangeError(`Percentual inválido em pontos-base: ${pontosBase}`)
  }
  return Math.floor((centavos(valor) * pontosBase) / CEM_POR_CENTO)
}

export function somar(...valores: Centavos[]): Centavos {
  return valores.reduce((total, valor) => total + valor, 0)
}
