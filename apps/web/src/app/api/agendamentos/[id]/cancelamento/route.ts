import { cancelarAgendamento, previaDoCancelamento } from '@navalha/servidor'
import { contexto, publicar } from '@/server/contexto'
import { esquemaCancelamento } from '@/server/esquemas'
import { lerJson, tratar } from '@/server/http'
import { usuarioDaRequisicao } from '@/server/sessao'

type Contexto = RouteContext<'/api/agendamentos/[id]/cancelamento'>

// GET: o que acontece com o dinheiro se cancelar agora (Cliente 15, Admin 02j).
export async function GET(requisicao: Request, { params }: Contexto) {
  return tratar(async () => {
    const usuario = await usuarioDaRequisicao(requisicao)
    return previaDoCancelamento(contexto(), usuario, (await params).id)
  })
}

// POST: cancela (cliente ou barbearia); a liquidação roda no job.
export async function POST(requisicao: Request, { params }: Contexto) {
  return tratar(async () => {
    const usuario = await usuarioDaRequisicao(requisicao)
    const { escolhaPix, motivo } = await lerJson(requisicao, esquemaCancelamento)
    const { status, eventos } = await cancelarAgendamento(contexto(), usuario, {
      agendamentoId: (await params).id,
      ...(escolhaPix ? { escolhaPix } : {}),
      ...(motivo ? { motivo } : {}),
    })
    await publicar(eventos)
    return { status }
  })
}
