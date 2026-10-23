import { marcarNoShow } from '@navalha/servidor'
import { contexto, publicar } from '@/server/contexto'
import { tratar } from '@/server/http'
import { usuarioDaRequisicao } from '@/server/sessao'

// No-show manual, só depois da tolerância (evento próprio, separado de cancelamento: CLAUDE.md).
export async function POST(
  requisicao: Request,
  { params }: RouteContext<'/api/agendamentos/[id]/no-show'>,
) {
  return tratar(async () => {
    const usuario = await usuarioDaRequisicao(requisicao)
    const { status, eventos } = await marcarNoShow(contexto(), usuario, (await params).id)
    await publicar(eventos)
    return { status }
  })
}
