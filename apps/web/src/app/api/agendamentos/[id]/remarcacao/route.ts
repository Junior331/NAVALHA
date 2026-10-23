import { ErroDeNegocio, horariosParaRemarcar, remarcarAgendamento } from '@navalha/servidor'
import { contexto, publicar } from '@/server/contexto'
import { esquemaRemarcacao } from '@/server/esquemas'
import { lerJson, tratar } from '@/server/http'
import { usuarioDaRequisicao } from '@/server/sessao'

type Contexto = RouteContext<'/api/agendamentos/[id]/remarcacao'>

// GET: horários livres para remarcar (Admin 02i, Cliente 13). ?data=YYYY-MM-DD&barbeiro=id
export async function GET(requisicao: Request, { params }: Contexto) {
  return tratar(async () => {
    const usuario = await usuarioDaRequisicao(requisicao)
    const url = new URL(requisicao.url)
    const data = url.searchParams.get('data') ?? ''
    const barbeiroId = url.searchParams.get('barbeiro')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data))
      throw new ErroDeNegocio('dados_invalidos', 'Informe a data')
    return horariosParaRemarcar(contexto(), usuario, {
      agendamentoId: (await params).id,
      data,
      ...(barbeiroId ? { barbeiroId } : {}),
    })
  })
}

// POST: remarca; os jobs do horário antigo se descartam pela versão.
export async function POST(requisicao: Request, { params }: Contexto) {
  return tratar(async () => {
    const usuario = await usuarioDaRequisicao(requisicao)
    const { inicio, barbeiroId } = await lerJson(requisicao, esquemaRemarcacao)
    const { versao, eventos } = await remarcarAgendamento(contexto(), usuario, {
      agendamentoId: (await params).id,
      inicio,
      ...(barbeiroId ? { barbeiroId } : {}),
    })
    await publicar(eventos)
    return { versao }
  })
}
