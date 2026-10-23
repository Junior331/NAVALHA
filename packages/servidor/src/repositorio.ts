import type { Plano, StatusAgendamento } from '@navalha/core'
import type { Enum, Sql } from '@navalha/db'
import { ErroDeNegocio } from './erros'

// Leituras compartilhadas pelos serviços. A conexão do servidor ignora o RLS: quem chama é que
// confere a permissão do usuário.

export interface AgendamentoCompleto {
  id: string
  codigo: string
  barbeariaId: string
  barbeariaNome: string
  barbeiroId: string
  clienteId: string
  clienteUsuarioId: string | null
  status: StatusAgendamento
  inicio: Date
  fim: Date
  prazoGratisAte: Date
  toleranciaAte: Date
  retencaoPct: number
  plano: Plano
  valorPagoCentavos: number
  usouPremioFidelidade: boolean
  subcontaId: string | null
  pagamento: PagamentoDoAgendamento | null
}

export interface PagamentoDoAgendamento {
  id: string
  meio: Enum<'meio_pagamento'>
  status: Enum<'status_pagamento'>
  valorCentavos: number
  taxaGatewayCentavos: number
  valorEstornadoCentavos: number
  cobrancaId: string | null
  cartaoToken: string | null
  ipRemoto: string | null
  preAutorizarEm: Date | null
  capturarEm: Date | null
  regularizarAte: Date | null
}

export async function carregarAgendamento(
  sql: Sql,
  agendamentoId: string,
  opcoes: { travar?: boolean } = {},
): Promise<AgendamentoCompleto> {
  const travar = opcoes.travar ? sql`for update of a` : sql``
  const [linha] = await sql<
    {
      id: string
      codigo: string
      barbearia_id: string
      barbearia_nome: string
      barbeiro_id: string
      cliente_id: string
      cliente_usuario_id: string | null
      status: StatusAgendamento
      inicio: Date
      fim: Date
      prazo_gratis_ate: Date
      tolerancia_ate: Date
      retencao_pct: number
      plano: Plano
      valor_pago_centavos: number
      usou_premio_fidelidade: boolean
      subconta_id: string | null
      pagamento_id: string | null
      meio: Enum<'meio_pagamento'> | null
      status_pagamento: Enum<'status_pagamento'> | null
      valor_centavos: number | null
      taxa_gateway_centavos: number | null
      valor_estornado_centavos: number | null
      asaas_cobranca_id: string | null
      cartao_token: string | null
      ip_remoto: string | null
      pre_autorizar_em: Date | null
      capturar_em: Date | null
      regularizar_ate: Date | null
    }[]
  >`
    select a.id, a.codigo, a.barbearia_id, b.nome as barbearia_nome, a.barbeiro_id, a.cliente_id,
      c.usuario_id as cliente_usuario_id, a.status, a.inicio, a.fim, a.prazo_gratis_ate,
      a.tolerancia_ate, a.retencao_pct, a.plano, a.valor_pago_centavos, a.usou_premio_fidelidade,
      s.asaas_conta_id as subconta_id,
      p.id as pagamento_id, p.meio, p.status as status_pagamento, p.valor_centavos,
      p.taxa_gateway_centavos, p.valor_estornado_centavos, p.asaas_cobranca_id, p.cartao_token,
      host(p.ip_remoto) as ip_remoto, p.pre_autorizar_em, p.capturar_em, p.regularizar_ate
    from public.agendamentos a
    join public.barbearias b on b.id = a.barbearia_id
    join public.clientes c on c.id = a.cliente_id
    left join public.subcontas_asaas s on s.barbearia_id = a.barbearia_id
    left join public.pagamentos p on p.agendamento_id = a.id
    where a.id = ${agendamentoId}
    ${travar}
  `
  if (!linha) throw new ErroDeNegocio('nao_encontrado', 'Agendamento não encontrado')

  return {
    id: linha.id,
    codigo: linha.codigo,
    barbeariaId: linha.barbearia_id,
    barbeariaNome: linha.barbearia_nome,
    barbeiroId: linha.barbeiro_id,
    clienteId: linha.cliente_id,
    clienteUsuarioId: linha.cliente_usuario_id,
    status: linha.status,
    inicio: linha.inicio,
    fim: linha.fim,
    prazoGratisAte: linha.prazo_gratis_ate,
    toleranciaAte: linha.tolerancia_ate,
    retencaoPct: linha.retencao_pct,
    plano: linha.plano,
    valorPagoCentavos: linha.valor_pago_centavos,
    usouPremioFidelidade: linha.usou_premio_fidelidade,
    subcontaId: linha.subconta_id,
    pagamento:
      linha.pagamento_id && linha.meio && linha.status_pagamento
        ? {
            id: linha.pagamento_id,
            meio: linha.meio,
            status: linha.status_pagamento,
            valorCentavos: linha.valor_centavos ?? 0,
            taxaGatewayCentavos: linha.taxa_gateway_centavos ?? 0,
            valorEstornadoCentavos: linha.valor_estornado_centavos ?? 0,
            cobrancaId: linha.asaas_cobranca_id,
            cartaoToken: linha.cartao_token,
            ipRemoto: linha.ip_remoto,
            preAutorizarEm: linha.pre_autorizar_em,
            capturarEm: linha.capturar_em,
            regularizarAte: linha.regularizar_ate,
          }
        : null,
  }
}

export function exigirSubconta(agendamento: AgendamentoCompleto): string {
  if (!agendamento.subcontaId) {
    throw new ErroDeNegocio('recebimentos_inativos', 'A barbearia ainda não ativou os recebimentos')
  }
  return agendamento.subcontaId
}

export async function clienteNoGateway(
  sql: Sql,
  clienteId: string,
  barbeariaId: string,
): Promise<string | null> {
  const [linha] = await sql<{ gateway_cliente_id: string }[]>`
    select gateway_cliente_id from public.clientes_gateway
    where cliente_id = ${clienteId} and barbearia_id = ${barbeariaId}
  `
  return linha?.gateway_cliente_id ?? null
}

// O Intl separa "R$" do número com espaço não separável (U+00A0); nas mensagens, espaço comum.
const ESPACO_FIXO = new RegExp(String.fromCharCode(0xa0), 'g')

export function reais(centavos: number): string {
  return (centavos / 100)
    .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    .replace(ESPACO_FIXO, ' ')
}

export function horaLocal(data: Date): string {
  return data.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })
}
