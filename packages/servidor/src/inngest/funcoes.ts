import { cron, eventType, Inngest, staticSchema } from 'inngest'
import type { EscolhaPixNoPrazo } from '@navalha/core'
import type { Contexto } from '../contexto'
import {
  cobrarNoCartao,
  expirarReservaPix,
  fecharLoteSemanal,
  lembrarUmaHoraAntes,
  liquidar,
  MESMO_AGENDAMENTO,
  processarWebhook,
  vigiarNoShow,
  type Passos,
} from './orquestracao'

// Funções do Inngest (docs/roadmap.md, fase 4). Só ligam gatilho, cancelamento e idempotência à
// orquestração em ./orquestracao, que tem testes próprios.

export const inngest = new Inngest({ id: 'navalha' })

type IdDoAgendamento = { agendamentoId: string }

export const eventos = {
  // versao sobe a cada remarcação; ausente no agendamento recém-criado (versão 1).
  agendamentoCriado: eventType('agendamento/criado', {
    schema: staticSchema<{ agendamentoId: string; versao?: number }>(),
  }),
  agendamentoCancelado: eventType('agendamento/cancelado', {
    schema: staticSchema<IdDoAgendamento>(),
  }),
  agendamentoFinalizado: eventType('agendamento/finalizado', {
    schema: staticSchema<{ agendamentoId: string; escolhaPix?: EscolhaPixNoPrazo }>(),
  }),
  pagamentoRegularizado: eventType('pagamento/regularizado', {
    schema: staticSchema<IdDoAgendamento>(),
  }),
  reservaCriada: eventType('reserva/criada', {
    schema: staticSchema<{ reservaId: string; expiraEm: string }>(),
  }),
  webhookRecebido: eventType('pagamento/webhook-recebido', {
    schema: staticSchema<{ eventoId: string }>(),
  }),
}

const cancelarJunto = [{ event: eventos.agendamentoCancelado, if: MESMO_AGENDAMENTO }]

// O step do Inngest tipa o retorno de run() pelo JSON serializado; a orquestração só devolve
// dados JSON (strings ISO no lugar de Date), então a conversão é segura.
const passosDo = (step: unknown) => step as Passos

export function criarFuncoes(obterContexto: () => Contexto) {
  return {
    cobrancaNoCartao: inngest.createFunction(
      { id: 'cobranca-no-cartao', triggers: [eventos.agendamentoCriado], cancelOn: cancelarJunto },
      ({ event, step }) =>
        cobrarNoCartao(passosDo(step), obterContexto, event.data.agendamentoId, event.data.versao),
    ),
    lembrete: inngest.createFunction(
      { id: 'lembrete-1h-antes', triggers: [eventos.agendamentoCriado], cancelOn: cancelarJunto },
      ({ event, step }) =>
        lembrarUmaHoraAntes(
          passosDo(step),
          obterContexto,
          event.data.agendamentoId,
          event.data.versao,
        ),
    ),
    noShow: inngest.createFunction(
      { id: 'no-show', triggers: [eventos.agendamentoCriado], cancelOn: cancelarJunto },
      ({ event, step }) =>
        vigiarNoShow(passosDo(step), obterContexto, event.data.agendamentoId, event.data.versao),
    ),
    liquidacao: inngest.createFunction(
      {
        id: 'liquidacao',
        triggers: [eventos.agendamentoFinalizado],
        idempotency: 'event.data.agendamentoId',
      },
      ({ event, step }) => liquidar(passosDo(step), obterContexto, event.data),
    ),
    expiracaoDaReserva: inngest.createFunction(
      { id: 'expiracao-da-reserva-pix', triggers: [eventos.reservaCriada] },
      ({ event, step }) => expirarReservaPix(passosDo(step), obterContexto, event.data),
    ),
    webhookDePagamento: inngest.createFunction(
      {
        id: 'webhook-de-pagamento',
        triggers: [eventos.webhookRecebido],
        idempotency: 'event.data.eventoId',
      },
      ({ event, step }) => processarWebhook(passosDo(step), obterContexto, event.data.eventoId),
    ),
    loteSemanal: inngest.createFunction(
      { id: 'lote-semanal-da-taxa', triggers: [cron('TZ=America/Sao_Paulo 0 6 * * 1')] },
      ({ step }) => fecharLoteSemanal(passosDo(step), obterContexto),
    ),
  }
}
