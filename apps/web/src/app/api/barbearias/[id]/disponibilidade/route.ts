import { consultarDisponibilidade, ErroDeNegocio } from '@navalha/servidor'
import { contexto } from '@/server/contexto'
import { tratar } from '@/server/http'

// Horários livres do dia (Cliente 08 e 09). Público: a página web mostra antes do login.
// ?data=YYYY-MM-DD&servicos=id1,id2&barbeiro=id
export async function GET(
  requisicao: Request,
  { params }: RouteContext<'/api/barbearias/[id]/disponibilidade'>,
) {
  return tratar(async () => {
    const url = new URL(requisicao.url)
    const data = url.searchParams.get('data') ?? ''
    const servicoIds = (url.searchParams.get('servicos') ?? '').split(',').filter(Boolean)
    const barbeiroId = url.searchParams.get('barbeiro')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data))
      throw new ErroDeNegocio('dados_invalidos', 'Informe a data')
    return consultarDisponibilidade(contexto(), {
      barbeariaId: (await params).id,
      data,
      servicoIds,
      ...(barbeiroId ? { barbeiroId } : {}),
    })
  })
}
