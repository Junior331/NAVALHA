import { config, supabase } from './supabase'

// API do Navalha (rotas do apps/web) com o token da sessão. As regras de negócio ficam lá.

export class ErroDaApi extends Error {
  constructor(
    readonly codigo: string,
    mensagem: string,
    readonly status: number,
  ) {
    super(mensagem)
  }
}

export async function api<T>(
  caminho: string,
  opcoes: { metodo?: string; corpo?: unknown } = {},
): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  let resposta: Response
  try {
    resposta = await fetch(`${config.apiUrl}${caminho}`, {
      method: opcoes.metodo ?? (opcoes.corpo === undefined ? 'GET' : 'POST'),
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(opcoes.corpo === undefined ? {} : { body: JSON.stringify(opcoes.corpo) }),
    })
  } catch {
    throw new ErroDaApi('sem_conexao', 'Sem conexão com o Navalha. Confira a internet.', 0)
  }
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

export function mensagemDe(erro: unknown, padrao = 'Algo deu errado. Tente de novo.'): string {
  return erro instanceof Error && erro.message ? erro.message : padrao
}
