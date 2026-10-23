import { registrarDispositivo } from '@navalha/servidor'
import { contexto } from '@/server/contexto'
import { esquemaDispositivo } from '@/server/esquemas'
import { lerJson, tratar } from '@/server/http'
import { usuarioDaRequisicao } from '@/server/sessao'

// Aparelho do app para push (Permissão 01).
export async function POST(requisicao: Request) {
  return tratar(async () => {
    const usuario = await usuarioDaRequisicao(requisicao)
    await registrarDispositivo(contexto(), usuario, await lerJson(requisicao, esquemaDispositivo))
    return { registrado: true }
  })
}
