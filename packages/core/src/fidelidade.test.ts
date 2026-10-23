import { describe, expect, it } from 'vitest'
import { aplicarPremio, atualizarFidelidade, temPremio, type ConfigFidelidade } from './fidelidade'

// regras-de-negocio §Outras regras e §Decisões: fidelidade opcional, ligada pela barbearia;
// o serviço grátis tem custo 100% da barbearia; no-show no corte grátis consome o prêmio.
// Figma Cliente 01: "3/5 · Mais 2 cortes e o próximo é por conta da casa".
const config: ConfigFidelidade = { ativa: true, cortesNecessarios: 5, servicoGratisId: 'corte' }

describe('temPremio', () => {
  it('libera o prêmio ao completar os cortes necessários', () => {
    expect(temPremio(4, config)).toBe(false)
    expect(temPremio(5, config)).toBe(true)
  })

  it('fidelidade desligada nunca dá prêmio', () => {
    expect(temPremio(10, { ...config, ativa: false })).toBe(false)
  })
})

describe('atualizarFidelidade', () => {
  it('atendimento concluído soma um corte, até o limite', () => {
    expect(atualizarFidelidade(3, config, { evento: 'concluido', usouPremio: false })).toBe(4)
    expect(atualizarFidelidade(5, config, { evento: 'concluido', usouPremio: false })).toBe(5)
  })

  it('usar o prêmio zera a contagem', () => {
    expect(atualizarFidelidade(5, config, { evento: 'concluido', usouPremio: true })).toBe(0)
  })

  it('no-show no corte grátis consome o prêmio', () => {
    expect(atualizarFidelidade(5, config, { evento: 'no_show', usouPremio: true })).toBe(0)
  })

  it('no-show e cancelamentos sem prêmio não mudam a contagem', () => {
    for (const evento of ['no_show', 'cancelado_no_prazo', 'cancelado_fora_do_prazo'] as const) {
      expect(atualizarFidelidade(3, config, { evento, usouPremio: false })).toBe(3)
    }
  })

  it('cancelar no prazo devolve o prêmio (não consome)', () => {
    expect(atualizarFidelidade(5, config, { evento: 'cancelado_no_prazo', usouPremio: true })).toBe(5)
  })

  it('fidelidade desligada não conta', () => {
    expect(
      atualizarFidelidade(3, { ...config, ativa: false }, { evento: 'concluido', usouPremio: false }),
    ).toBe(3)
  })
})

describe('aplicarPremio', () => {
  it('o serviço grátis sai de graça e o resto é cobrado', () => {
    expect(
      aplicarPremio(
        [
          { servicoId: 'corte', preco: 4000 },
          { servicoId: 'barba', preco: 3000 },
        ],
        config,
      ),
    ).toEqual({ valorBruto: 7000, desconto: 4000, valorPago: 3000 })
  })

  it('sem o serviço grátis no pedido, não há desconto', () => {
    expect(aplicarPremio([{ servicoId: 'barba', preco: 3000 }], config).desconto).toBe(0)
  })
})
