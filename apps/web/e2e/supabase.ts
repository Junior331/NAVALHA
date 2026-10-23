import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type APIRequestContext } from '@playwright/test'

// Supabase local dos testes: URL e chave pública do ambiente (CI) ou do .env.local do app.
function envLocal(): Record<string, string> {
  try {
    const texto = readFileSync(join(__dirname, '..', '.env.local'), 'utf8')
    return Object.fromEntries(
      texto
        .split(/\r?\n/)
        .filter((linha) => linha.includes('=') && !linha.startsWith('#'))
        .map((linha) => [linha.slice(0, linha.indexOf('=')), linha.slice(linha.indexOf('=') + 1)]),
    )
  } catch {
    return {}
  }
}

const local = envLocal()
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? local.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:55321'
const CHAVE_PUBLICA =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? local.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

/** Token de acesso de um usuário do seed (senha local navalha123), para chamar a API. */
export async function tokenDe(request: APIRequestContext, email: string): Promise<string> {
  const resposta = await request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: CHAVE_PUBLICA },
    data: { email, password: 'navalha123' },
  })
  expect(resposta.ok(), `não entrou como ${email}`).toBe(true)
  return ((await resposta.json()) as { access_token: string }).access_token
}

export const SEED = {
  barbeariaId: 'ba7be000-0000-0000-0000-000000000001',
  slug: 'barbearia-do-ze',
  corteMasculino: '5e7f0000-0000-0000-0000-000000000003',
}
