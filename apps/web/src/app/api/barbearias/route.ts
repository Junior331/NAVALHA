import { cadastrarBarbearia } from '@navalha/servidor'
import { contexto } from '@/server/contexto'
import { esquemaBarbearia } from '@/server/esquemas'
import { lerJson, tratar } from '@/server/http'
import { usuarioDaRequisicao } from '@/server/sessao'

// Cadastro da barbearia (Figma Cadastro 01–03). A subconta do gateway só nasce em "Ativar
// recebimentos" (ajustes-taxas §Subconta).
export async function POST(requisicao: Request) {
  return tratar(async () => {
    const usuario = await usuarioDaRequisicao(requisicao)
    const dados = await lerJson(requisicao, esquemaBarbearia)
    const opcionais = Object.fromEntries(
      Object.entries(dados).filter(([, valor]) => valor !== undefined),
    )
    return cadastrarBarbearia(contexto(), usuario, {
      nome: dados.nome,
      slug: dados.slug,
      nomeDoDono: dados.nomeDoDono,
      plano: dados.plano,
      ...opcionais,
    })
  })
}
