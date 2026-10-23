import type { ReactNode } from 'react'
import { instanteLocal, partesLocais } from '@navalha/core'
import { somarDias } from '@/lib/agenda'
import { barbeariaDoPainel } from '@/lib/painel'
import { Casca } from './casca'

export const metadata = { title: 'Painel · Navalha' }

const NOME_DO_PLANO: Record<string, string> = { free: 'Free', basic: 'Basic', pro: 'Pro' }

export default async function LayoutDoPainel({ children }: { children: ReactNode }) {
  const { barbearia, assinatura, nomeUsuario, papel, usuarioId, supabase } =
    await barbeariaDoPainel()
  const hoje = partesLocais(new Date(), barbearia.fuso).data

  // Números ao lado do menu (Figma Admin): agendamentos de hoje, equipe ativa e serviços ativos.
  const [agendaDeHoje, equipe, servicos, naoLidas] = await Promise.all([
    supabase
      .from('agendamentos')
      .select('id', { count: 'exact', head: true })
      .eq('barbearia_id', barbearia.id)
      .gte('inicio', instanteLocal(hoje, 0, barbearia.fuso).toISOString())
      .lt('inicio', instanteLocal(somarDias(hoje, 1), 0, barbearia.fuso).toISOString())
      .in('status', ['reservado', 'confirmado', 'em_atendimento', 'concluido']),
    supabase
      .from('membros')
      .select('id', { count: 'exact', head: true })
      .eq('barbearia_id', barbearia.id)
      .eq('ativo', true),
    supabase
      .from('servicos')
      .select('id', { count: 'exact', head: true })
      .eq('barbearia_id', barbearia.id)
      .eq('ativo', true),
    supabase
      .from('notificacoes')
      .select('id', { count: 'exact', head: true })
      .eq('usuario_id', usuarioId)
      .is('lida_em', null),
  ])

  const aviso =
    papel !== 'dono'
      ? null
      : !barbearia.recebimentos_ativos_em
        ? {
            texto: 'Ative os recebimentos para aceitar agendamentos pagos.',
            href: '/painel/recebimentos',
            acao: 'Ativar recebimentos',
          }
        : !barbearia.aceitar_agendamentos_online
          ? {
              texto: 'Reservas online pausadas: os clientes não conseguem agendar.',
              href: '/painel/perfil',
              acao: 'Retomar no Perfil',
            }
          : null

  return (
    <Casca
      barbearia={{ id: barbearia.id, nome: barbearia.nome, fuso: barbearia.fuso }}
      plano={`${NOME_DO_PLANO[assinatura?.plano ?? 'free'] ?? 'Free'}${assinatura?.status === 'trial' ? ' · teste grátis' : ''}`}
      usuario={{ id: usuarioId, nome: nomeUsuario, papel: papel === 'dono' ? 'Dono' : 'Barbeiro' }}
      contagens={{
        '/painel/agenda': agendaDeHoje.count ?? 0,
        '/painel/barbeiros': equipe.count ?? 0,
        '/painel/servicos': servicos.count ?? 0,
      }}
      naoLidas={naoLidas.count ?? 0}
      aviso={aviso}
    >
      {children}
    </Casca>
  )
}
