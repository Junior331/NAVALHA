import { agendarNoBalcao } from '@navalha/servidor'
import { contexto, publicar } from '@/server/contexto'
import { esquemaBalcao } from '@/server/esquemas'
import { lerJson, tratar } from '@/server/http'
import { usuarioDaRequisicao } from '@/server/sessao'

// Novo agendamento pela equipe (Admin 02d–02h): entra Confirmado, pago na barbearia.
export async function POST(requisicao: Request) {
  return tratar(async () => {
    const usuario = await usuarioDaRequisicao(requisicao)
    const { observacoes, cliente, ...entrada } = await lerJson(requisicao, esquemaBalcao)
    const { agendamentoId, codigo, eventos } = await agendarNoBalcao(contexto(), usuario, {
      ...entrada,
      cliente:
        'id' in cliente
          ? { id: cliente.id }
          : {
              nome: cliente.nome,
              ...(cliente.celular ? { celular: cliente.celular } : {}),
              ...(cliente.email ? { email: cliente.email } : {}),
            },
      ...(observacoes ? { observacoes } : {}),
    })
    await publicar(eventos)
    return { agendamentoId, codigo }
  })
}
