import { concluirAtendimento } from '@navalha/servidor'
import { contexto, publicar } from '@/server/contexto'
import { tratar } from '@/server/http'
import { usuarioDaRequisicao } from '@/server/sessao'

// Barbeiro 07c: concluir atendimento (dispara a liquidação).
export async function POST(
  requisicao: Request,
  { params }: RouteContext<'/api/agendamentos/[id]/concluir'>,
) {
  return tratar(async () => {
    const usuario = await usuarioDaRequisicao(requisicao)
    const { status, eventos } = await concluirAtendimento(contexto(), usuario, (await params).id)
    await publicar(eventos)
    return { status }
  })
}
