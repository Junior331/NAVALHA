'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useSyncExternalStore, type ReactNode } from 'react'
import { supabaseNoNavegador } from '@/lib/supabase'
import s from './painel.module.css'

// Menu do painel (Figma Admin). "Solicitações" saiu: o agendamento é instantâneo ([regra]).
// Badges só para pendências (backlog Admin · Todas as telas).
const GRUPOS: { titulo: string; itens: { href: string; nome: string; pronto: boolean }[] }[] = [
  {
    titulo: 'Geral',
    itens: [
      { href: '/painel', nome: 'Dashboard', pronto: true },
      { href: '/painel/agenda', nome: 'Agenda', pronto: true },
    ],
  },
  {
    titulo: 'Barbearia',
    itens: [
      { href: '/painel/barbeiros', nome: 'Barbeiros', pronto: true },
      { href: '/painel/servicos', nome: 'Serviços', pronto: true },
      { href: '/painel/promocoes', nome: 'Promoções', pronto: true },
    ],
  },
  {
    titulo: 'Financeiro',
    itens: [
      { href: '/painel/financeiro', nome: 'Financeiro', pronto: true },
      { href: '/painel/relatorios', nome: 'Relatórios', pronto: true },
    ],
  },
  {
    titulo: 'Conta',
    itens: [
      { href: '/painel/perfil', nome: 'Perfil da barbearia', pronto: true },
      { href: '/painel/configuracoes', nome: 'Configurações', pronto: true },
    ],
  },
]

export function Casca({
  barbearia,
  plano,
  usuario,
  pendencias,
  aviso,
  children,
}: {
  barbearia: string
  plano: string
  usuario: { nome: string; papel: string }
  pendencias: Record<string, number>
  /** Aviso fixo no topo (backlog Admin 09: "Reservas pausadas" em todo o painel). */
  aviso: { texto: string; href: string; acao: string } | null
  children: ReactNode
}) {
  const caminho = usePathname()
  const router = useRouter()
  const agora = useAgora()
  const iniciais = usuario.nome
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const ativo = (href: string) => (href === '/painel' ? caminho === href : caminho.startsWith(href))

  async function sair() {
    await supabaseNoNavegador().auth.signOut()
    router.replace('/entrar')
    router.refresh()
  }

  return (
    <div className={s.casca}>
      <nav className={s.lateral} aria-label="Menu do painel">
        <div className={s.barbearia}>
          <span className={s.icone} aria-hidden>
            ✂
          </span>
          <div>
            <strong>{barbearia}</strong>
            <span>Plano {plano}</span>
          </div>
        </div>
        {GRUPOS.map((grupo) => (
          <div key={grupo.titulo} className={s.grupo}>
            <span className={`rotulo ${s.rotuloGrupo}`}>{grupo.titulo}</span>
            {grupo.itens.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={s.item}
                aria-current={ativo(item.href) ? 'page' : undefined}
              >
                {item.nome}
                {pendencias[item.href] ? (
                  <span className={s.pendencia} aria-label={`${pendencias[item.href]} pendentes`}>
                    {pendencias[item.href]}
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
        ))}
        <div className={s.rodapeLateral}>
          <button
            type="button"
            className={s.item}
            onClick={sair}
            style={{ width: '100%', border: 0, background: 'none', cursor: 'pointer' }}
          >
            Sair
          </button>
        </div>
      </nav>

      <div className={s.principal}>
        <header className={s.topo}>
          <div className={s.menuCompacto} aria-label="Menu">
            {GRUPOS.flatMap((g) => g.itens).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={s.item}
                aria-current={ativo(item.href) ? 'page' : undefined}
              >
                {item.nome}
              </Link>
            ))}
          </div>
          <div className={s.relogio} suppressHydrationWarning>
            <strong>
              {agora?.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) ?? ' '}
            </strong>
            <span>
              {agora?.toLocaleDateString('pt-BR', {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
              }) ?? ' '}
            </span>
          </div>
          <div className={s.usuario}>
            <span className={s.avatar} aria-hidden>
              {iniciais}
            </span>
            <span>
              <strong>{usuario.nome}</strong>
              <br />
              <span style={{ color: 'var(--texto-suave)' }}>{usuario.papel}</span>
            </span>
          </div>
        </header>
        {aviso ? (
          <div className={s.aviso} role="status">
            <span>{aviso.texto}</span>
            <Link href={aviso.href}>{aviso.acao}</Link>
          </div>
        ) : null}
        <main className={s.conteudo}>{children}</main>
      </div>
    </div>
  )
}

// Relógio do cabeçalho: assina o tempo e só renderiza de novo quando muda o minuto.
function useAgora(): Date | null {
  const minuto = useSyncExternalStore(
    (avisar) => {
      const intervalo = setInterval(avisar, 15_000)
      return () => clearInterval(intervalo)
    },
    () => Math.floor(Date.now() / 60_000),
    () => null,
  )
  return minuto === null ? null : new Date(minuto * 60_000)
}
