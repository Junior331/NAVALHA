import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'

// Quem está no app: cliente, barbeiro ou dono (o dono que atende usa o app de barbeiro,
// regras-de-negocio §Decisões: um login só).

export interface Perfil {
  usuarioId: string
  nome: string
  email: string | null
  cliente: { id: string; nome: string; celular: string | null; email: string | null } | null
  membro: {
    id: string
    papel: 'dono' | 'barbeiro'
    barbeariaId: string
    barbeariaNome: string
  } | null
}

interface ValorDaSessao {
  sessao: Session | null
  perfil: Perfil | null
  carregando: boolean
  recarregar: () => Promise<void>
  sair: () => Promise<void>
}

const Contexto = createContext<ValorDaSessao | null>(null)

async function carregarPerfil(sessao: Session): Promise<Perfil> {
  const usuarioId = sessao.user.id
  const [membros, cliente, pessoal] = await Promise.all([
    supabase
      .from('membros')
      .select('id, papel, barbearia_id, barbearias(nome)')
      .eq('usuario_id', usuarioId)
      .eq('ativo', true)
      .order('papel'),
    supabase
      .from('clientes')
      .select('id, nome, celular, email')
      .eq('usuario_id', usuarioId)
      .maybeSingle(),
    supabase.from('perfis').select('nome').eq('usuario_id', usuarioId).maybeSingle(),
  ])
  const membro = membros.data?.[0]
  const metadados = sessao.user.user_metadata as { nome?: string } | undefined
  return {
    usuarioId,
    nome: pessoal.data?.nome ?? cliente.data?.nome ?? metadados?.nome ?? '',
    email: sessao.user.email ?? null,
    cliente: cliente.data ?? null,
    membro: membro
      ? {
          id: membro.id,
          papel: membro.papel,
          barbeariaId: membro.barbearia_id,
          barbeariaNome: membro.barbearias?.nome ?? 'Barbearia',
        }
      : null,
  }
}

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativo = true
    const aplicar = async (nova: Session | null) => {
      const novoPerfil = nova ? await carregarPerfil(nova).catch(() => null) : null
      if (!ativo) return
      setSessao(nova)
      setPerfil(novoPerfil)
      setCarregando(false)
    }
    void supabase.auth.getSession().then(({ data }) => aplicar(data.session))
    const { data } = supabase.auth.onAuthStateChange((evento, nova) => {
      if (evento === 'TOKEN_REFRESHED') {
        setSessao(nova)
        return
      }
      // Fora do callback: o supabase-js não deve ser chamado de dentro dele.
      setTimeout(() => void aplicar(nova), 0)
    })
    return () => {
      ativo = false
      data.subscription.unsubscribe()
    }
  }, [])

  const valor: ValorDaSessao = {
    sessao,
    perfil,
    carregando,
    recarregar: async () => {
      if (sessao) setPerfil(await carregarPerfil(sessao))
    },
    sair: async () => {
      await supabase.auth.signOut()
    },
  }
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useSessao(): ValorDaSessao {
  const valor = useContext(Contexto)
  if (!valor) throw new Error('useSessao fora do SessaoProvider')
  return valor
}
