import type { Json, Sql } from '@navalha/db'
import { interpretarWebhookAsaas } from '@navalha/pagamentos'
import type { Contexto, Resultado } from '../contexto'
import { confirmarPixPago } from './pix'

// Webhook do Asaas: a rota só valida o token e guarda o evento (idempotente pelo id); o
// processamento roda no Inngest, com retry. regras-de-negocio §Ações do backend por evento.

export async function registrarWebhook(
  sql: Sql,
  corpo: unknown,
): Promise<'novo' | 'repetido' | 'invalido'> {
  const objeto = corpo as { id?: unknown; event?: unknown }
  if (typeof objeto?.id !== 'string' || typeof objeto.event !== 'string') return 'invalido'
  const inseridos = await sql`
    insert into public.webhook_eventos (id, tipo, payload)
    values (${objeto.id}, ${objeto.event}, ${sql.json(corpo as Json)})
    on conflict (id) do nothing
    returning id`
  return inseridos.length > 0 ? 'novo' : 'repetido'
}

export async function processarWebhookDePagamento(
  ctx: Contexto,
  eventoId: string,
): Promise<Resultado<string>> {
  const [linha] = await ctx.sql<{ payload: unknown; processado_em: Date | null }[]>`
    select payload, processado_em from public.webhook_eventos where id = ${eventoId}`
  if (!linha) return { resultado: 'nao_encontrado', eventos: [] }
  if (linha.processado_em) return { resultado: 'ja_processado', eventos: [] }

  const evento = interpretarWebhookAsaas(linha.payload)
  let resultado: Resultado<string> = { resultado: 'ignorado', eventos: [] }

  if (evento?.tipo === 'pix_pago') {
    resultado = await confirmarPixPago(ctx, {
      cobrancaId: evento.cobrancaId,
      referencia: evento.referencia,
      taxaGateway: evento.taxaGateway,
    })
  } else if (evento?.tipo === 'cartao_capturado') {
    // A captura é feita pelo job; o webhook só confirma a taxa cobrada pelo gateway.
    await ctx.sql`
      update public.pagamentos set taxa_gateway_centavos = ${evento.taxaGateway}, atualizado_em = now()
      where asaas_cobranca_id = ${evento.cobrancaId} and status = 'capturado'`
    resultado = { resultado: 'sincronizado', eventos: [] }
  }

  await ctx.sql`update public.webhook_eventos set processado_em = now() where id = ${eventoId}`
  return resultado
}
