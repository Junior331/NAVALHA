import { contexto } from '@/server/contexto'

// Verificação de saúde para o deploy e o monitoramento: o servidor responde e o banco também.
// Não expõe detalhes do erro (fica só no log).
export async function GET() {
  const inicio = Date.now()
  try {
    await contexto().sql`select 1`
    return Response.json({ ok: true, banco: 'ok', ms: Date.now() - inicio })
  } catch (erro) {
    console.error('[saude] banco indisponível', erro)
    return Response.json({ ok: false, banco: 'indisponivel' }, { status: 503 })
  }
}
