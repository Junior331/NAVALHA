import { solicitarSaque } from '@navalha/servidor'
import { contexto } from '@/server/contexto'
import { esquemaSaque } from '@/server/esquemas'
import { lerJson, tratar } from '@/server/http'
import { usuarioDaRequisicao } from '@/server/sessao'

// Saque do disponível por Pix (regras-de-negocio §Decisões: manual, mínimo de R$ 50).
export async function POST(
  requisicao: Request,
  { params }: RouteContext<'/api/barbearias/[id]/saques'>,
) {
  return tratar(async () => {
    const usuario = await usuarioDaRequisicao(requisicao)
    const { valorCentavos } = await lerJson(requisicao, esquemaSaque)
    return solicitarSaque(contexto(), usuario, { barbeariaId: (await params).id, valorCentavos })
  })
}
