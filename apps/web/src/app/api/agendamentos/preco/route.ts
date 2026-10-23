import { simularPreco } from '@navalha/servidor'
import { contexto } from '@/server/contexto'
import { esquemaPreco } from '@/server/esquemas'
import { lerJson, tratar } from '@/server/http'
import { usuarioDaRequisicao } from '@/server/sessao'

// Prévia do valor no checkout (Figma Cliente 10), com cupom ou prêmio da fidelidade.
export async function POST(requisicao: Request) {
  return tratar(async () => {
    const usuario = await usuarioDaRequisicao(requisicao)
    const { cupom, usarPremio, ...entrada } = await lerJson(requisicao, esquemaPreco)
    return simularPreco(contexto(), usuario, {
      ...entrada,
      ...(cupom ? { cupom } : {}),
      ...(usarPremio ? { usarPremio } : {}),
    })
  })
}
