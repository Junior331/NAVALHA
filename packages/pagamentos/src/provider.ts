import type { Centavos } from '@navalha/core'

// Interface do gateway de pagamento. O Asaas fica atrás dela (docs/roadmap.md, fase 3);
// o FakePaymentProvider implementa o mesmo contrato para testar sem rede.
// Toda cobrança é criada na subconta da barbearia, sem split, e fica retida no Escrow até o
// evento final (regras-de-negocio §Implementação no Asaas).

export type StatusCobranca =
  | 'aguardando_pagamento'
  | 'paga'
  | 'cancelada'
  | 'pre_autorizada'
  | 'recusada'
  | 'pre_autorizacao_cancelada'
  | 'capturada'
  | 'estornada_parcialmente'
  | 'estornada'

export interface Cobranca {
  cobrancaId: string
  referencia: string
  meio: 'pix' | 'cartao'
  valor: Centavos
  status: StatusCobranca
  valorEstornado: Centavos
  /** G: taxa do gateway sobre a transação. 0 enquanto nada foi cobrado. */
  taxaGateway: Centavos
  /** O valor saiu do Escrow e ficou disponível na subconta. */
  retencaoLiberada: boolean
  /** Motivo devolvido pelo gateway quando o cartão é recusado. */
  motivoRecusa?: string
}

export interface CobrancaPix extends Cobranca {
  meio: 'pix'
  copiaECola: string
  /** QR Code em PNG, base64. */
  qrCodeBase64: string
  expiraEm: Date
}

export interface DadosSubconta {
  nome: string
  email: string
  cpfCnpj: string
  celular: string
  /** Faturamento mensal estimado, exigido pelo KYC. */
  faturamentoMensal: Centavos
  endereco: { logradouro: string; numero: string; bairro: string; cep: string }
}

export interface ClienteDoGateway {
  /** Id do cliente no Navalha, para não duplicar o cadastro no gateway. */
  referencia: string
  nome: string
  email?: string
  celular?: string
  cpfCnpj?: string
}

export interface DadosCartao {
  numero: string
  nomeImpresso: string
  /** MM/AA */
  validade: string
  cvv: string
}

/** O gateway exige os dados do titular para tokenizar e cobrar no cartão. */
export interface TitularCartao {
  nome: string
  email: string
  cpfCnpj: string
  cep: string
  numeroEndereco: string
  celular: string
}

export interface CartaoTokenizado {
  token: string
  final: string
  bandeira: string
}

export interface PaymentProvider {
  criarSubconta(dados: DadosSubconta): Promise<{
    subcontaId: string
    walletId: string
    /** Chave de API da subconta. Guardar no Vault, nunca em tabela. */
    chaveApi: string
  }>
  habilitarEscrow(params: { subcontaId: string }): Promise<void>
  garantirCliente(params: {
    subcontaId: string
    cliente: ClienteDoGateway
  }): Promise<{ clienteId: string }>
  criarCobrancaPix(params: {
    subcontaId: string
    clienteId: string
    valor: Centavos
    expiraEm: Date
    /** Id da reserva ou do agendamento. Repetir a referência devolve a mesma cobrança. */
    referencia: string
  }): Promise<CobrancaPix>
  /** Pix que expirou sem pagamento. */
  cancelarCobranca(params: { subcontaId: string; cobrancaId: string }): Promise<Cobranca>
  tokenizarCartao(params: {
    subcontaId: string
    clienteId: string
    cartao: DadosCartao
    titular: TitularCartao
    ipRemoto: string
  }): Promise<CartaoTokenizado>
  preAutorizar(params: {
    subcontaId: string
    clienteId: string
    token: string
    valor: Centavos
    referencia: string
    ipRemoto: string
  }): Promise<Cobranca>
  capturar(params: { subcontaId: string; cobrancaId: string }): Promise<Cobranca>
  cancelarPreAutorizacao(params: { subcontaId: string; cobrancaId: string }): Promise<Cobranca>
  /** Sem valor: estorno integral. O estorno só conta como devolvido quando concluído. */
  estornar(params: { subcontaId: string; cobrancaId: string; valor?: Centavos }): Promise<Cobranca>
  /** Libera o Escrow: o valor da barbearia fica disponível na subconta. Idempotente. */
  liberarRetencao(params: { subcontaId: string; cobrancaId: string }): Promise<Cobranca>
  /** Pix enviado da subconta para a chave da Navalha (ajustes-taxas §Transferência). */
  transferirPix(params: {
    subcontaId: string
    chavePix: string
    valor: Centavos
    referencia: string
  }): Promise<{ transferenciaId: string }>
  consultarCobranca(params: { subcontaId: string; cobrancaId: string }): Promise<Cobranca>
}

export class ErroPagamento extends Error {
  constructor(
    readonly codigo:
      | 'cobranca_inexistente'
      | 'estado_invalido'
      | 'valor_invalido'
      | 'subconta_inexistente'
      | 'dados_invalidos'
      | 'gateway_indisponivel',
    mensagem: string,
  ) {
    super(mensagem)
    this.name = 'ErroPagamento'
  }
}
