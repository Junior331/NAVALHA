import type { Centavos } from '@navalha/core'
import {
  ErroPagamento,
  type CartaoTokenizado,
  type ClienteDoGateway,
  type Cobranca,
  type CobrancaPix,
  type DadosCartao,
  type DadosSubconta,
  type PaymentProvider,
  type StatusCobranca,
  type TitularCartao,
} from '../provider'
import { paraCentavos, paraReais } from './valores'

// Adaptador da API v3 do Asaas. Cada barbearia tem uma subconta com chave de API própria; as
// cobranças são feitas com a chave da subconta, sem split (regras-de-negocio §Implementação no
// Asaas). Pontos marcados "validar no sandbox" dependem de confirmação na conta real
// (docs/roadmap.md, fase 3, bloqueios externos).

export interface ConfigAsaas {
  /** https://api.asaas.com/v3 em produção; https://api-sandbox.asaas.com/v3 no sandbox. */
  urlBase: string
  chavePrincipal: string
  chaveDaSubconta: (subcontaId: string) => Promise<string>
  fetch?: typeof fetch
}

interface PagamentoAsaas {
  id: string
  status: string
  value: number
  netValue?: number
  billingType: string
  externalReference?: string | null
  confirmedDate?: string | null
  deleted?: boolean
}

interface EstornoAsaas {
  value: number
  status: string
}

interface ErroAsaas {
  errors?: { code?: string; description?: string }[]
}

const USER_AGENT = 'navalha/1.0 (+https://navalha.app)'

export class AsaasProvider implements PaymentProvider {
  private readonly fetch: typeof fetch

  constructor(private readonly config: ConfigAsaas) {
    this.fetch = config.fetch ?? globalThis.fetch
  }

  async criarSubconta(
    dados: DadosSubconta,
  ): Promise<{ subcontaId: string; walletId: string; chaveApi: string }> {
    const conta = await this.chamar<{ id: string; walletId: string; apiKey: string }>(
      this.config.chavePrincipal,
      'POST',
      '/accounts',
      {
        name: dados.nome,
        email: dados.email,
        cpfCnpj: dados.cpfCnpj,
        mobilePhone: dados.celular,
        incomeValue: paraReais(dados.faturamentoMensal),
        address: dados.endereco.logradouro,
        addressNumber: dados.endereco.numero,
        province: dados.endereco.bairro,
        postalCode: dados.endereco.cep,
      },
    )
    return { subcontaId: conta.id, walletId: conta.walletId, chaveApi: conta.apiKey }
  }

  // Validar no sandbox: configuração da Conta Escrow por subconta.
  async habilitarEscrow(params: { subcontaId: string }): Promise<void> {
    await this.chamar(this.config.chavePrincipal, 'POST', `/accounts/${params.subcontaId}/escrow`, {
      enabled: true,
    })
  }

  async garantirCliente(params: {
    subcontaId: string
    cliente: ClienteDoGateway
  }): Promise<{ clienteId: string }> {
    const chave = await this.config.chaveDaSubconta(params.subcontaId)
    const encontrados = await this.chamar<{ data: { id: string }[] }>(
      chave,
      'GET',
      `/customers?externalReference=${encodeURIComponent(params.cliente.referencia)}`,
    )
    const existente = encontrados.data[0]
    if (existente) return { clienteId: existente.id }

    const criado = await this.chamar<{ id: string }>(chave, 'POST', '/customers', {
      name: params.cliente.nome,
      email: params.cliente.email,
      mobilePhone: params.cliente.celular,
      cpfCnpj: params.cliente.cpfCnpj,
      externalReference: params.cliente.referencia,
      notificationDisabled: true,
    })
    return { clienteId: criado.id }
  }

  async criarCobrancaPix(params: {
    subcontaId: string
    clienteId: string
    valor: Centavos
    expiraEm: Date
    referencia: string
  }): Promise<CobrancaPix> {
    validarValor(params.valor)
    const chave = await this.config.chaveDaSubconta(params.subcontaId)
    const pagamento =
      (await this.buscarPorReferencia(chave, params.referencia)) ??
      (await this.chamar<PagamentoAsaas>(chave, 'POST', '/payments', {
        customer: params.clienteId,
        billingType: 'PIX',
        value: paraReais(params.valor),
        dueDate: dataISO(params.expiraEm),
        externalReference: params.referencia,
        description: 'Agendamento Navalha',
      }))
    const qr = await this.chamar<{ encodedImage: string; payload: string }>(
      chave,
      'GET',
      `/payments/${pagamento.id}/pixQrCode`,
    )
    return {
      ...mapear(pagamento),
      meio: 'pix',
      copiaECola: qr.payload,
      qrCodeBase64: qr.encodedImage,
      expiraEm: params.expiraEm,
    }
  }

  async cancelarCobranca(params: { subcontaId: string; cobrancaId: string }): Promise<Cobranca> {
    const chave = await this.config.chaveDaSubconta(params.subcontaId)
    const pagamento = await this.pagamento(chave, params.cobrancaId)
    exigir(mapear(pagamento), ['aguardando_pagamento'])
    await this.chamar(chave, 'DELETE', `/payments/${params.cobrancaId}`)
    return { ...mapear(pagamento), status: 'cancelada' }
  }

  async tokenizarCartao(params: {
    subcontaId: string
    clienteId: string
    cartao: DadosCartao
    titular: TitularCartao
    ipRemoto: string
  }): Promise<CartaoTokenizado> {
    const chave = await this.config.chaveDaSubconta(params.subcontaId)
    const [mes = '', ano = ''] = params.cartao.validade.split('/')
    const resposta = await this.chamar<{
      creditCardNumber: string
      creditCardBrand: string
      creditCardToken: string
    }>(chave, 'POST', '/creditCard/tokenize', {
      customer: params.clienteId,
      creditCard: {
        holderName: params.cartao.nomeImpresso,
        number: params.cartao.numero,
        expiryMonth: mes.padStart(2, '0'),
        expiryYear: ano.length === 2 ? `20${ano}` : ano,
        ccv: params.cartao.cvv,
      },
      creditCardHolderInfo: {
        name: params.titular.nome,
        email: params.titular.email,
        cpfCnpj: params.titular.cpfCnpj,
        postalCode: params.titular.cep,
        addressNumber: params.titular.numeroEndereco,
        mobilePhone: params.titular.celular,
      },
      remoteIp: params.ipRemoto,
    })
    return {
      token: resposta.creditCardToken,
      final: resposta.creditCardNumber.slice(-4),
      bandeira: resposta.creditCardBrand,
    }
  }

  async preAutorizar(params: {
    subcontaId: string
    clienteId: string
    token: string
    valor: Centavos
    referencia: string
    ipRemoto: string
  }): Promise<Cobranca> {
    validarValor(params.valor)
    const chave = await this.config.chaveDaSubconta(params.subcontaId)
    const existente = await this.buscarPorReferencia(chave, params.referencia)
    if (existente) return mapear(existente)

    try {
      const pagamento = await this.chamar<PagamentoAsaas>(chave, 'POST', '/payments', {
        customer: params.clienteId,
        billingType: 'CREDIT_CARD',
        value: paraReais(params.valor),
        dueDate: dataISO(new Date()),
        externalReference: params.referencia,
        creditCardToken: params.token,
        authorizeOnly: true,
        remoteIp: params.ipRemoto,
      })
      return mapear(pagamento)
    } catch (erro) {
      // Cartão recusado volta como 400 na criação da cobrança, sem cobrança criada.
      if (erro instanceof ErroPagamento && erro.codigo === 'dados_invalidos') {
        return {
          cobrancaId: '',
          referencia: params.referencia,
          meio: 'cartao',
          valor: params.valor,
          status: 'recusada',
          valorEstornado: 0,
          taxaGateway: 0,
          retencaoLiberada: false,
          motivoRecusa: erro.message,
        }
      }
      throw erro
    }
  }

  async capturar(params: { subcontaId: string; cobrancaId: string }): Promise<Cobranca> {
    const chave = await this.config.chaveDaSubconta(params.subcontaId)
    exigir(mapear(await this.pagamento(chave, params.cobrancaId)), ['pre_autorizada'])
    const capturado = await this.chamar<PagamentoAsaas>(
      chave,
      'POST',
      `/payments/${params.cobrancaId}/captureAuthorizedPayment`,
    )
    return mapear(capturado)
  }

  // Validar no sandbox: cancelar a pré-autorização pelo endpoint de estorno.
  async cancelarPreAutorizacao(params: {
    subcontaId: string
    cobrancaId: string
  }): Promise<Cobranca> {
    const chave = await this.config.chaveDaSubconta(params.subcontaId)
    exigir(mapear(await this.pagamento(chave, params.cobrancaId)), ['pre_autorizada'])
    const cancelado = await this.chamar<PagamentoAsaas>(
      chave,
      'POST',
      `/payments/${params.cobrancaId}/refund`,
    )
    return { ...mapear(cancelado), status: 'pre_autorizacao_cancelada', taxaGateway: 0 }
  }

  async estornar(params: {
    subcontaId: string
    cobrancaId: string
    valor?: Centavos
  }): Promise<Cobranca> {
    const chave = await this.config.chaveDaSubconta(params.subcontaId)
    const atual = await this.cobrancaCompleta(chave, params.cobrancaId)
    exigir(atual, ['paga', 'capturada', 'estornada_parcialmente'])
    const restante = atual.valor - atual.valorEstornado
    const valor = params.valor ?? restante
    validarValor(valor)
    if (valor > restante) {
      throw new ErroPagamento('valor_invalido', 'Estorno maior que o valor restante')
    }
    await this.chamar(chave, 'POST', `/payments/${params.cobrancaId}/refund`, {
      value: paraReais(valor),
    })
    return this.cobrancaCompleta(chave, params.cobrancaId)
  }

  // Validar no sandbox: consulta e finalização da garantia (Escrow) da cobrança.
  async liberarRetencao(params: { subcontaId: string; cobrancaId: string }): Promise<Cobranca> {
    const chave = await this.config.chaveDaSubconta(params.subcontaId)
    const atual = await this.cobrancaCompleta(chave, params.cobrancaId)
    if (atual.retencaoLiberada) return atual
    exigir(atual, ['paga', 'capturada', 'estornada_parcialmente'])
    const escrow = await this.chamar<{ id: string }>(
      chave,
      'GET',
      `/payments/${params.cobrancaId}/escrow`,
    )
    await this.chamar(chave, 'POST', `/escrow/${escrow.id}/finish`)
    return this.cobrancaCompleta(chave, params.cobrancaId)
  }

  async transferirPix(params: {
    subcontaId: string
    chavePix: string
    valor: Centavos
    referencia: string
  }): Promise<{ transferenciaId: string }> {
    validarValor(params.valor)
    const chave = await this.config.chaveDaSubconta(params.subcontaId)
    const transferencia = await this.chamar<{ id: string }>(chave, 'POST', '/transfers', {
      value: paraReais(params.valor),
      operationType: 'PIX',
      pixAddressKey: params.chavePix,
      pixAddressKeyType: tipoDaChavePix(params.chavePix),
      description: 'Taxa Navalha',
      externalReference: params.referencia,
    })
    return { transferenciaId: transferencia.id }
  }

  async consultarCobranca(params: { subcontaId: string; cobrancaId: string }): Promise<Cobranca> {
    const chave = await this.config.chaveDaSubconta(params.subcontaId)
    return this.cobrancaCompleta(chave, params.cobrancaId)
  }

  private async cobrancaCompleta(chave: string, cobrancaId: string): Promise<Cobranca> {
    const pagamento = await this.pagamento(chave, cobrancaId)
    const [estornos, escrow] = await Promise.all([
      this.chamar<{ data: EstornoAsaas[] }>(chave, 'GET', `/payments/${cobrancaId}/refunds`),
      this.chamar<{ status?: string }>(chave, 'GET', `/payments/${cobrancaId}/escrow`).catch(
        () => ({ status: undefined }),
      ),
    ])
    const valorEstornado = estornos.data
      .filter((e) => e.status !== 'CANCELLED')
      .reduce((total, e) => total + paraCentavos(e.value), 0)
    return mapear(pagamento, { valorEstornado, retencaoLiberada: escrow.status === 'DONE' })
  }

  private async pagamento(chave: string, cobrancaId: string): Promise<PagamentoAsaas> {
    return this.chamar<PagamentoAsaas>(chave, 'GET', `/payments/${cobrancaId}`)
  }

  private async buscarPorReferencia(
    chave: string,
    referencia: string,
  ): Promise<PagamentoAsaas | undefined> {
    const encontrados = await this.chamar<{ data: PagamentoAsaas[] }>(
      chave,
      'GET',
      `/payments?externalReference=${encodeURIComponent(referencia)}`,
    )
    return encontrados.data.find((p) => !p.deleted)
  }

  private async chamar<T>(
    chave: string,
    metodo: string,
    caminho: string,
    corpo?: unknown,
  ): Promise<T> {
    let resposta: Response
    try {
      resposta = await this.fetch(`${this.config.urlBase}${caminho}`, {
        method: metodo,
        headers: {
          access_token: chave,
          'Content-Type': 'application/json',
          'User-Agent': USER_AGENT,
        },
        ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
      })
    } catch (erro) {
      throw new ErroPagamento('gateway_indisponivel', `Asaas indisponível: ${String(erro)}`)
    }

    if (resposta.ok) return (await resposta.json()) as T

    const detalhe = (await resposta.json().catch(() => ({}))) as ErroAsaas
    const descricao = detalhe.errors
      ?.map((e) => e.description)
      .filter(Boolean)
      .join('; ')
    const mensagem = descricao || `Asaas respondeu ${resposta.status} em ${metodo} ${caminho}`
    if (resposta.status === 404) throw new ErroPagamento('cobranca_inexistente', mensagem)
    if (resposta.status >= 500) throw new ErroPagamento('gateway_indisponivel', mensagem)
    throw new ErroPagamento('dados_invalidos', mensagem)
  }
}

export function tipoDaChavePix(chave: string): 'EMAIL' | 'CPF' | 'CNPJ' | 'PHONE' | 'EVP' {
  if (chave.includes('@')) return 'EMAIL'
  if (chave.startsWith('+')) return 'PHONE'
  if (/^\d{11}$/.test(chave)) return 'CPF'
  if (/^\d{14}$/.test(chave)) return 'CNPJ'
  return 'EVP'
}

function mapear(
  pagamento: PagamentoAsaas,
  extra: { valorEstornado?: Centavos; retencaoLiberada?: boolean } = {},
): Cobranca {
  const valor = paraCentavos(pagamento.value)
  const status = statusDe(pagamento, extra.valorEstornado ?? 0, valor)
  const cobrado = ['paga', 'capturada', 'estornada_parcialmente', 'estornada'].includes(status)
  const liquido = pagamento.netValue === undefined ? valor : paraCentavos(pagamento.netValue)
  return {
    cobrancaId: pagamento.id,
    referencia: pagamento.externalReference ?? '',
    meio: pagamento.billingType === 'PIX' ? 'pix' : 'cartao',
    valor,
    status,
    valorEstornado: extra.valorEstornado ?? 0,
    taxaGateway: cobrado ? Math.max(0, valor - liquido) : 0,
    retencaoLiberada: extra.retencaoLiberada ?? false,
  }
}

function statusDe(
  pagamento: PagamentoAsaas,
  valorEstornado: Centavos,
  valor: Centavos,
): StatusCobranca {
  if (pagamento.deleted) return 'cancelada'
  if (valorEstornado > 0 && valorEstornado < valor) return 'estornada_parcialmente'
  switch (pagamento.status) {
    case 'PENDING':
      return 'aguardando_pagamento'
    case 'OVERDUE':
      return 'cancelada'
    case 'RECEIVED':
    case 'RECEIVED_IN_CASH':
      return 'paga'
    case 'AUTHORIZED':
      return 'pre_autorizada'
    case 'CONFIRMED':
      return 'capturada'
    case 'REFUNDED':
    case 'REFUND_REQUESTED':
    case 'REFUND_IN_PROGRESS':
      return pagamento.confirmedDate ? 'estornada' : 'pre_autorizacao_cancelada'
    default:
      throw new ErroPagamento(
        'estado_invalido',
        `Status do Asaas desconhecido: ${pagamento.status}`,
      )
  }
}

function exigir(cobranca: Cobranca, permitidos: StatusCobranca[]): void {
  if (!permitidos.includes(cobranca.status)) {
    throw new ErroPagamento('estado_invalido', `Cobrança em ${cobranca.status}`)
  }
}

function validarValor(valor: Centavos): void {
  if (!Number.isSafeInteger(valor) || valor <= 0) {
    throw new ErroPagamento('valor_invalido', `Valor inválido: ${valor}`)
  }
}

function dataISO(data: Date): string {
  return data.toISOString().slice(0, 10)
}
