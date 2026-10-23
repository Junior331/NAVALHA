import type { Contexto } from '../contexto'
import { ErroDeNegocio } from '../erros'
import { carregarAgendamento } from '../repositorio'
import type { Usuario } from './acesso'

// Avaliar o atendimento (Cliente 16): só quem foi atendido, uma vez por agendamento.
export async function avaliarAtendimento(
  ctx: Contexto,
  usuario: Usuario,
  params: { agendamentoId: string; nota: number; comentario?: string },
): Promise<{ avaliacaoId: string }> {
  const ag = await carregarAgendamento(ctx.sql, params.agendamentoId)
  if (ag.clienteUsuarioId !== usuario.id) {
    throw new ErroDeNegocio('nao_encontrado', 'Agendamento não encontrado')
  }
  if (ag.status !== 'concluido') {
    throw new ErroDeNegocio('estado_invalido', 'Dá para avaliar depois que o atendimento termina')
  }
  if (!Number.isInteger(params.nota) || params.nota < 1 || params.nota > 5) {
    throw new ErroDeNegocio('dados_invalidos', 'A nota vai de 1 a 5')
  }
  const [linha] = await ctx.sql<{ id: string }[]>`
    insert into public.avaliacoes (barbearia_id, agendamento_id, cliente_id, membro_id, nota, comentario)
    values (${ag.barbeariaId}, ${ag.id}, ${ag.clienteId}, ${ag.barbeiroId}, ${params.nota},
      ${params.comentario?.trim() || null})
    on conflict (agendamento_id) do nothing
    returning id`
  if (!linha) throw new ErroDeNegocio('estado_invalido', 'Esse atendimento já foi avaliado')
  return { avaliacaoId: linha.id }
}
