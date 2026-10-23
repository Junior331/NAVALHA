import { agendamentosAfetados } from '@navalha/servidor'
import { contexto } from '@/server/contexto'
import { tratar } from '@/server/http'
import { usuarioDaRequisicao } from '@/server/sessao'

// Quantos agendamentos ativos o barbeiro tem a partir de agora, ou num período (?inicio&fim).
export async function GET(
  requisicao: Request,
  { params }: RouteContext<'/api/barbeiros/[id]/afetados'>,
) {
  return tratar(async () => {
    const usuario = await usuarioDaRequisicao(requisicao)
    const url = new URL(requisicao.url)
    const inicio = url.searchParams.get('inicio')
    const fim = url.searchParams.get('fim')
    return agendamentosAfetados(contexto(), usuario, {
      membroId: (await params).id,
      ...(inicio ? { inicio } : {}),
      ...(fim ? { fim } : {}),
    })
  })
}
