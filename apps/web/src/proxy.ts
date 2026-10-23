import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Renova a sessão do Supabase nos cookies a cada navegação e manda para /entrar quem tenta abrir
// o painel sem sessão. É uma checagem otimista: cada página e rota confere de novo no servidor.
export async function proxy(requisicao: NextRequest) {
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

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)'],
}
