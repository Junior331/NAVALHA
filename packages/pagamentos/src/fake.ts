import { centavos, percentualPraBaixo, type Centavos } from '@navalha/core'
import {
  ErroPagamento,
  type CartaoTokenizado,
  type Cobranca,
  type CobrancaPix,
  type DadosCartao,
  type PaymentProvider,
} from './provider'

// Gateway em memória para testes. Cartão usa a tarifa cheia do Asaas
// (2,99% + R$ 0,49, ajustes-taxas §G com preço cheio); Pix recebido sem tarifa até o
// suporte confirmar (ajustes-taxas §Perguntas).
const TARIFA_CARTAO_PB = 299
const TARIFA_CARTAO_FIXA: Centavos = 49

const ESTORNAVEIS = new Set(['paga', 'capturada', 'estornada_parcialmente'])

export class FakePaymentProvider implements PaymentProvider {
  static readonly CARTAO_RECUSADO = '4000000000000002'

  private sequencia = 0
  private readonly subcontas = new Set<string>()
  private readonly cobrancas = new Map<string, Cobranca | CobrancaPix>()
  private readonly porReferencia = new Map<string, string>()
  private readonly tokens = new Map<string, DadosCartao>()

  private novoId(prefixo: string): string {
    this.sequencia += 1
    return `${prefixo}_${this.sequencia}`
  }

  async criarSubconta(): Promise<{ subcontaId: string }> {
    const subcontaId = this.novoId('sub')
    this.subcontas.add(subcontaId)
    return { subcontaId }
  }

  async criarCobrancaPix(params: {
    subcontaId: string
    valor: Centavos
    expiraEm: Date
    referencia: string
  }): Promise<CobrancaPix> {
    this.exigirSubconta(params.subcontaId)
    const existente = this.porReferencia.get(`${params.subcontaId}:${params.referencia}`)
    if (existente) return this.buscar(existente) as CobrancaPix

    const cobranca: CobrancaPix = {
      cobrancaId: this.novoId('pix'),
      referencia: params.referencia,
      meio: 'pix',
      valor: this.valorPositivo(params.valor),
      status: 'aguardando_pagamento',
      valorEstornado: 0,
      taxaGateway: 0,
      copiaECola: `00020126580014br.gov.bcb.pix0136${params.referencia}`,
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

  async tokenizarCartao(params: {
    subcontaId: string
    cartao: DadosCartao
  }): Promise<CartaoTokenizado> {
    this.exigirSubconta(params.subcontaId)
    const token = this.novoId('tok')
    this.tokens.set(token, params.cartao)
    return { token, final: params.cartao.numero.slice(-4) }
  }

  async preAutorizar(params: {
    subcontaId: string
    token: string
    valor: Centavos
    referencia: string
  }): Promise<Cobranca> {
    this.exigirSubconta(params.subcontaId)
    const existente = this.porReferencia.get(`${params.subcontaId}:${params.referencia}`)
    if (existente) return { ...this.buscar(existente) }

    const cartao = this.tokens.get(params.token)
    if (!cartao) throw new ErroPagamento('estado_invalido', 'Token de cartão desconhecido')

    const cobranca: Cobranca = {
      cobrancaId: this.novoId('cc'),
      referencia: params.referencia,
      meio: 'cartao',
      valor: this.valorPositivo(params.valor),
      status: cartao.numero === FakePaymentProvider.CARTAO_RECUSADO ? 'recusada' : 'pre_autorizada',
      valorEstornado: 0,
      taxaGateway: 0,
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

  async transferirPix(params: {
    subcontaId: string
    chavePix: string
    valor: Centavos
    referencia: string
  }): Promise<{ transferenciaId: string }> {
    this.exigirSubconta(params.subcontaId)
    this.valorPositivo(params.valor)
    return { transferenciaId: this.novoId('trf') }
  }

  async consultarCobranca(params: { subcontaId: string; cobrancaId: string }): Promise<Cobranca> {
    return { ...this.buscarNaSubconta(params) }
  }

  private guardar(subcontaId: string, cobranca: Cobranca): void {
    this.cobrancas.set(cobranca.cobrancaId, cobranca)
    this.porReferencia.set(`${subcontaId}:${cobranca.referencia}`, cobranca.cobrancaId)
  }

  private buscar(cobrancaId: string): Cobranca {
    const cobranca = this.cobrancas.get(cobrancaId)
    if (!cobranca)
      throw new ErroPagamento('cobranca_inexistente', `Cobrança ${cobrancaId} não existe`)
    return cobranca
  }

  private buscarNaSubconta(params: { subcontaId: string; cobrancaId: string }): Cobranca {
    this.exigirSubconta(params.subcontaId)
    const id = params.cobrancaId
    const cobranca = this.buscar(id)
    if (this.porReferencia.get(`${params.subcontaId}:${cobranca.referencia}`) !== id) {
      throw new ErroPagamento('cobranca_inexistente', `Cobrança ${id} não é desta subconta`)
    }
    return cobranca
  }

  private exigirSubconta(subcontaId: string): void {
    if (!this.subcontas.has(subcontaId)) {
      throw new ErroPagamento('subconta_inexistente', `Subconta ${subcontaId} não existe`)
    }
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
