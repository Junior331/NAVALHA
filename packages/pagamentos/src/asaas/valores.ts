import type { Centavos } from '@navalha/core'

// O Asaas trabalha com reais em número decimal; o Navalha, com centavos inteiros.

export function paraReais(valor: Centavos): number {
  return valor / 100
}

export function paraCentavos(reais: number): Centavos {
  return Math.round(reais * 100)
}
