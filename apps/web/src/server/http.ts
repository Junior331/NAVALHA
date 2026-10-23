import { ErroDeNegocio } from '@navalha/servidor'
import type { z } from 'zod'

// Tradução entre HTTP e casos de uso: erro de regra vira o status certo com mensagem para o
// usuário; erro inesperado vira 500 sem vazar detalhes.

export async function tratar<T>(fn: () => Promise<T>): Promise<Response> {
  try {
    return Response.json(await fn())
  } catch (erro) {
    if (erro instanceof ErroDeNegocio) {
      return Response.json(
        { erro: { codigo: erro.codigo, mensagem: erro.message } },
        { status: erro.status },
      )
    }
    console.error('[api] erro inesperado', erro)
    return Response.json(
      {
        erro: { codigo: 'erro_interno', mensagem: 'Algo deu errado. Tente de novo em instantes.' },
      },
      { status: 500 },
    )
  }
}

export async function lerJson<T>(requisicao: Request, esquema: z.ZodType<T>): Promise<T> {
  let corpo: unknown
  try {
    corpo = await requisicao.json()
  } catch {
    throw new ErroDeNegocio('dados_invalidos', 'Corpo da requisição inválido')
  }
  const resultado = esquema.safeParse(corpo)
  if (!resultado.success) {
    const campo = resultado.error.issues[0]?.path.join('.') || 'corpo'
    throw new ErroDeNegocio('dados_invalidos', `Campo inválido: ${campo}`)
  }
  return resultado.data
}

export function ipDaRequisicao(requisicao: Request): string {
  const encaminhado = requisicao.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return encaminhado || requisicao.headers.get('x-real-ip') || '0.0.0.0'
}
