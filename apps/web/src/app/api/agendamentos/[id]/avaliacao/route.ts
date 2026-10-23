import { avaliarAtendimento } from '@navalha/servidor'
import { z } from 'zod'
import { contexto } from '@/server/contexto'
import { lerJson, tratar } from '@/server/http'
import { usuarioDaRequisicao } from '@/server/sessao'

const esquema = z.object({
  nota: z.number().int().min(1).max(5),
  comentario: z.string().trim().max(500).optional(),
})

// Avaliar o atendimento (Cliente 16).
export async function POST(
  requisicao: Request,
  { params }: RouteContext<'/api/agendamentos/[id]/avaliacao'>,
) {
  return tratar(async () => {
    const usuario = await usuarioDaRequisicao(requisicao)
    const { nota, comentario } = await lerJson(requisicao, esquema)
    return avaliarAtendimento(contexto(), usuario, {
      agendamentoId: (await params).id,
      nota,
      ...(comentario ? { comentario } : {}),
    })
  })
}
