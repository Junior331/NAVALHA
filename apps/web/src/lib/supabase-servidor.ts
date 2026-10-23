import 'server-only'
import type { Database } from '@navalha/db'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Cliente do Supabase em Server Components: lê com o RLS da sessão do usuário (cookies).
export async function supabaseNoServidor() {
  const loja = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    {
      cookies: {
        getAll: () => loja.getAll(),
        setAll: (lista) => {
          // Em Server Component os cookies são só de leitura; o proxy renova a sessão.
          try {
            for (const { name, value, options } of lista) loja.set(name, value, options)
          } catch {}
        },
      },
    },
  )
}
