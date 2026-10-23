import { describe, it } from 'vitest'
import { testarContratoPaymentProvider } from '../contrato'
import { AsaasProvider } from './provider'

// Contrato contra o sandbox do Asaas. Roda só com a chave da conta sandbox:
//   ASAAS_SANDBOX_CHAVE=$aact_... pnpm --filter @navalha/pagamentos test
// Cartões de teste do sandbox: https://docs.asaas.com (seção "Testando pagamentos").
const chave = process.env.ASAAS_SANDBOX_CHAVE
const urlBase = process.env.ASAAS_SANDBOX_URL ?? 'https://api-sandbox.asaas.com/v3'

if (!chave) {
  describe('contrato do PaymentProvider: sandbox do Asaas', () => {
    it.skip('precisa de ASAAS_SANDBOX_CHAVE (conta sandbox do Asaas, bloqueio externo da fase 3)', () => {})
  })
} else {
  testarContratoPaymentProvider(
    'AsaasProvider (sandbox)',
    async () => {
      const chavesDasSubcontas = new Map<string, string>()
      const base = new AsaasProvider({
        urlBase,
        chavePrincipal: chave,
        chaveDaSubconta: async (id) => {
          const chaveDaSubconta = chavesDasSubcontas.get(id)
          if (!chaveDaSubconta) throw new Error(`Chave da subconta ${id} desconhecida`)
          return chaveDaSubconta
        },
      })
      const provider = Object.assign(Object.create(base) as AsaasProvider, {
        criarSubconta: async (dados: Parameters<AsaasProvider['criarSubconta']>[0]) => {
          const subconta = await base.criarSubconta(dados)
          chavesDasSubcontas.set(subconta.subcontaId, subconta.chaveApi)
          return subconta
        },
      })
      return {
        provider,
        // Validar no sandbox: endpoint de confirmação de Pix de teste.
        simularPixPago: async ({ subcontaId, cobrancaId }) => {
          const resposta = await fetch(`${urlBase}/sandbox/payment/${cobrancaId}/confirm`, {
            method: 'POST',
            headers: {
              access_token: chavesDasSubcontas.get(subcontaId) ?? '',
              'User-Agent': 'navalha/1.0',
            },
          })
          if (!resposta.ok) throw new Error(`Sandbox não confirmou o Pix: ${resposta.status}`)
        },
        cartaoAprovado: {
          numero: '4444444444444444',
          nomeImpresso: 'LUCAS A',
          validade: '12/30',
          cvv: '123',
        },
        cartaoRecusado: {
          numero: '5184019740373151',
          nomeImpresso: 'LUCAS A',
          validade: '12/30',
          cvv: '123',
        },
        titular: {
          nome: 'Lucas Andrade',
          email: 'lucas@exemplo.com',
          cpfCnpj: gerarCpf(),
          cep: '05413000',
          numeroEndereco: '120',
          celular: '11987654321',
        },
        subconta: {
          nome: 'Barbearia Teste',
          email: `teste-${Date.now()}@navalha.app`,
          cpfCnpj: gerarCnpj(),
          celular: '11912345678',
          faturamentoMensal: 2000000,
          endereco: {
            logradouro: 'Rua Augusta',
            numero: '120',
            bairro: 'Pinheiros',
            cep: '05413000',
          },
        },
      }
    },
    { timeout: 60_000 },
  )
}

function digito(numeros: number[], pesos: number[]): number {
  const resto = numeros.reduce((soma, n, i) => soma + n * (pesos[i] ?? 0), 0) % 11
  return resto < 2 ? 0 : 11 - resto
}

function aleatorios(quantidade: number): number[] {
  return Array.from({ length: quantidade }, () => Math.floor(Math.random() * 10))
}

function gerarCpf(): string {
  const base = aleatorios(9)
  const d1 = digito(base, [10, 9, 8, 7, 6, 5, 4, 3, 2])
  const d2 = digito([...base, d1], [11, 10, 9, 8, 7, 6, 5, 4, 3, 2])
  return [...base, d1, d2].join('')
}

function gerarCnpj(): string {
  const base = [...aleatorios(8), 0, 0, 0, 1]
  const d1 = digito(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  const d2 = digito([...base, d1], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  return [...base, d1, d2].join('')
}
