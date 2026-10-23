import { pausarAgenda } from '@navalha/servidor'
import { z } from 'zod'
import { contexto } from '@/server/contexto'
import { lerJson, tratar } from '@/server/http'
import { usuarioDaRequisicao } from '@/server/sessao'

const esquema = z.object({
  inicio: z.iso.datetime({ offset: true }),
  fim: z.iso.datetime({ offset: true }),
  motivo: z.string().trim().max(120).optional(),
})

// Pausar agenda (Barbeiro 04b, Admin 03c).
export async function POST(
  requisicao: Request,
  { params }: RouteContext<'/api/barbeiros/[id]/pausa'>,
) {
  return tratar(async () => {
    const usuario = await usuarioDaRequisicao(requisicao)
    const { motivo, ...periodo } = await lerJson(requisicao, esquema)
    return pausarAgenda(contexto(), usuario, {
      membroId: (await params).id,
      ...periodo,
      ...(motivo ? { motivo } : {}),
    })
  })
}
