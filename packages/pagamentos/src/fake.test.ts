import { testarContratoPaymentProvider } from './contrato'
import { FakePaymentProvider } from './fake'

testarContratoPaymentProvider('FakePaymentProvider', async () => {
  const provider = new FakePaymentProvider()
  return {
    provider,
    simularPixPago: async (cobrancaId) => provider.simularPixPago(cobrancaId),
    cartaoAprovado: {
      numero: '4111111111111111',
      nomeImpresso: 'ZE',
      validade: '12/30',
      cvv: '123',
    },
    cartaoRecusado: {
      numero: FakePaymentProvider.CARTAO_RECUSADO,
      nomeImpresso: 'ZE',
      validade: '12/30',
      cvv: '123',
    },
  }
})
