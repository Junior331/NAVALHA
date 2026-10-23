import { situacaoDoAgendamento } from '@navalha/servidor'
import { contexto } from '@/server/contexto'
import { tratar } from '@/server/http'
import { usuarioDaRequisicao } from '@/server/sessao'

// Situação do agendamento para quem agendou (Cliente 11 e 12): a tela do Pix consulta até o
// pagamento virar agendamento.
export async function GET(requisicao: Request, { params }: RouteContext<'/api/agendamentos/[id]'>) {
  return tratar(async () => {
    const usuario = await usuarioDaRequisicao(requisicao)
    return situacaoDoAgendamento(contexto(), usuario, (await params).id)
  })
}
