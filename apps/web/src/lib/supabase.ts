import type { Database } from '@navalha/db'
import { createBrowserClient } from '@supabase/ssr'

// Cliente do Supabase no navegador. Leituras passam pelo RLS com a sessão do usuário; escritas
// com regra de negócio vão para a API (Authorization: Bearer).

export function supabaseNoNavegador() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  )
}

export class ErroDaApi extends Error {
  constructor(
    readonly codigo: string,
    mensagem: string,
    readonly status: number,
  ) {
    super(mensagem)
  }
}

/** Chama a API do Navalha com a sessão atual. */
export async function api<T>(
  caminho: string,
  opcoes: { metodo?: string; corpo?: unknown } = {},
): Promise<T> {
  const { data } = await supabaseNoNavegador().auth.getSession()
  const token = data.session?.access_token
  const resposta = await fetch(caminho, {
    method: opcoes.metodo ?? (opcoes.corpo === undefined ? 'GET' : 'POST'),
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(opcoes.corpo === undefined ? {} : { body: JSON.stringify(opcoes.corpo) }),
  })
  const corpo = (await resposta.json().catch(() => ({}))) as {
    erro?: { codigo: string; mensagem: string }
  }
  if (!resposta.ok) {
    throw new ErroDaApi(
      corpo.erro?.codigo ?? 'erro',
      corpo.erro?.mensagem ?? 'Algo deu errado. Tente de novo.',
      resposta.status,
    )
  }
  return corpo as T
}
