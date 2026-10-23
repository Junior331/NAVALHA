import type { Centavos } from '@navalha/core'

// Interface do gateway de pagamento. O Asaas fica atrás dela (docs/roadmap.md, fase 3);
// o FakePaymentProvider implementa o mesmo contrato para testar sem rede.
// Toda chamada de cobrança é feita na subconta da barbearia, sem split
// (regras-de-negocio §Implementação no Asaas).

export type StatusCobranca =
  | 'aguardando_pagamento'
  | 'paga'
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
}

export interface CobrancaPix extends Cobranca {
  meio: 'pix'
  copiaECola: string
  expiraEm: Date
}

export interface DadosCartao {
  numero: string
  nomeImpresso: string
  validade: string
  cvv: string
}

export interface CartaoTokenizado {
  token: string
  final: string
}

export interface PaymentProvider {
  criarSubconta(dados: { nome: string; documento: string; email: string }): Promise<{
    subcontaId: string
  }>
  criarCobrancaPix(params: {
    subcontaId: string
    valor: Centavos
    expiraEm: Date
    /** Id do agendamento. Repetir a referência devolve a mesma cobrança (idempotência). */
    referencia: string
  }): Promise<CobrancaPix>
  tokenizarCartao(params: { subcontaId: string; cartao: DadosCartao }): Promise<CartaoTokenizado>
  preAutorizar(params: {
    subcontaId: string
    token: string
    valor: Centavos
    referencia: string
  }): Promise<Cobranca>
  capturar(params: { subcontaId: string; cobrancaId: string }): Promise<Cobranca>
  cancelarPreAutorizacao(params: { subcontaId: string; cobrancaId: string }): Promise<Cobranca>
  /** Sem valor: estorno integral. O estorno só conta como devolvido quando concluído. */
  estornar(params: { subcontaId: string; cobrancaId: string; valor?: Centavos }): Promise<Cobranca>
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
      'cobranca_inexistente' | 'estado_invalido' | 'valor_invalido' | 'subconta_inexistente',
    mensagem: string,
  ) {
    super(mensagem)
    this.name = 'ErroPagamento'
  }
}
