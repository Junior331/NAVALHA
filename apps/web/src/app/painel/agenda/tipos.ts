import type { StatusAgendamento } from '@navalha/core'

// Dados que a página da agenda (servidor) entrega aos componentes interativos.

export interface EventoDaAgenda {
  id: string
  codigo: string
  inicio: string
  fim: string
  status: StatusAgendamento
  barbeiroId: string
  /** temApp: o cliente tem conta no app e recebe os avisos por lá (o do balcão pode não ter). */
  cliente: { nome: string; celular: string | null; temApp: boolean }
  servicos: string[]
  valorPagoCentavos: number
  pagoNoBalcao: boolean
  retencaoPct: number
  toleranciaAte: string
  observacoes: string | null
  /** Só o dono enxerga o pagamento (RLS). */
  pagamento: {
    meio: 'pix' | 'cartao'
    status: string
    cartaoFinal: string | null
    capturarEm: string | null
  } | null
}

export interface BarbeiroDaAgenda {
  id: string
  nome: string
}

export interface ServicoDoBalcao {
  id: string
  nome: string
  duracaoMin: number
  precoCentavos: number
}

export interface ContextoDaAgenda {
  barbeariaId: string
  barbeariaNome: string
  fuso: string
  hoje: string
  agora: string
  barbeiros: BarbeiroDaAgenda[]
}
