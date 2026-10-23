import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Renova a sessão do Supabase nos cookies a cada navegação e manda para /entrar quem tenta abrir
// o painel sem sessão. É uma checagem otimista: cada página e rota confere de novo no servidor.
// Na API, só libera o CORS para as origens do app (CORS_ORIGENS; ex.: o Expo no navegador).
export async function proxy(requisicao: NextRequest) {
  if (requisicao.nextUrl.pathname.startsWith('/api/')) return cors(requisicao)
  let resposta = NextResponse.next({ request: requisicao })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    {
      cookies: {
        getAll: () => requisicao.cookies.getAll(),
        setAll: (lista) => {
          for (const { name, value } of lista) requisicao.cookies.set(name, value)
          resposta = NextResponse.next({ request: requisicao })
          for (const { name, value, options } of lista) resposta.cookies.set(name, value, options)
        },
      },
    },
  )
  const { data } = await supabase.auth.getClaims()
  const logado = Boolean(data?.claims?.sub)

  const protegida = ['/painel', '/onboarding'].some((p) =>
    requisicao.nextUrl.pathname.startsWith(p),
  )
  if (protegida && !logado) {
    const destino = new URL('/entrar', requisicao.url)
    destino.searchParams.set('voltar', requisicao.nextUrl.pathname)
    return NextResponse.redirect(destino)
  }
  return resposta
}

const ORIGENS = (process.env.CORS_ORIGENS ?? '')
  .split(',')
  .map((origem) => origem.trim())
  .filter(Boolean)

function cors(requisicao: NextRequest) {
  const origem = requisicao.headers.get('origin')
  const cabecalhos: Record<string, string> =
    origem && ORIGENS.includes(origem)
      ? {
          'Access-Control-Allow-Origin': origem,
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          'Access-Control-Max-Age': '600',
          Vary: 'Origin',
        }
      : {}
  if (requisicao.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: cabecalhos })
  }
  const resposta = NextResponse.next()
  for (const [nome, valor] of Object.entries(cabecalhos)) resposta.headers.set(nome, valor)
  return resposta
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)'],
}
