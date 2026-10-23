import {
  liquidar,
  percentualPraBaixo,
  transicionar,
  TransicaoInvalida,
  type EscolhaPixNoPrazo,
  type EventoAgendamento,
  type EventoFinal,
  type Liquidacao,
  type StatusAgendamento,
} from '@navalha/core'
import type { Contexto, EventoInterno } from '../contexto'
import { ErroDeNegocio } from '../erros'
import { carregarAgendamento, type AgendamentoCompleto } from '../repositorio'
import { papelNaBarbearia, type Usuario } from './acesso'

// Ciclo do atendimento: cancelar (cliente ou barbearia), iniciar, concluir e no-show manual.
// O dinheiro é liquidado depois, pelo job (regras-de-negocio §Cenários de liquidação).

type Quem = { tipo: 'cliente' } | { tipo: 'equipe'; papel: 'dono' | 'barbeiro' }

async function quemPede(ctx: Contexto, usuario: Usuario, ag: AgendamentoCompleto): Promise<Quem> {
  const membro = await papelNaBarbearia(ctx.sql, usuario.id, ag.barbeariaId)
  if (membro) return { tipo: 'equipe', papel: membro.papel }
  if (ag.clienteUsuarioId === usuario.id) return { tipo: 'cliente' }
  throw new ErroDeNegocio('sem_permissao', 'Você não tem acesso a este agendamento')
}

function proximo(status: StatusAgendamento, evento: EventoAgendamento): StatusAgendamento {
  try {
    return transicionar(status, evento)
  } catch (erro) {
    if (erro instanceof TransicaoInvalida) {
      throw new ErroDeNegocio(
        'estado_invalido',
        'Essa ação não vale para o agendamento neste momento',
      )
    }
    throw erro
  }
}

async function mudarStatus(
  ctx: Contexto,
  ag: AgendamentoCompleto,
  novo: StatusAgendamento,
  extra: { carimbo?: 'iniciado_em' | 'concluido_em' | 'cancelado_em'; motivo?: string } = {},
): Promise<void> {
  const carimbo = extra.carimbo ? ctx.sql`, ${ctx.sql(extra.carimbo)} = ${ctx.agora()}` : ctx.sql``
  const motivo = extra.motivo ? ctx.sql`, motivo_cancelamento = ${extra.motivo}` : ctx.sql``
  const alterados = await ctx.sql`
    update public.agendamentos set status = ${novo} ${carimbo} ${motivo}
    where id = ${ag.id} and status = ${ag.status}
    returning id`
  if (alterados.length === 0) {
    throw new ErroDeNegocio(
      'estado_invalido',
      'O agendamento mudou enquanto você agia. Atualize a tela.',
    )
  }
}

function eventoDoCancelamento(ag: AgendamentoCompleto, quem: Quem, agora: Date): EventoAgendamento {
  if (quem.tipo === 'equipe') return 'barbearia_cancelou'
  // Reservado só existe antes da janela de 72h, sempre dentro do prazo grátis.
  if (ag.status === 'reservado') return 'cliente_cancelou_no_prazo'
  return agora.getTime() <= ag.prazoGratisAte.getTime()
    ? 'cliente_cancelou_no_prazo'
    : 'cliente_cancelou_fora_do_prazo'
}

const EVENTO_FINAL: Partial<Record<EventoAgendamento, EventoFinal>> = {
  cliente_cancelou_no_prazo: 'cancelado_no_prazo',
  cliente_cancelou_fora_do_prazo: 'cancelado_fora_do_prazo',
  barbearia_cancelou: 'cancelado_pela_barbearia',
}

export interface PreviaCancelamento {
  evento: EventoFinal
  /** Pix cancelado no prazo: o cliente escolhe entre crédito e reembolso. */
  opcoes: ({ escolhaPix?: EscolhaPixNoPrazo } & Liquidacao)[]
}

/** O que acontece com o dinheiro se cancelar agora (Figma Cliente 15 e Admin 02j). */
export async function previaDoCancelamento(
  ctx: Contexto,
  usuario: Usuario,
  agendamentoId: string,
): Promise<PreviaCancelamento> {
  const ag = await carregarAgendamento(ctx.sql, agendamentoId)
  const quem = await quemPede(ctx, usuario, ag)
  const evento = EVENTO_FINAL[eventoDoCancelamento(ag, quem, ctx.agora())]
  if (!evento) throw new ErroDeNegocio('estado_invalido', 'Não dá para cancelar este agendamento')
  proximo(ag.status, eventoDoCancelamento(ag, quem, ctx.agora()))

  const pagamento = ag.pagamento
  const cobrado = pagamento?.status === 'capturado' || pagamento?.status === 'pix_pago'
  const cartaoAindaNaoCapturado = pagamento?.meio === 'cartao' && !cobrado
  // G: o já cobrado, ou a estimativa da tarifa cheia do cartão se a captura ainda vai acontecer.
  const g = cobrado
    ? pagamento.taxaGatewayCentavos
    : pagamento?.meio === 'cartao' && evento === 'cancelado_fora_do_prazo'
      ? percentualPraBaixo(ag.valorPagoCentavos, 299) + 49
      : 0
  const base = {
    evento,
    plano: ag.plano,
    meio: pagamento?.meio ?? ('pix' as const),
    valorPago: pagamento ? ag.valorPagoCentavos : 0,
    retencaoPct: ag.retencaoPct,
    taxaGateway: g,
    custoEstorno: evento === 'cancelado_pela_barbearia' && !cartaoAindaNaoCapturado ? g : 0,
    custoPix: ctx.config.custoEstornoPix,
  }
  if (pagamento?.meio === 'pix' && evento === 'cancelado_no_prazo') {
    return {
      evento,
      opcoes: (['credito', 'reembolso'] as const).map((escolhaPix) => ({
        escolhaPix,
        ...liquidar({ ...base, escolhaPix }),
      })),
    }
  }
  return { evento, opcoes: [liquidar(base)] }
}

export async function cancelarAgendamento(
  ctx: Contexto,
  usuario: Usuario,
  params: { agendamentoId: string; escolhaPix?: EscolhaPixNoPrazo; motivo?: string },
): Promise<{ status: StatusAgendamento; eventos: EventoInterno[] }> {
  const ag = await carregarAgendamento(ctx.sql, params.agendamentoId)
  const quem = await quemPede(ctx, usuario, ag)
  const evento = eventoDoCancelamento(ag, quem, ctx.agora())
  const novo = proximo(ag.status, evento)
  if (novo === 'cancelado_no_prazo' && ag.pagamento?.meio === 'pix' && !params.escolhaPix) {
    throw new ErroDeNegocio('dados_invalidos', 'Escolha entre crédito na barbearia e reembolso')
  }
  await mudarStatus(ctx, ag, novo, {
    carimbo: 'cancelado_em',
    ...(params.motivo ? { motivo: params.motivo } : {}),
  })

  if (quem.tipo === 'cliente') await avisarEquipe(ctx, ag, 'Agendamento cancelado pelo cliente')
  return {
    status: novo,
    eventos: [
      { name: 'agendamento/cancelado', data: { agendamentoId: ag.id } },
      {
        name: 'agendamento/finalizado',
        data: {
          agendamentoId: ag.id,
          ...(params.escolhaPix ? { escolhaPix: params.escolhaPix } : {}),
        },
      },
    ],
  }
}

async function exigirEquipe(
  ctx: Contexto,
  usuario: Usuario,
  ag: AgendamentoCompleto,
): Promise<void> {
  const quem = await quemPede(ctx, usuario, ag)
  if (quem.tipo !== 'equipe') {
    throw new ErroDeNegocio('sem_permissao', 'Só a equipe da barbearia pode fazer isso')
  }
}

export async function iniciarAtendimento(
  ctx: Contexto,
  usuario: Usuario,
  agendamentoId: string,
): Promise<{ status: StatusAgendamento; eventos: EventoInterno[] }> {
  const ag = await carregarAgendamento(ctx.sql, agendamentoId)
  await exigirEquipe(ctx, usuario, ag)
  const novo = proximo(ag.status, 'atendimento_iniciado')
  await mudarStatus(ctx, ag, novo, { carimbo: 'iniciado_em' })
  return { status: novo, eventos: [] }
}

export async function concluirAtendimento(
  ctx: Contexto,
  usuario: Usuario,
  agendamentoId: string,
): Promise<{ status: StatusAgendamento; eventos: EventoInterno[] }> {
  const ag = await carregarAgendamento(ctx.sql, agendamentoId)
  await exigirEquipe(ctx, usuario, ag)
  const novo = proximo(ag.status, 'atendimento_concluido')
  await mudarStatus(ctx, ag, novo, { carimbo: 'concluido_em' })
  return {
    status: novo,
    eventos: [{ name: 'agendamento/finalizado', data: { agendamentoId: ag.id } }],
  }
}

/** No-show é evento próprio, separado de cancelamento (CLAUDE.md); só depois da tolerância. */
export async function marcarNoShow(
  ctx: Contexto,
  usuario: Usuario,
  agendamentoId: string,
): Promise<{ status: StatusAgendamento; eventos: EventoInterno[] }> {
  const ag = await carregarAgendamento(ctx.sql, agendamentoId)
  await exigirEquipe(ctx, usuario, ag)
  if (ctx.agora().getTime() <= ag.toleranciaAte.getTime()) {
    throw new ErroDeNegocio(
      'estado_invalido',
      'O cliente ainda está dentro da tolerância de atraso',
    )
  }
  const novo = proximo(ag.status, 'no_show')
  await mudarStatus(ctx, ag, novo)
  return {
    status: novo,
    eventos: [
      { name: 'agendamento/cancelado', data: { agendamentoId: ag.id } },
      { name: 'agendamento/finalizado', data: { agendamentoId: ag.id } },
    ],
  }
}

async function avisarEquipe(ctx: Contexto, ag: AgendamentoCompleto, titulo: string): Promise<void> {
  const [barbeiro] = await ctx.sql<{ usuario_id: string }[]>`
    select usuario_id from public.membros where id = ${ag.barbeiroId}`
  if (!barbeiro) return
  await ctx.notificador.notificar({
    usuarioId: barbeiro.usuario_id,
    titulo,
    corpo: `${ag.codigo} · o horário foi liberado na agenda.`,
    tipo: 'cancelamento',
    dados: { agendamentoId: ag.id },
  })
}
