import { expect, type APIRequestContext } from '@playwright/test'

// Caixa de e-mail do Supabase local (Mailpit): os códigos de confirmação chegam aqui.
const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:55324'

export async function codigoDoEmail(request: APIRequestContext, email: string): Promise<string> {
  let codigo = ''
  await expect
    .poll(
      async () => {
        const busca = await request.get(
          `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
        )
        const { messages } = (await busca.json()) as { messages: { ID: string }[] }
        const id = messages[0]?.ID
        if (!id) return ''
        const mensagem = (await (await request.get(`${MAILPIT}/api/v1/message/${id}`)).json()) as {
          Text: string
        }
        codigo = /\b(\d{6})\b/.exec(mensagem.Text)?.[1] ?? ''
        return codigo
      },
      { timeout: 20_000, message: `o código não chegou para ${email}` },
    )
    .toMatch(/^\d{6}$/)
  return codigo
}
