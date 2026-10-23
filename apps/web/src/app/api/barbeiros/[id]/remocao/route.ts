import { removerBarbeiro } from '@navalha/servidor'
import { contexto, publicar } from '@/server/contexto'
import { tratar } from '@/server/http'
import { usuarioDaRequisicao } from '@/server/sessao'

// Remover da barbearia (Admin 03c): cancela os futuros com estorno integral e avisa os clientes.
export async function POST(
  requisicao: Request,
  { params }: RouteContext<'/api/barbeiros/[id]/remocao'>,
) {
  return tratar(async () => {
    const usuario = await usuarioDaRequisicao(requisicao)
    const { cancelados, eventos } = await removerBarbeiro(contexto(), usuario, {
      membroId: (await params).id,
    })
    await publicar(eventos)
    return { cancelados }
  })
}
