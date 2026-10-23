import { iniciarAtendimento } from '@navalha/servidor'
import { contexto, publicar } from '@/server/contexto'
import { tratar } from '@/server/http'
import { usuarioDaRequisicao } from '@/server/sessao'

// Barbeiro 07: iniciar atendimento.
export async function POST(
  requisicao: Request,
  { params }: RouteContext<'/api/agendamentos/[id]/iniciar'>,
) {
  return tratar(async () => {
    const usuario = await usuarioDaRequisicao(requisicao)
    const { status, eventos } = await iniciarAtendimento(contexto(), usuario, (await params).id)
    await publicar(eventos)
    return { status }
  })
}
