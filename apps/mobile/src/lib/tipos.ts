// Respostas da API usadas no app (espelham @navalha/servidor sem importar código de servidor).

export type StatusAgendamento =
  | 'reservado'
  | 'confirmado'
  | 'em_atendimento'
  | 'concluido'
  | 'cancelado_no_prazo'
  | 'cancelado_fora_do_prazo'
  | 'cancelado_pela_barbearia'
  | 'no_show'
  | 'liberado'

export interface PaginaDaBarbearia {
  id: string
  slug: string
  nome: string
  descricao: string | null
  whatsapp: string | null
  endereco: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  fuso: string
  aceitaAgendamentos: boolean
  nota: number | null
  avaliacoes: number
  servicos: {
    id: string
    nome: string
    categoria: string | null
    descricao: string | null
    duracaoMin: number
    precoCentavos: number
    precoSemDescontoCentavos: number
    barbeiroIds: string[]
  }[]
  barbeiros: { id: string; nome: string; nota: number | null; avaliacoes: number }[]
  horarios: { diaSemana: number; abre: string; fecha: string }[]
  politica: { prazoGratisHoras: number; retencaoPct: number; toleranciaMin: number }
  depoimentos: { nota: number; comentario: string; cliente: string; data: string }[]
}

export interface BarbeariaNaBusca {
  slug: string
  nome: string
  bairro: string | null
  cidade: string | null
  nota: number | null
  avaliacoes: number
  aceitaAgendamentos: boolean
}

export interface ValorComDesconto {
  valorBruto: number
  desconto: number
  valorPago: number
}

export type SaidaAgendamento =
  | {
      tipo: 'pix'
      reservaId: string
      valorPagoCentavos: number
      copiaECola: string
      qrCodeBase64: string
      qrCodeExpiraEm: string
      reservadoAte: string
    }
  | { tipo: 'agendado'; agendamentoId: string; codigo: string; status: StatusAgendamento }

export type Situacao =
  | {
      tipo: 'agendamento'
      id: string
      codigo: string
      status: StatusAgendamento
      inicio: string
      fim: string
      barbeiro: string
      servicos: string[]
      valorPagoCentavos: number
      meio: 'pix' | 'cartao' | null
      cartaoFinal: string | null
      preAutorizarEm: string | null
      cobrancaEm: string | null
      prazoGratisAte: string
      regularizarAte: string | null
    }
  | { tipo: 'reserva'; reservadoAte: string }
  | { tipo: 'expirado' }

export interface Liquidacao {
  devolvidoAoCliente: number
  creditoAoCliente: number
  barbearia: number
  navalha: number
  custoGateway: number
  quemPagaGateway: string
}

export interface PreviaCancelamento {
  evento: string
  opcoes: (Liquidacao & { escolhaPix?: 'credito' | 'reembolso' })[]
}

export const STATUS: Record<StatusAgendamento, { rotulo: string; tom: Tom }> = {
  reservado: { rotulo: 'Reservado', tom: 'info' },
  confirmado: { rotulo: 'Confirmado', tom: 'sucesso' },
  em_atendimento: { rotulo: 'Em atendimento', tom: 'alerta' },
  concluido: { rotulo: 'Concluído', tom: 'neutro' },
  cancelado_no_prazo: { rotulo: 'Cancelado', tom: 'perigo' },
  cancelado_fora_do_prazo: { rotulo: 'Cancelado fora do prazo', tom: 'perigo' },
  cancelado_pela_barbearia: { rotulo: 'Cancelado pela barbearia', tom: 'perigo' },
  no_show: { rotulo: 'Não compareceu', tom: 'perigo' },
  liberado: { rotulo: 'Liberado', tom: 'neutro' },
}

export type Tom = 'neutro' | 'sucesso' | 'alerta' | 'perigo' | 'info'
