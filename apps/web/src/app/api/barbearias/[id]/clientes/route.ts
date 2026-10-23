import { buscarClientes } from '@navalha/servidor'
import { contexto } from '@/server/contexto'
import { tratar } from '@/server/http'
import { usuarioDaRequisicao } from '@/server/sessao'

// Clientes que já agendaram na barbearia (Admin 02d · Cliente). ?termo=nome ou celular
export async function GET(
  requisicao: Request,
  { params }: RouteContext<'/api/barbearias/[id]/clientes'>,
) {
  return tratar(async () => {
    const usuario = await usuarioDaRequisicao(requisicao)
    const termo = new URL(requisicao.url).searchParams.get('termo') ?? ''
    return buscarClientes(contexto(), usuario, { barbeariaId: (await params).id, termo })
  })
}
