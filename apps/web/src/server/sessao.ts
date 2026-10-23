import { ErroDeNegocio, type Usuario } from '@navalha/servidor'
import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify, type JWTVerifyGetKey } from 'jose'

// Sessão do Supabase Auth. O token chega em "Authorization: Bearer". Local: HS256 com o segredo
// do projeto (SUPABASE_JWT_SECRET). Projetos novos assinam com chave assimétrica, verificada
// pelo JWKS publicado em SUPABASE_URL.

export interface ConfigSessao {
  segredoJwt?: string
  urlSupabase?: string
}

let jwks: JWTVerifyGetKey | null = null

export async function usuarioDaRequisicao(
  requisicao: Request,
  config: ConfigSessao = {
    segredoJwt: process.env.SUPABASE_JWT_SECRET,
    urlSupabase: process.env.NEXT_PUBLIC_SUPABASE_URL,
  },
): Promise<Usuario> {
  const [esquema, token] = requisicao.headers.get('authorization')?.split(' ') ?? []
  if (esquema !== 'Bearer' || !token) throw naoAutenticado()

  try {
    const { alg } = decodeProtectedHeader(token)
    const verificado =
      alg === 'HS256' && config.segredoJwt
        ? await jwtVerify(token, new TextEncoder().encode(config.segredoJwt), {
            audience: 'authenticated',
          })
        : await jwtVerify(token, chavesPublicas(config), { audience: 'authenticated' })
    const { sub, is_anonymous: anonimo } = verificado.payload
    if (!sub) throw naoAutenticado()
    return { id: sub, anonimo: anonimo === true }
  } catch (erro) {
    if (erro instanceof ErroDeNegocio) throw erro
    throw naoAutenticado()
  }
}

function chavesPublicas(config: ConfigSessao): JWTVerifyGetKey {
  if (!config.urlSupabase) throw naoAutenticado()
  jwks ??= createRemoteJWKSet(new URL('/auth/v1/.well-known/jwks.json', config.urlSupabase))
  return jwks
}

function naoAutenticado(): ErroDeNegocio {
  return new ErroDeNegocio('nao_autenticado', 'Entre na sua conta para continuar')
}
