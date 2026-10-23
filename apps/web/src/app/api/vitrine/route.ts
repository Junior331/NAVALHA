import { buscarBarbearias } from '@navalha/servidor'
import { contexto } from '@/server/contexto'
import { tratar } from '@/server/http'

// Busca de barbearias do app (Cliente 04). Pública. ?busca=termo
export async function GET(requisicao: Request) {
  return tratar(async () => {
    const termo = new URL(requisicao.url).searchParams.get('busca') ?? ''
    return buscarBarbearias(contexto(), termo)
  })
}
