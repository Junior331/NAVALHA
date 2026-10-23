import { consultarDisponibilidade, ErroDeNegocio, horariosDaEquipe } from '@navalha/servidor'
import { contexto } from '@/server/contexto'
import { tratar } from '@/server/http'
import { usuarioDaRequisicao } from '@/server/sessao'

// Horários livres do dia (Cliente 08 e 09). Público: a página web mostra antes do login.
// ?data=YYYY-MM-DD&servicos=id1,id2&barbeiro=id. Com &equipe=1 (balcão, Admin 02d–02h), exige
// sessão de alguém da barbearia e não aplica a antecedência mínima.
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
    const consulta = {
      barbeariaId: (await params).id,
      data,
      servicoIds,
      ...(barbeiroId ? { barbeiroId } : {}),
    }
    if (url.searchParams.get('equipe') === '1') {
      return horariosDaEquipe(contexto(), await usuarioDaRequisicao(requisicao), consulta)
    }
    return consultarDisponibilidade(contexto(), consulta)
  })
}
