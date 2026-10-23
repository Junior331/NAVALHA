import { describe, expect, it } from 'vitest'
import { testarContratoPaymentProvider } from '../contrato'
import { ErroPagamento } from '../provider'
import { AsaasProvider, tipoDaChavePix } from './provider'
import { CARTAO_RECUSADO_DE_MENTIRA, criarAsaasDeMentira } from './servidor-de-mentira'

const titular = {
  nome: 'Lucas Andrade',
  email: 'lucas@exemplo.com',
  cpfCnpj: '24971563792',
  cep: '05413000',
  numeroEndereco: '120',
  celular: '11987654321',
}

const subconta = {
  nome: 'Barbearia do Zé',
  email: 'ze@barbeariadoze.com',
  cpfCnpj: '66625514000140',
  celular: '11912345678',
  faturamentoMensal: 2000000,
  endereco: { logradouro: 'Rua Augusta', numero: '120', bairro: 'Pinheiros', cep: '05413000' },
}

function montar() {
  const asaas = criarAsaasDeMentira({ chavePrincipal: 'chave-principal' })
  const provider = new AsaasProvider({
    urlBase: 'https://asaas.teste/v3',
    chavePrincipal: 'chave-principal',
    chaveDaSubconta: async (subcontaId) => asaas.chaveDaSubconta(subcontaId),
    fetch: asaas.fetch,
  })
  return { asaas, provider }
}

testarContratoPaymentProvider('AsaasProvider (servidor de mentira)', async () => {
  const { asaas, provider } = montar()
  return {
    provider,
    simularPixPago: async ({ cobrancaId }) => asaas.confirmarPix(cobrancaId),
    cartaoAprovado: {
      numero: '4111111111111111',
      nomeImpresso: 'LUCAS A',
      validade: '12/30',
      cvv: '123',
    },
    cartaoRecusado: {
      numero: CARTAO_RECUSADO_DE_MENTIRA,
      nomeImpresso: 'LUCAS A',
      validade: '12/30',
      cvv: '123',
    },
    titular,
    subconta,
  }
})

describe('AsaasProvider: detalhes da integração', () => {
  it('autentica com access_token, manda User-Agent e usa a chave da subconta nas cobranças', async () => {
    const { asaas, provider } = montar()
    const { subcontaId } = await provider.criarSubconta(subconta)
    await provider.garantirCliente({ subcontaId, cliente: { referencia: 'c1', nome: 'Lucas' } })

    const [criarConta, buscarCliente] = asaas.requisicoes
    expect(criarConta?.headers['access_token']).toBe('chave-principal')
    expect(criarConta?.headers['user-agent']).toMatch(/navalha/i)
    expect(buscarCliente?.headers['access_token']).toBe(asaas.chaveDaSubconta(subcontaId))
  })

  it('converte centavos em reais na ida e reais em centavos na volta', async () => {
    const { asaas, provider } = montar()
    const { subcontaId } = await provider.criarSubconta(subconta)
    const { clienteId } = await provider.garantirCliente({
      subcontaId,
      cliente: { referencia: 'c1', nome: 'Lucas' },
    })
    const pix = await provider.criarCobrancaPix({
      subcontaId,
      clienteId,
      valor: 7050,
      expiraEm: new Date('2026-10-24T13:10:00Z'),
      referencia: 'reserva-1',
    })
    const criarPagamento = asaas.requisicoes.find(
      (r) => r.metodo === 'POST' && r.caminho === '/payments',
    )
    expect(criarPagamento?.corpo).toMatchObject({
      billingType: 'PIX',
      value: 70.5,
      externalReference: 'reserva-1',
    })
    expect(pix.valor).toBe(7050)
  })

  it('manda os dados do titular exigidos pelo Asaas na tokenização', async () => {
    const { asaas, provider } = montar()
    const { subcontaId } = await provider.criarSubconta(subconta)
    const { clienteId } = await provider.garantirCliente({
      subcontaId,
      cliente: { referencia: 'c1', nome: 'Lucas' },
    })
    await provider.tokenizarCartao({
      subcontaId,
      clienteId,
      cartao: {
        numero: '4111111111111111',
        nomeImpresso: 'LUCAS A',
        validade: '12/30',
        cvv: '123',
      },
      titular,
      ipRemoto: '200.100.50.25',
    })
    const tokenizar = asaas.requisicoes.find((r) => r.caminho === '/creditCard/tokenize')
    expect(tokenizar?.corpo).toMatchObject({
      customer: clienteId,
      creditCard: {
        holderName: 'LUCAS A',
        number: '4111111111111111',
        expiryMonth: '12',
        expiryYear: '2030',
        ccv: '123',
      },
      creditCardHolderInfo: {
        cpfCnpj: '24971563792',
        postalCode: '05413000',
        addressNumber: '120',
      },
      remoteIp: '200.100.50.25',
    })
  })

  it('erro 400 do Asaas vira ErroPagamento com a descrição', async () => {
    const { provider } = montar()
    await expect(provider.criarSubconta({ ...subconta, cpfCnpj: '' })).rejects.toMatchObject({
      name: 'ErroPagamento',
      codigo: 'dados_invalidos',
    })
  })

  it('falha de rede vira gateway_indisponivel', async () => {
    const provider = new AsaasProvider({
      urlBase: 'https://asaas.teste/v3',
      chavePrincipal: 'x',
      chaveDaSubconta: async () => 'y',
      fetch: async () => {
        throw new TypeError('fetch failed')
      },
    })
    await expect(provider.criarSubconta(subconta)).rejects.toMatchObject({
      codigo: 'gateway_indisponivel',
    })
    await expect(provider.criarSubconta(subconta)).rejects.toBeInstanceOf(ErroPagamento)
  })
})

describe('tipoDaChavePix', () => {
  it.each([
    ['financeiro@navalha.app', 'EMAIL'],
    ['12345678901', 'CPF'],
    ['12345678000199', 'CNPJ'],
    ['+5511912345678', 'PHONE'],
    ['3f2a1b7c-9d4e-4f6a-8b2c-1d3e5f7a9b0c', 'EVP'],
  ])('%s é %s', (chave, tipo) => {
    expect(tipoDaChavePix(chave)).toBe(tipo)
  })
})
