import { deveMarcarNoShow, transicionar } from '@navalha/core'
import type { Contexto, Resultado } from '../contexto'
import { carregarAgendamento, horaLocal, versaoVencida } from '../repositorio'

// Rotinas presas ao horário do agendamento: no-show ao fim da tolerância e lembrete 1h antes.

export async function marcarNoShowSeVencido(
  ctx: Contexto,
  agendamentoId: string,
  versao?: number,
): Promise<Resultado<'no_show' | 'ignorado'>> {
  const ag = await carregarAgendamento(ctx.sql, agendamentoId)
  if (versaoVencida(ag, versao)) return { resultado: 'ignorado', eventos: [] }
  const toleranciaMin = (ag.toleranciaAte.getTime() - ag.inicio.getTime()) / 60_000
  const vencido = deveMarcarNoShow({
    agora: ctx.agora(),
    inicio: ag.inicio,
    politica: { prazoGratisHoras: 0, retencaoPct: ag.retencaoPct, toleranciaMin },
    status: ag.status,
  })
  if (!vencido) return { resultado: 'ignorado', eventos: [] }

  const alterados = await ctx.sql`
    update public.agendamentos set status = ${transicionar('confirmado', 'no_show')}
    where id = ${ag.id} and status = 'confirmado'
    returning id`
  if (alterados.length === 0) return { resultado: 'ignorado', eventos: [] }

  return {
    resultado: 'no_show',
    eventos: [{ name: 'agendamento/finalizado', data: { agendamentoId: ag.id } }],
  }
}

export async function enviarLembrete(
  ctx: Contexto,
  agendamentoId: string,
  versao?: number,
): Promise<Resultado<'enviado' | 'ignorado'>> {
  const ag = await carregarAgendamento(ctx.sql, agendamentoId)
  if (versaoVencida(ag, versao)) return { resultado: 'ignorado', eventos: [] }
  if (ag.status !== 'confirmado' || !ag.clienteUsuarioId)
    return { resultado: 'ignorado', eventos: [] }
  await ctx.notificador.notificar({
    usuarioId: ag.clienteUsuarioId,
    titulo: 'Seu horário é daqui a 1 hora',
    corpo: `${ag.barbeariaNome}, às ${horaLocal(ag.inicio)}. Código ${ag.codigo}.`,
    tipo: 'lembrete',
    dados: { agendamentoId: ag.id },
  })
  return { resultado: 'enviado', eventos: [] }
}
