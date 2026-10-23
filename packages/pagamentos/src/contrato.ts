import { describe, expect, it } from 'vitest'
import { ErroPagamento, type DadosCartao, type PaymentProvider } from './provider'

// Suíte de contrato do PaymentProvider. Roda contra o fake em todo PR e contra o
// sandbox do Asaas na integração (fase 3), para os dois se comportarem igual.

export interface AmbienteDeContrato {
  provider: PaymentProvider
  /** Faz o Pix ser pago: no fake, direto; no sandbox, pela API de simulação. */
  simularPixPago(cobrancaId: string): Promise<void>
  cartaoAprovado: DadosCartao
  cartaoRecusado: DadosCartao
}

export function testarContratoPaymentProvider(
  nome: string,
  criarAmbiente: () => Promise<AmbienteDeContrato>,
): void {
  describe(`contrato do PaymentProvider: ${nome}`, () => {
    const preparar = async () => {
      const ambiente = await criarAmbiente()
      const { subcontaId } = await ambiente.provider.criarSubconta({
        nome: 'Barbearia do Zé',
        documento: '00000000000191',
        email: 'ze@teste.local',
      })
      return { ...ambiente, subcontaId }
    }

    const preAutorizado = async (valor = 7000, referencia = 'ag-cartao') => {
      const a = await preparar()
      const { token } = await a.provider.tokenizarCartao({
        subcontaId: a.subcontaId,
        cartao: a.cartaoAprovado,
      })
      const cobranca = await a.provider.preAutorizar({
        subcontaId: a.subcontaId,
        token,
        valor,
        referencia,
      })
      return { ...a, cobranca }
    }

    it('Pix: nasce aguardando pagamento e fica paga quando o cliente paga', async () => {
      const a = await preparar()
      const pix = await a.provider.criarCobrancaPix({
        subcontaId: a.subcontaId,
        valor: 7000,
        expiraEm: new Date(Date.now() + 10 * 60_000),
        referencia: 'ag-pix',
      })
      expect(pix.status).toBe('aguardando_pagamento')
      expect(pix.copiaECola.length).toBeGreaterThan(0)

      await a.simularPixPago(pix.cobrancaId)
      const consultada = await a.provider.consultarCobranca({
        subcontaId: a.subcontaId,
        cobrancaId: pix.cobrancaId,
      })
      expect(consultada.status).toBe('paga')
    })

    it('Pix: repetir a referência devolve a mesma cobrança', async () => {
      const a = await preparar()
      const params = {
        subcontaId: a.subcontaId,
        valor: 7000,
        expiraEm: new Date(Date.now() + 10 * 60_000),
        referencia: 'ag-repetido',
      }
      const primeira = await a.provider.criarCobrancaPix(params)
      const segunda = await a.provider.criarCobrancaPix(params)
      expect(segunda.cobrancaId).toBe(primeira.cobrancaId)
    })

    it('cartão: tokeniza sem guardar o número e mostra só o final', async () => {
      const a = await preparar()
      const tokenizado = await a.provider.tokenizarCartao({
        subcontaId: a.subcontaId,
        cartao: a.cartaoAprovado,
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

    it('cartão recusado não fica pré-autorizado', async () => {
      const a = await preparar()
      const { token } = await a.provider.tokenizarCartao({
        subcontaId: a.subcontaId,
        cartao: a.cartaoRecusado,
      })
      const cobranca = await a.provider.preAutorizar({
        subcontaId: a.subcontaId,
        token,
        valor: 7000,
        referencia: 'ag-recusado',
      })
      expect(cobranca.status).toBe('recusada')
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

    it('transfere a taxa por Pix e rejeita valor zero', async () => {
      const a = await preparar()
      const ok = await a.provider.transferirPix({
        subcontaId: a.subcontaId,
        chavePix: 'financeiro@navalha.app',
        valor: 800,
        referencia: 'lote-2026-43',
      })
      expect(ok.transferenciaId.length).toBeGreaterThan(0)
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
        a.provider.consultarCobranca({ subcontaId: a.subcontaId, cobrancaId: 'nao-existe' }),
      ).rejects.toThrow(ErroPagamento)
    })
  })
}
