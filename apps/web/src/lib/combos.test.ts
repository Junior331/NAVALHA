import { describe, expect, it } from 'vitest'
import { avulsoRepetido, comboMaisBarato } from './combos'

// Backlog Cliente 07, com os preços da Barbearia do Zé: Corte + Barba (R$ 55) + Sobrancelha
// (R$ 15) = R$ 70, contra o combo de R$ 65.
const corteBarba = { id: 'cb', nome: 'Corte + Barba', precoCentavos: 5500 }
const completo = { id: 'cbs', nome: 'Corte + Barba + Sobrancelha', precoCentavos: 6500 }
const sobrancelha = { id: 's', nome: 'Sobrancelha', precoCentavos: 1500 }
const barba = { id: 'b', nome: 'Barba', precoCentavos: 3000 }
const todos = [corteBarba, completo, sobrancelha, barba]

describe('comboMaisBarato', () => {
  it('sugere o combo que cobre os itens escolhidos e sai mais barato', () => {
    expect(comboMaisBarato([corteBarba, sobrancelha], todos)).toEqual({
      combo: completo,
      economiaCentavos: 500,
    })
  })

  it('não sugere nada quando não há combo equivalente', () => {
    expect(comboMaisBarato([barba, sobrancelha], todos)).toBeNull()
    expect(comboMaisBarato([sobrancelha], todos)).toBeNull()
  })
})

describe('avulsoRepetido', () => {
  it('avisa quando o combo já inclui o avulso escolhido', () => {
    expect(avulsoRepetido([corteBarba, barba])).toEqual({ combo: corteBarba, avulso: barba })
  })

  it('combo com um avulso que ele não inclui é permitido', () => {
    expect(avulsoRepetido([corteBarba, sobrancelha])).toBeNull()
  })
})
