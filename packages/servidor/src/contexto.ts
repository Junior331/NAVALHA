import type { Centavos, EscolhaPixNoPrazo } from '@navalha/core'
import type { Sql } from '@navalha/db'
import type { PaymentProvider } from '@navalha/pagamentos'
import type { Notificador } from './notificacoes'

// Dependências dos serviços. A API e as funções do Inngest montam o mesmo contexto; os testes
// trocam o gateway pelo FakePaymentProvider e o relógio por um fixo.

export interface Contexto {
  sql: Sql
  pagamentos: PaymentProvider
  notificador: Notificador
  agora: () => Date
  config: ConfigServidor
}

export interface ConfigServidor {
  /** Chave Pix da conta principal da Navalha, destino do lote semanal da taxa. */
  chavePixNavalha: string
  /** Custo cobrado pelo gateway para devolver um Pix. 0 até o suporte do Asaas responder. */
  custoEstornoPix: Centavos
}

// Os serviços não publicam eventos: devolvem os eventos para quem chamou (API ou Inngest).
export type EventoInterno =
  | { name: 'agendamento/criado'; data: { agendamentoId: string } }
  | { name: 'agendamento/cancelado'; data: { agendamentoId: string } }
  | {
      name: 'agendamento/finalizado'
      data: { agendamentoId: string; escolhaPix?: EscolhaPixNoPrazo }
    }
  | { name: 'pagamento/regularizado'; data: { agendamentoId: string } }
  | { name: 'reserva/criada'; data: { reservaId: string; expiraEm: string } }
  | { name: 'pagamento/webhook-recebido'; data: { eventoId: string } }

export interface Resultado<T extends string> {
  resultado: T
  eventos: EventoInterno[]
}
