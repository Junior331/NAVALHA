import { marcarNoShow, previaDoNoShow } from '@navalha/servidor'
import { contexto, publicar } from '@/server/contexto'
import { tratar } from '@/server/http'
import { usuarioDaRequisicao } from '@/server/sessao'

type Contexto = RouteContext<'/api/agendamentos/[id]/no-show'>

// GET: os valores antes de confirmar (backlog Admin · No-show): retenção e partes de cada um.
export async function GET(requisicao: Request, { params }: Contexto) {
  return tratar(async () => {
    const usuario = await usuarioDaRequisicao(requisicao)
    return previaDoNoShow(contexto(), usuario, (await params).id)
  })
}

// POST: no-show manual, só depois da tolerância (evento próprio, separado de cancelamento: CLAUDE.md).
export async function POST(requisicao: Request, { params }: Contexto) {
  return tratar(async () => {
    const usuario = await usuarioDaRequisicao(requisicao)
    const { status, eventos } = await marcarNoShow(contexto(), usuario, (await params).id)
    await publicar(eventos)
    return { status }
  })
}
