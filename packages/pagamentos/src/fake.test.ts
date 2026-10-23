import { testarContratoPaymentProvider } from './contrato'
import { FakePaymentProvider } from './fake'

testarContratoPaymentProvider('FakePaymentProvider', async () => {
  const provider = new FakePaymentProvider()
  return {
    provider,
    simularPixPago: async ({ cobrancaId }) => provider.simularPixPago(cobrancaId),
    cartaoAprovado: {
      numero: '4111111111111111',
      nomeImpresso: 'LUCAS ANDRADE',
      validade: '12/30',
      cvv: '123',
    },
    cartaoRecusado: {
      numero: FakePaymentProvider.CARTAO_RECUSADO,
      nomeImpresso: 'LUCAS ANDRADE',
      validade: '12/30',
      cvv: '123',
    },
    titular: {
      nome: 'Lucas Andrade',
      email: 'lucas@exemplo.com',
      cpfCnpj: '24971563792',
      cep: '05413000',
      numeroEndereco: '120',
      celular: '11987654321',
    },
    subconta: {
      nome: 'Barbearia do Zé',
      email: 'ze@barbeariadoze.com',
      cpfCnpj: '66625514000140',
      celular: '11912345678',
      faturamentoMensal: 2000000,
      endereco: { logradouro: 'Rua Augusta', numero: '120', bairro: 'Pinheiros', cep: '05413000' },
    },
  }
})
