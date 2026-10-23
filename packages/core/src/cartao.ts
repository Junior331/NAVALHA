// Cartão pré-autorizado: cartao-pre-autorizado §Cartão e §Fluxo do cartão.
// A pré-autorização do Asaas vale no máximo 3 dias, então ela é criada 72h antes do fim do
// prazo grátis (e não do horário) e capturada quando o prazo grátis acaba.

export const JANELA_PRE_AUTORIZACAO_HORAS = 72
export const PRAZO_REGULARIZACAO_HORAS = 12

const HORA_MS = 3_600_000

export interface PlanoCobrancaCartao {
  /** true: pré-autoriza no checkout. false: só tokeniza agora (status Reservado). */
  preAutorizarAgora: boolean
  preAutorizarEm: Date
  capturarEm: Date
}

export function planejarCobrancaNoCartao(params: {
  agora: Date
  fimPrazoGratis: Date
}): PlanoCobrancaCartao {
  const agora = params.agora.getTime()
  const fimPrazo = params.fimPrazoGratis.getTime()
  const aberturaDaJanela = fimPrazo - JANELA_PRE_AUTORIZACAO_HORAS * HORA_MS

  if (agora < aberturaDaJanela) {
    return {
      preAutorizarAgora: false,
      preAutorizarEm: new Date(aberturaDaJanela),
      capturarEm: new Date(fimPrazo),
    }
  }

  return {
    preAutorizarAgora: true,
    preAutorizarEm: new Date(agora),
    capturarEm: new Date(Math.max(fimPrazo, agora)),
  }
}

export function limiteDeRegularizacao(falhaEm: Date): Date {
  return new Date(falhaEm.getTime() + PRAZO_REGULARIZACAO_HORAS * HORA_MS)
}
