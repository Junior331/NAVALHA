import { ErroDeNegocio, paginaDaBarbearia } from '@navalha/servidor'
import { contexto } from '@/server/contexto'
import { tratar } from '@/server/http'

// Página da barbearia no app (Cliente 03): os mesmos dados da página pública da web.
export async function GET(_requisicao: Request, { params }: RouteContext<'/api/vitrine/[slug]'>) {
  return tratar(async () => {
    const pagina = await paginaDaBarbearia(contexto(), (await params).slug)
    if (!pagina) throw new ErroDeNegocio('nao_encontrado', 'Barbearia não encontrada')
    return pagina
  })
}
