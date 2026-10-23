import { criarAgendamento } from '@navalha/servidor'
import { contexto, publicar } from '@/server/contexto'
import { esquemaAgendamento } from '@/server/esquemas'
import { ipDaRequisicao, lerJson, tratar } from '@/server/http'
import { usuarioDaRequisicao } from '@/server/sessao'

// Agendar (Figma Cliente 07–12): Pix devolve o QR Code; cartão devolve o agendamento.
export async function POST(requisicao: Request) {
  return tratar(async () => {
    const usuario = await usuarioDaRequisicao(requisicao)
    const { cupom, usarPremio, cartao, titular, ...entrada } = await lerJson(
      requisicao,
      esquemaAgendamento,
    )
    const { saida, eventos } = await criarAgendamento(contexto(), usuario, {
      ...entrada,
      ...(cupom ? { cupom } : {}),
      ...(usarPremio ? { usarPremio } : {}),
      ...(cartao ? { cartao } : {}),
      ...(titular ? { titular } : {}),
      ipRemoto: ipDaRequisicao(requisicao),
    })
    await publicar(eventos)
    return saida
  })
}
