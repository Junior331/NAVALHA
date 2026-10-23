import { criarConvite } from '@navalha/servidor'
import { contexto } from '@/server/contexto'
import { esquemaConvite } from '@/server/esquemas'
import { lerJson, tratar } from '@/server/http'
import { usuarioDaRequisicao } from '@/server/sessao'

// Convite de barbeiro (Admin 04 e 04b): link de uso único, válido por 7 dias.
export async function POST(requisicao: Request) {
  return tratar(async () => {
    const usuario = await usuarioDaRequisicao(requisicao)
    const { contato, ...dados } = await lerJson(requisicao, esquemaConvite)
    const convite = await criarConvite(contexto(), usuario, {
      ...dados,
      ...(contato ? { contato } : {}),
    })
    const base = process.env.NEXT_PUBLIC_URL_PUBLICA ?? 'https://navalha.app'
    return { ...convite, link: `${base}/convite/${convite.token}` }
  })
}
