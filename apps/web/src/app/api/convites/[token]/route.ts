import { aceitarConvite, consultarConvite } from '@navalha/servidor'
import { contexto } from '@/server/contexto'
import { tratar } from '@/server/http'
import { usuarioDaRequisicao } from '@/server/sessao'

type Contexto = RouteContext<'/api/convites/[token]'>

// Convite 01: quem convidou e se ainda vale (público, antes do login).
export async function GET(_requisicao: Request, { params }: Contexto) {
  return tratar(async () => consultarConvite(contexto(), (await params).token))
}

// Convite 02/03: o barbeiro logado aceita e entra na equipe.
export async function POST(requisicao: Request, { params }: Contexto) {
  return tratar(async () => {
    const usuario = await usuarioDaRequisicao(requisicao)
    return aceitarConvite(contexto(), usuario, { token: (await params).token })
  })
}
