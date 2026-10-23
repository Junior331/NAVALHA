import { cadastrarCliente } from '@navalha/servidor'
import { contexto } from '@/server/contexto'
import { esquemaCliente } from '@/server/esquemas'
import { lerJson, tratar } from '@/server/http'
import { usuarioDaRequisicao } from '@/server/sessao'

// Cadastro do cliente: app (Mobile 07) e cadastro leve da página web (nome, celular e e-mail).
export async function POST(requisicao: Request) {
  return tratar(async () => {
    const usuario = await usuarioDaRequisicao(requisicao)
    const { nome, celular, email } = await lerJson(requisicao, esquemaCliente)
    return cadastrarCliente(contexto(), usuario, {
      nome,
      ...(celular ? { celular } : {}),
      ...(email ? { email } : {}),
    })
  })
}
