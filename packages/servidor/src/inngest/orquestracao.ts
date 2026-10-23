import type { EscolhaPixNoPrazo } from '@navalha/core'
import type { Contexto, EventoInterno, Resultado } from '../contexto'
import { carregarAgendamento } from '../repositorio'
import {
  capturarAgendamento,
  liberarPorFaltaDeRegularizacao,
  preAutorizarAgendamento,
} from '../servicos/cobranca-cartao'
import { liquidarAgendamento } from '../servicos/liquidacao'
import { fecharLoteDaSemana } from '../servicos/lote-semanal'
import { expirarReserva } from '../servicos/pix'
import { enviarLembrete, marcarNoShowSeVencido } from '../servicos/rotina'
import { processarWebhookDePagamento } from '../servicos/webhook'

// Orquestração das funções agendadas (cartao-pre-autorizado §Fluxo do cartão). Recebe os passos
// do Inngest por parâmetro: em produção, o step real; nos testes, passos de mentira que
// registram cada chamada.

export const MESMO_AGENDAMENTO = 'async.data.agendamentoId == event.data.agendamentoId'

export interface Passos {
  run<T>(id: string, fn: () => Promise<T>): Promise<T>
  sleepUntil(id: string, quando: string): Promise<void>
  /** null quando o tempo acaba sem o evento chegar. */
  waitForEvent(id: string, opcoes: { event: string; timeout: string; if: string }): Promise<unknown>
  sendEvent(id: string, eventos: EventoInterno[]): Promise<unknown>
}

type ObterContexto = () => Contexto

async function publicar(passos: Passos, r: Resultado<string>): Promise<void> {
  if (r.eventos.length > 0) await passos.sendEvent('publicar', r.eventos)
}

async function situacaoDoCartao(obter: ObterContexto, agendamentoId: string) {
  const ag = await carregarAgendamento(obter().sql, agendamentoId)
  return {
    meio: ag.pagamento?.meio ?? null,
    statusPagamento: ag.pagamento?.status ?? null,
    preAutorizarEm: ag.pagamento?.preAutorizarEm?.toISOString() ?? null,
    capturarEm: ag.pagamento?.capturarEm?.toISOString() ?? null,
  }
}

export async function cobrarNoCartao(passos: Passos, obter: ObterContexto, agendamentoId: string) {
  const inicial = await passos.run('carregar', () => situacaoDoCartao(obter, agendamentoId))
  if (inicial.meio !== 'cartao') return 'nao_e_cartao'

  if (inicial.statusPagamento === 'tokenizado' && inicial.preAutorizarEm) {
    await passos.sleepUntil('aguardar-janela-de-72h', inicial.preAutorizarEm)
    const pre = await passos.run('pre-autorizar', () =>
      preAutorizarAgendamento(obter(), agendamentoId),
    )
    if (pre.resultado === 'recusada') {
      const regularizou = await passos.waitForEvent('aguardar-regularizacao', {
        event: 'pagamento/regularizado',
        timeout: '12h',
        if: MESMO_AGENDAMENTO,
      })
      if (!regularizou) {
        await passos.run('liberar-horario', () =>
          liberarPorFaltaDeRegularizacao(obter(), agendamentoId),
        )
        return 'liberado'
      }
    }
  }

  const atual = await passos.run('carregar-de-novo', () => situacaoDoCartao(obter, agendamentoId))
  if (atual.statusPagamento !== 'pre_autorizado' || !atual.capturarEm) return 'sem_captura'
  await passos.sleepUntil('aguardar-fim-do-prazo-gratis', atual.capturarEm)
  await passos.run('capturar', () => capturarAgendamento(obter(), agendamentoId))
  return 'capturado'
}

export async function lembrarUmaHoraAntes(
  passos: Passos,
  obter: ObterContexto,
  agendamentoId: string,
) {
  const { lembrarEm } = await passos.run('carregar', async () => {
    const ctx = obter()
    const ag = await carregarAgendamento(ctx.sql, agendamentoId)
    const quando = new Date(ag.inicio.getTime() - 3_600_000)
    return { lembrarEm: quando.getTime() > ctx.agora().getTime() ? quando.toISOString() : null }
  })
  if (!lembrarEm) return 'sem_lembrete'
  await passos.sleepUntil('aguardar-lembrete', lembrarEm)
  const r = await passos.run('enviar', () => enviarLembrete(obter(), agendamentoId))
  return r.resultado
}

export async function vigiarNoShow(passos: Passos, obter: ObterContexto, agendamentoId: string) {
  const { toleranciaAte } = await passos.run('carregar', async () => {
    const ag = await carregarAgendamento(obter().sql, agendamentoId)
    return { toleranciaAte: ag.toleranciaAte.toISOString() }
  })
  await passos.sleepUntil('aguardar-tolerancia', toleranciaAte)
  const r = await passos.run('marcar-no-show', () => marcarNoShowSeVencido(obter(), agendamentoId))
  await publicar(passos, r)
  return r.resultado
}

export async function liquidar(
  passos: Passos,
  obter: ObterContexto,
  dados: { agendamentoId: string; escolhaPix?: EscolhaPixNoPrazo },
) {
  const r = await passos.run('liquidar', async () => {
    const { resultado, eventos } = await liquidarAgendamento(obter(), dados)
    return { resultado, eventos }
  })
  await publicar(passos, r)
  return r.resultado
}

export async function expirarReservaPix(
  passos: Passos,
  obter: ObterContexto,
  dados: { reservaId: string; expiraEm: string },
) {
  await passos.sleepUntil('aguardar-expiracao', dados.expiraEm)
  const r = await passos.run('expirar', () => expirarReserva(obter(), dados.reservaId))
  await publicar(passos, r)
  return r.resultado
}

export async function processarWebhook(passos: Passos, obter: ObterContexto, eventoId: string) {
  const r = await passos.run('processar', () => processarWebhookDePagamento(obter(), eventoId))
  await publicar(passos, r)
  return r.resultado
}

export async function fecharLoteSemanal(passos: Passos, obter: ObterContexto) {
  const r = await passos.run('fechar', () => {
    const ctx = obter()
    const semana = ctx.agora().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
    return fecharLoteDaSemana(ctx, { semana })
  })
  return r.resultado
}
