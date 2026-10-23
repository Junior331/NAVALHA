import type { ReactNode } from 'react'
import { barbeariaDoPainel } from '@/lib/painel'
import { Casca } from './casca'

export const metadata = { title: 'Painel · Navalha' }

const NOME_DO_PLANO: Record<string, string> = { free: 'Free', basic: 'Basic', pro: 'Pro' }

export default async function LayoutDoPainel({ children }: { children: ReactNode }) {
  const { barbearia, assinatura, nomeUsuario, papel, supabase } = await barbeariaDoPainel()
  const { count: convitesPendentes } = await supabase
    .from('convites')
    .select('id', { count: 'exact', head: true })
    .eq('barbearia_id', barbearia.id)
    .is('usado_em', null)
    .gt('expira_em', new Date().toISOString())

  return (
    <Casca
      barbearia={barbearia.nome}
      plano={`${NOME_DO_PLANO[assinatura?.plano ?? 'free'] ?? 'Free'}${assinatura?.status === 'trial' ? ' · teste grátis' : ''}`}
      usuario={{ nome: nomeUsuario, papel: papel === 'dono' ? 'Dono' : 'Barbeiro' }}
      pendencias={convitesPendentes ? { '/painel/barbeiros': convitesPendentes } : {}}
    >
      {children}
    </Casca>
  )
}
