import { definirAgendamentosOnline } from '@navalha/servidor'
import { contexto } from '@/server/contexto'
import { esquemaAgendamentosOnline } from '@/server/esquemas'
import { lerJson, tratar } from '@/server/http'
import { usuarioDaRequisicao } from '@/server/sessao'

// Interruptor "Aceitar agendamentos online" (Admin 09): só liga com os recebimentos ativos.
export async function POST(
  requisicao: Request,
  { params }: RouteContext<'/api/barbearias/[id]/agendamentos-online'>,
) {
  return tratar(async () => {
    const usuario = await usuarioDaRequisicao(requisicao)
    const { aceitar } = await lerJson(requisicao, esquemaAgendamentosOnline)
    return definirAgendamentosOnline(contexto(), usuario, {
      barbeariaId: (await params).id,
      aceitar,
    })
  })
}
