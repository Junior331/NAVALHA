import { centavos, percentualPraBaixo, type Centavos } from '@navalha/core'
import {
  ErroPagamento,
  type CartaoTokenizado,
  type ClienteDoGateway,
  type Cobranca,
  type CobrancaPix,
  type DadosCartao,
  type DadosSubconta,
  type PaymentProvider,
  type TitularCartao,
} from './provider'

// Gateway em memória para testes e para o ambiente local. Cartão usa a tarifa cheia do Asaas
// (2,99% + R$ 0,49, ajustes-taxas §G com preço cheio); Pix recebido sem tarifa até o suporte
// confirmar (ajustes-taxas §Perguntas).
const TARIFA_CARTAO_PB = 299
const TARIFA_CARTAO_FIXA: Centavos = 49

const ESTORNAVEIS = new Set<Cobranca['status']>(['paga', 'capturada', 'estornada_parcialmente'])
const LIBERAVEIS = new Set<Cobranca['status']>(['paga', 'capturada', 'estornada_parcialmente'])

interface Subconta {
  escrow: boolean
  clientes: Map<string, string>
}

export class FakePaymentProvider implements PaymentProvider {
  static readonly CARTAO_RECUSADO = '4000000000000002'

  /** autoRegistrarSubcontas: no ambiente local, aceita as subcontas do seed sem cadastro prévio. */
  constructor(private readonly opcoes: { autoRegistrarSubcontas?: boolean } = {}) {}

  private sequencia = 0
  // Prefixo por instância: ids não colidem quando vários fakes gravam no mesmo banco.
  private readonly instancia = Math.random().toString(36).slice(2, 8)
  private readonly subcontas = new Map<string, Subconta>()
  private readonly cobrancas = new Map<string, Cobranca | CobrancaPix>()
  private readonly donoDaCobranca = new Map<string, string>()
  private readonly porReferencia = new Map<string, string>()
  private readonly tokens = new Map<string, DadosCartao>()
  /** Transferências feitas, para os testes conferirem o lote semanal. */
  readonly transferencias: {
    subcontaId: string
    chavePix: string
    valor: Centavos
    referencia: string
  }[] = []

  private novoId(prefixo: string): string {
    this.sequencia += 1
    return `${prefixo}_${this.instancia}${this.sequencia}`
  }

  /** Cria uma subconta com id conhecido (útil no seed e nos testes de integração). */
  registrarSubconta(subcontaId: string): void {
    if (!this.subcontas.has(subcontaId)) {
      this.subcontas.set(subcontaId, { escrow: true, clientes: new Map() })
    }
  }

  async criarSubconta(
    dados: DadosSubconta,
  ): Promise<{ subcontaId: string; walletId: string; chaveApi: string }> {
    if (!dados.cpfCnpj || !dados.email) {
      throw new ErroPagamento('dados_invalidos', 'CPF/CNPJ e e-mail são obrigatórios')
    }
    const subcontaId = this.novoId('acc')
    this.subcontas.set(subcontaId, { escrow: false, clientes: new Map() })
    return { subcontaId, walletId: this.novoId('wal'), chaveApi: this.novoId('chave') }
  }

  async habilitarEscrow(params: { subcontaId: string }): Promise<void> {
    this.subconta(params.subcontaId).escrow = true
  }

  async garantirCliente(params: {
    subcontaId: string
    cliente: ClienteDoGateway
  }): Promise<{ clienteId: string }> {
    const { clientes } = this.subconta(params.subcontaId)
    const existente = clientes.get(params.cliente.referencia)
    if (existente) return { clienteId: existente }
    const clienteId = this.novoId('cus')
    clientes.set(params.cliente.referencia, clienteId)
    return { clienteId }
  }

  async criarCobrancaPix(params: {
    subcontaId: string
    clienteId: string
    valor: Centavos
    expiraEm: Date
    referencia: string
  }): Promise<CobrancaPix> {
    this.subconta(params.subcontaId)
    const existente = this.porReferencia.get(`${params.subcontaId}:${params.referencia}`)
    if (existente) return { ...(this.buscar(existente) as CobrancaPix) }

    const cobranca: CobrancaPix = {
      cobrancaId: this.novoId('pay'),
      referencia: params.referencia,
      meio: 'pix',
      valor: this.valorPositivo(params.valor),
      status: 'aguardando_pagamento',
      valorEstornado: 0,
      taxaGateway: 0,
      retencaoLiberada: false,
      copiaECola: `00020126580014br.gov.bcb.pix0136${params.referencia}5204000053039865802BR`,
      qrCodeBase64:
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      expiraEm: params.expiraEm,
    }
    this.guardar(params.subcontaId, cobranca)
    return { ...cobranca }
  }

  simularPixPago(cobrancaId: string): void {
    const cobranca = this.buscar(cobrancaId)
    this.exigirStatus(cobranca, ['aguardando_pagamento'])
    cobranca.status = 'paga'
  }

  async cancelarCobranca(params: { subcontaId: string; cobrancaId: string }): Promise<Cobranca> {
    const cobranca = this.buscarNaSubconta(params)
    this.exigirStatus(cobranca, ['aguardando_pagamento'])
    cobranca.status = 'cancelada'
    return { ...cobranca }
  }

  async tokenizarCartao(params: {
    subcontaId: string
    clienteId: string
    cartao: DadosCartao
    titular: TitularCartao
    ipRemoto: string
  }): Promise<CartaoTokenizado> {
    this.subconta(params.subcontaId)
    if (!params.titular.cpfCnpj || !params.titular.cep) {
      throw new ErroPagamento('dados_invalidos', 'CPF e CEP do titular são obrigatórios')
    }
    const token = this.novoId('tok')
    this.tokens.set(token, params.cartao)
    return { token, final: params.cartao.numero.slice(-4), bandeira: 'VISA' }
  }

  async preAutorizar(params: {
    subcontaId: string
    clienteId: string
    token: string
    valor: Centavos
    referencia: string
    ipRemoto: string
  }): Promise<Cobranca> {
    this.subconta(params.subcontaId)
    const existente = this.porReferencia.get(`${params.subcontaId}:${params.referencia}`)
    if (existente) return { ...this.buscar(existente) }

    const cartao = this.tokens.get(params.token)
    if (!cartao) throw new ErroPagamento('estado_invalido', 'Token de cartão desconhecido')
    const recusado = cartao.numero === FakePaymentProvider.CARTAO_RECUSADO

    const cobranca: Cobranca = {
      cobrancaId: this.novoId('pay'),
      referencia: params.referencia,
      meio: 'cartao',
      valor: this.valorPositivo(params.valor),
      status: recusado ? 'recusada' : 'pre_autorizada',
      valorEstornado: 0,
      taxaGateway: 0,
      retencaoLiberada: false,
      ...(recusado ? { motivoRecusa: 'Transação não autorizada pelo emissor' } : {}),
    }
    this.guardar(params.subcontaId, cobranca)
    return { ...cobranca }
  }

  async capturar(params: { subcontaId: string; cobrancaId: string }): Promise<Cobranca> {
    const cobranca = this.buscarNaSubconta(params)
    this.exigirStatus(cobranca, ['pre_autorizada'])
    cobranca.status = 'capturada'
    cobranca.taxaGateway = percentualPraBaixo(cobranca.valor, TARIFA_CARTAO_PB) + TARIFA_CARTAO_FIXA
    return { ...cobranca }
  }

  async cancelarPreAutorizacao(params: {
    subcontaId: string
    cobrancaId: string
  }): Promise<Cobranca> {
    const cobranca = this.buscarNaSubconta(params)
    this.exigirStatus(cobranca, ['pre_autorizada'])
    cobranca.status = 'pre_autorizacao_cancelada'
    return { ...cobranca }
  }

  async estornar(params: {
    subcontaId: string
    cobrancaId: string
    valor?: Centavos
  }): Promise<Cobranca> {
    const cobranca = this.buscarNaSubconta(params)
    if (!ESTORNAVEIS.has(cobranca.status)) {
      throw new ErroPagamento('estado_invalido', `Não dá para estornar: ${cobranca.status}`)
    }
    const restante = cobranca.valor - cobranca.valorEstornado
    const valor = params.valor === undefined ? restante : this.valorPositivo(params.valor)
    if (valor > restante) {
      throw new ErroPagamento('valor_invalido', 'Estorno maior que o valor restante')
    }
    cobranca.valorEstornado += valor
    cobranca.status =
      cobranca.valorEstornado === cobranca.valor ? 'estornada' : 'estornada_parcialmente'
    return { ...cobranca }
  }

  async liberarRetencao(params: { subcontaId: string; cobrancaId: string }): Promise<Cobranca> {
    const cobranca = this.buscarNaSubconta(params)
    if (!cobranca.retencaoLiberada && !LIBERAVEIS.has(cobranca.status)) {
      throw new ErroPagamento('estado_invalido', `Não dá para liberar: ${cobranca.status}`)
    }
    cobranca.retencaoLiberada = true
    return { ...cobranca }
  }

  async transferirPix(params: {
    subcontaId: string
    chavePix: string
    valor: Centavos
    referencia: string
  }): Promise<{ transferenciaId: string }> {
    this.subconta(params.subcontaId)
    this.valorPositivo(params.valor)
    this.transferencias.push({ ...params })
    return { transferenciaId: this.novoId('tra') }
  }

  async consultarCobranca(params: { subcontaId: string; cobrancaId: string }): Promise<Cobranca> {
    return { ...this.buscarNaSubconta(params) }
  }

  private guardar(subcontaId: string, cobranca: Cobranca): void {
    this.cobrancas.set(cobranca.cobrancaId, cobranca)
    this.donoDaCobranca.set(cobranca.cobrancaId, subcontaId)
    this.porReferencia.set(`${subcontaId}:${cobranca.referencia}`, cobranca.cobrancaId)
  }

  private buscar(cobrancaId: string): Cobranca {
    const cobranca = this.cobrancas.get(cobrancaId)
    if (!cobranca) {
      throw new ErroPagamento('cobranca_inexistente', `Cobrança ${cobrancaId} não existe`)
    }
    return cobranca
  }

  private buscarNaSubconta(params: { subcontaId: string; cobrancaId: string }): Cobranca {
    this.subconta(params.subcontaId)
    const cobranca = this.buscar(params.cobrancaId)
    if (this.donoDaCobranca.get(params.cobrancaId) !== params.subcontaId) {
      throw new ErroPagamento('cobranca_inexistente', 'Cobrança não é desta subconta')
    }
    return cobranca
  }

  private subconta(subcontaId: string): Subconta {
    if (this.opcoes.autoRegistrarSubcontas) this.registrarSubconta(subcontaId)
    const subconta = this.subcontas.get(subcontaId)
    if (!subconta) {
      throw new ErroPagamento('subconta_inexistente', `Subconta ${subcontaId} não existe`)
    }
    return subconta
  }

  private exigirStatus(cobranca: Cobranca, permitidos: Cobranca['status'][]): void {
    if (!permitidos.includes(cobranca.status)) {
      throw new ErroPagamento('estado_invalido', `Cobrança em ${cobranca.status}`)
    }
  }

  private valorPositivo(valor: Centavos): Centavos {
    if (!Number.isSafeInteger(valor) || valor <= 0) {
      throw new ErroPagamento('valor_invalido', `Valor inválido: ${valor}`)
    }
    return centavos(valor)
  }
}
