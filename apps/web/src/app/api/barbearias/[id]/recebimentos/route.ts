import { ativarRecebimentos } from '@navalha/servidor'
import { contexto } from '@/server/contexto'
import { esquemaAtivacao } from '@/server/esquemas'
import { lerJson, tratar } from '@/server/http'
import { usuarioDaRequisicao } from '@/server/sessao'

// Ativar recebimentos (ajustes-taxas §Subconta): cria a subconta com Escrow no gateway.
export async function POST(
  requisicao: Request,
  { params }: RouteContext<'/api/barbearias/[id]/recebimentos'>,
) {
  return tratar(async () => {
    const usuario = await usuarioDaRequisicao(requisicao)
    const dados = await lerJson(requisicao, esquemaAtivacao)
    return ativarRecebimentos(contexto(), usuario, { barbeariaId: (await params).id, ...dados })
  })
}
