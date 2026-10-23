import { SignJWT } from 'jose'
import { describe, expect, it } from 'vitest'
import { usuarioDaRequisicao } from './sessao'

// Sessão do Supabase Auth: o app manda o access token no header Authorization.
const SEGREDO = 'segredo-de-teste-com-pelo-menos-32-caracteres!!'
const config = { segredoJwt: SEGREDO }

async function token(claims: Record<string, unknown>, segredo = SEGREDO, expira = '1h') {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setAudience('authenticated')
    .setIssuedAt()
    .setExpirationTime(expira)
    .sign(new TextEncoder().encode(segredo))
}

const requisicao = (autorizacao?: string) =>
  new Request('http://x', autorizacao ? { headers: { Authorization: autorizacao } } : {})

describe('usuarioDaRequisicao', () => {
  it('aceita token válido e devolve o usuário', async () => {
    const t = await token({ sub: '5eed0000-0000-0000-0000-000000000004', role: 'authenticated' })
    expect(await usuarioDaRequisicao(requisicao(`Bearer ${t}`), config)).toEqual({
      id: '5eed0000-0000-0000-0000-000000000004',
      anonimo: false,
    })
  })

  it('reconhece a sessão anônima do cadastro leve', async () => {
    const t = await token({ sub: 'c0000000-0000-0000-0000-000000000001', is_anonymous: true })
    expect((await usuarioDaRequisicao(requisicao(`Bearer ${t}`), config)).anonimo).toBe(true)
  })

  it.each([
    ['sem header', undefined],
    ['esquema errado', 'Basic abc'],
    ['token malformado', 'Bearer abc.def.ghi'],
  ])('%s: 401', async (_caso, header) => {
    await expect(usuarioDaRequisicao(requisicao(header), config)).rejects.toMatchObject({
      status: 401,
    })
  })

  it('token assinado com outro segredo: 401', async () => {
    const t = await token({ sub: 'x' }, 'outro-segredo-com-pelo-menos-32-caracteres!!!')
    await expect(usuarioDaRequisicao(requisicao(`Bearer ${t}`), config)).rejects.toMatchObject({
      status: 401,
    })
  })

  it('token vencido: 401', async () => {
    const t = await token({ sub: 'x' }, SEGREDO, '-1m')
    await expect(usuarioDaRequisicao(requisicao(`Bearer ${t}`), config)).rejects.toMatchObject({
      status: 401,
    })
  })
})
