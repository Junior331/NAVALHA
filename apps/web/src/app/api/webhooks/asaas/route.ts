import { tokenDoWebhookValido } from '@navalha/pagamentos'
import { registrarWebhook } from '@navalha/servidor'
import { contexto, publicar } from '@/server/contexto'

// Webhook do Asaas: valida o token, guarda o evento (idempotente) e processa no Inngest.
// Responde rápido; o Asaas reenvia se não receber 200.
export async function POST(requisicao: Request) {
  const token = requisicao.headers.get('asaas-access-token')
  if (!tokenDoWebhookValido(token, process.env.ASAAS_WEBHOOK_TOKEN ?? '')) {
    return Response.json({ erro: { codigo: 'nao_autenticado' } }, { status: 401 })
  }
  const corpo: unknown = await requisicao.json().catch(() => null)
  const registro = await registrarWebhook(contexto().sql, corpo)
  if (registro === 'invalido') {
    return Response.json({ erro: { codigo: 'dados_invalidos' } }, { status: 400 })
  }
  if (registro === 'novo') {
    const eventoId = (corpo as { id: string }).id
    await publicar([{ name: 'pagamento/webhook-recebido', data: { eventoId } }])
  }
  return Response.json({ recebido: true })
}
