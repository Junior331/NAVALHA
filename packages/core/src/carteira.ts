import type { Centavos } from './money'

// Carteira da barbearia: cartao-pre-autorizado §Transferência (disponível já sem as taxas da
// Navalha do lote semanal) e regras-de-negocio §Decisões (saque manual, mínimo de R$ 50).

export const SAQUE_MINIMO: Centavos = 5000

export function saldoDisponivel(params: { saldo: Centavos; taxasATransferir: Centavos }): Centavos {
  return Math.max(0, params.saldo - params.taxasATransferir)
}

export type ResultadoSaque =
  | { ok: true }
  | { ok: false; motivo: 'abaixo_do_minimo' | 'acima_do_disponivel' }

export function validarSaque(params: { valor: Centavos; disponivel: Centavos }): ResultadoSaque {
  if (params.valor < SAQUE_MINIMO) return { ok: false, motivo: 'abaixo_do_minimo' }
  if (params.valor > params.disponivel) return { ok: false, motivo: 'acima_do_disponivel' }
  return { ok: true }
}
