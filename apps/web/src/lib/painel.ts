import 'server-only'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { supabaseNoServidor } from './supabase-servidor'

// Barbearia do usuário logado no painel. Um dono pode ter mais de uma barbearia; o painel abre a
// primeira (troca de barbearia fica para depois).
export const barbeariaDoPainel = cache(async () => {
  const supabase = await supabaseNoServidor()
  const { data: claims } = await supabase.auth.getClaims()
  const usuarioId = claims?.claims.sub
  if (!usuarioId) redirect('/entrar')

  const { data: membros } = await supabase
    .from('membros')
    .select(
      'id, papel, barbearia_id, barbearias(id, nome, slug, fuso, aceitar_agendamentos_online, recebimentos_ativos_em)',
    )
    .eq('usuario_id', usuarioId)
    .eq('ativo', true)
    .order('papel')
  const membro = membros?.find((m) => m.papel === 'dono') ?? membros?.[0]
  if (!membro?.barbearias) redirect('/cadastro')

  const [{ data: perfil }, { data: assinatura }] = await Promise.all([
    supabase.from('perfis').select('nome').eq('usuario_id', usuarioId).maybeSingle(),
    supabase
      .from('assinaturas')
      .select('plano, status, trial_ate')
      .eq('barbearia_id', membro.barbearia_id)
      .maybeSingle(),
  ])

  return {
    supabase,
    usuarioId,
    membroId: membro.id,
    papel: membro.papel,
    nomeUsuario: perfil?.nome ?? 'Você',
    barbearia: membro.barbearias,
    assinatura,
  }
})
