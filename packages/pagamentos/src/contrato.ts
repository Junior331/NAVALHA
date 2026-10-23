import { describe, expect, it } from 'vitest'
import {
  ErroPagamento,
  type DadosCartao,
  type PaymentProvider,
  type TitularCartao,
} from './provider'

// Suíte de contrato do PaymentProvider. Roda contra o fake em todo PR e contra o sandbox do
// Asaas na integração, para os dois se comportarem igual.

export interface AmbienteDeContrato {
  provider: PaymentProvider
  /** Faz o Pix ser pago: no fake, direto; no sandbox, pela API de simulação. */
  simularPixPago(params: { subcontaId: string; cobrancaId: string }): Promise<void>
  cartaoAprovado: DadosCartao
  cartaoRecusado: DadosCartao
  titular: TitularCartao
  /** Dados de subconta válidos para o ambiente (o sandbox valida CPF/CNPJ e CEP). */
  subconta: Parameters<PaymentProvider['criarSubconta']>[0]
}

export function testarContratoPaymentProvider(
  nome: string,
  criarAmbiente: () => Promise<AmbienteDeContrato>,
  opcoes: { timeout?: number } = {},
): void {
  const timeout = opcoes.timeout ?? 5_000

  describe(`contrato do PaymentProvider: ${nome}`, { timeout }, () => {
    const preparar = async () => {
      const ambiente = await criarAmbiente()
      const { subcontaId } = await ambiente.provider.criarSubconta(ambiente.subconta)
      await ambiente.provider.habilitarEscrow({ subcontaId })
      const { clienteId } = await ambiente.provider.garantirCliente({
        subcontaId,
        cliente: {
          referencia: `cliente-${Date.now()}`,
          nome: 'Lucas Andrade',
          email: 'lucas@exemplo.com',
          cpfCnpj: ambiente.titular.cpfCnpj,
        },
      })
      return { ...ambiente, subcontaId, clienteId }
    }

    const preAutorizado = async (valor = 7000, referencia = `ag-cartao-${Date.now()}`) => {
      const a = await preparar()
      const { token } = await a.provider.tokenizarCartao({
        subcontaId: a.subcontaId,
        clienteId: a.clienteId,
        cartao: a.cartaoAprovado,
        titular: a.titular,
        ipRemoto: '127.0.0.1',
      })
      const cobranca = await a.provider.preAutorizar({
        subcontaId: a.subcontaId,
        clienteId: a.clienteId,
        token,
        valor,
        referencia,
        ipRemoto: '127.0.0.1',
      })
      return { ...a, cobranca }
    }

    const pix = async (a: Awaited<ReturnType<typeof preparar>>, referencia: string) =>
      a.provider.criarCobrancaPix({
        subcontaId: a.subcontaId,
        clienteId: a.clienteId,
        valor: 7000,
        expiraEm: new Date(Date.now() + 10 * 60_000),
        referencia,
      })

    it('cria a subconta com wallet e chave de API próprias', async () => {
      const a = await criarAmbiente()
      const subconta = await a.provider.criarSubconta(a.subconta)
      expect(subconta.subcontaId).not.toBe('')
      expect(subconta.walletId).not.toBe('')
      expect(subconta.chaveApi).not.toBe('')
    })

    it('não duplica o cliente quando a referência se repete', async () => {
      const a = await preparar()
      const cliente = {
        referencia: 'cliente-fixo',
        nome: 'Marcos Dias',
        cpfCnpj: a.titular.cpfCnpj,
      }
      const primeiro = await a.provider.garantirCliente({ subcontaId: a.subcontaId, cliente })
      const segundo = await a.provider.garantirCliente({ subcontaId: a.subcontaId, cliente })
      expect(segundo.clienteId).toBe(primeiro.clienteId)
    })

    it('Pix: nasce aguardando pagamento, com QR Code e copia e cola, e fica paga', async () => {
      const a = await preparar()
      const cobranca = await pix(a, `ag-pix-${Date.now()}`)
      expect(cobranca.status).toBe('aguardando_pagamento')
      expect(cobranca.copiaECola.length).toBeGreaterThan(0)
      expect(cobranca.qrCodeBase64.length).toBeGreaterThan(0)

      await a.simularPixPago({ subcontaId: a.subcontaId, cobrancaId: cobranca.cobrancaId })
      const consultada = await a.provider.consultarCobranca({
        subcontaId: a.subcontaId,
        cobrancaId: cobranca.cobrancaId,
      })
      expect(consultada.status).toBe('paga')
    })

    it('Pix: repetir a referência devolve a mesma cobrança', async () => {
      const a = await preparar()
      const referencia = `ag-repetido-${Date.now()}`
      const primeira = await pix(a, referencia)
      const segunda = await pix(a, referencia)
      expect(segunda.cobrancaId).toBe(primeira.cobrancaId)
    })

    it('Pix expirado: a cobrança é cancelada e não pode mais ser paga', async () => {
      const a = await preparar()
      const cobranca = await pix(a, `ag-expirado-${Date.now()}`)
      const cancelada = await a.provider.cancelarCobranca({
        subcontaId: a.subcontaId,
        cobrancaId: cobranca.cobrancaId,
      })
      expect(cancelada.status).toBe('cancelada')
    })

    it('cartão: tokeniza sem devolver o número e mostra só o final', async () => {
      const a = await preparar()
      const tokenizado = await a.provider.tokenizarCartao({
        subcontaId: a.subcontaId,
        clienteId: a.clienteId,
        cartao: a.cartaoAprovado,
        titular: a.titular,
        ipRemoto: '127.0.0.1',
      })
      expect(tokenizado.final).toBe(a.cartaoAprovado.numero.slice(-4))
      expect(tokenizado.token).not.toContain(a.cartaoAprovado.numero)
    })

    it('cartão: pré-autoriza, captura no fim do prazo grátis e passa a ter G', async () => {
      const { provider, subcontaId, cobranca } = await preAutorizado()
      expect(cobranca.status).toBe('pre_autorizada')
      expect(cobranca.taxaGateway).toBe(0)

      const capturada = await provider.capturar({ subcontaId, cobrancaId: cobranca.cobrancaId })
      expect(capturada.status).toBe('capturada')
      expect(capturada.taxaGateway).toBeGreaterThan(0)
    })

    it('cartão recusado não fica pré-autorizado e traz o motivo', async () => {
      const a = await preparar()
      const { token } = await a.provider.tokenizarCartao({
        subcontaId: a.subcontaId,
        clienteId: a.clienteId,
        cartao: a.cartaoRecusado,
        titular: a.titular,
        ipRemoto: '127.0.0.1',
      })
      const cobranca = await a.provider.preAutorizar({
        subcontaId: a.subcontaId,
        clienteId: a.clienteId,
        token,
        valor: 7000,
        referencia: `ag-recusado-${Date.now()}`,
        ipRemoto: '127.0.0.1',
      })
      expect(cobranca.status).toBe('recusada')
      expect(cobranca.motivoRecusa).toBeTruthy()
    })

    it('cancelamento no prazo: pré-autorização cancelada não pode ser capturada', async () => {
      const { provider, subcontaId, cobranca } = await preAutorizado()
      const cancelada = await provider.cancelarPreAutorizacao({
        subcontaId,
        cobrancaId: cobranca.cobrancaId,
      })
      expect(cancelada.status).toBe('pre_autorizacao_cancelada')
      expect(cancelada.taxaGateway).toBe(0)
      await expect(
        provider.capturar({ subcontaId, cobrancaId: cobranca.cobrancaId }),
      ).rejects.toThrow(ErroPagamento)
    })

    it('não captura duas vezes', async () => {
      const { provider, subcontaId, cobranca } = await preAutorizado()
      await provider.capturar({ subcontaId, cobrancaId: cobranca.cobrancaId })
      await expect(
        provider.capturar({ subcontaId, cobrancaId: cobranca.cobrancaId }),
      ).rejects.toThrow(ErroPagamento)
    })

    it('estorno parcial (cancelamento tardio) e depois o restante', async () => {
      const { provider, subcontaId, cobranca } = await preAutorizado(10000)
      await provider.capturar({ subcontaId, cobrancaId: cobranca.cobrancaId })

      const parcial = await provider.estornar({
        subcontaId,
        cobrancaId: cobranca.cobrancaId,
        valor: 5000,
      })
      expect(parcial.status).toBe('estornada_parcialmente')
      expect(parcial.valorEstornado).toBe(5000)

      const total = await provider.estornar({ subcontaId, cobrancaId: cobranca.cobrancaId })
      expect(total.status).toBe('estornada')
      expect(total.valorEstornado).toBe(10000)
    })

    it('não estorna mais do que foi cobrado', async () => {
      const { provider, subcontaId, cobranca } = await preAutorizado(10000)
      await provider.capturar({ subcontaId, cobrancaId: cobranca.cobrancaId })
      await expect(
        provider.estornar({ subcontaId, cobrancaId: cobranca.cobrancaId, valor: 10001 }),
      ).rejects.toThrow(ErroPagamento)
    })

    it('não estorna cobrança que ainda não foi capturada', async () => {
      const { provider, subcontaId, cobranca } = await preAutorizado()
      await expect(
        provider.estornar({ subcontaId, cobrancaId: cobranca.cobrancaId }),
      ).rejects.toThrow(ErroPagamento)
    })

    it('libera a retenção do Escrow depois de capturar, e repetir não quebra', async () => {
      const { provider, subcontaId, cobranca } = await preAutorizado()
      await provider.capturar({ subcontaId, cobrancaId: cobranca.cobrancaId })
      const liberada = await provider.liberarRetencao({
        subcontaId,
        cobrancaId: cobranca.cobrancaId,
      })
      expect(liberada.retencaoLiberada).toBe(true)
      const deNovo = await provider.liberarRetencao({ subcontaId, cobrancaId: cobranca.cobrancaId })
      expect(deNovo.retencaoLiberada).toBe(true)
    })

    it('transfere a taxa por Pix e rejeita valor zero', async () => {
      const a = await preparar()
      const ok = await a.provider.transferirPix({
        subcontaId: a.subcontaId,
        chavePix: 'financeiro@navalha.app',
        valor: 800,
        referencia: `lote-${Date.now()}`,
      })
      expect(ok.transferenciaId).not.toBe('')
      await expect(
        a.provider.transferirPix({
          subcontaId: a.subcontaId,
          chavePix: 'financeiro@navalha.app',
          valor: 0,
          referencia: 'lote-vazio',
        }),
      ).rejects.toThrow(ErroPagamento)
    })

    it('cobrança inexistente gera erro', async () => {
      const a = await preparar()
      await expect(
        a.provider.consultarCobranca({ subcontaId: a.subcontaId, cobrancaId: 'pay_nao_existe' }),
      ).rejects.toThrow(ErroPagamento)
    })
  })
}
