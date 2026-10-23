'use client'

import {
  CalendarDays,
  ChevronDown,
  LayoutDashboard,
  Menu,
  PanelLeft,
  Percent,
  Scissors,
  Settings,
  Store,
  User,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useSyncExternalStore, type ReactNode } from 'react'
import { Logo } from '@/componentes/logo'
import s from './painel.module.css'
import { Busca, MenuDoUsuario, Notificacoes, Relogio } from './topo'

// Menu do painel (Figma Admin). "Solicitações" não existe: o agendamento é instantâneo
// (CLAUDE.md). No lugar dele, embaixo, fica o Perfil da barbearia.
interface Item {
  href: string
  nome: string
  icone: LucideIcon
  filhos?: { href: string; nome: string }[]
}

const GRUPOS: { titulo: string; itens: Item[] }[] = [
  {
    titulo: 'Geral',
    itens: [
      { href: '/painel', nome: 'Dashboard', icone: LayoutDashboard },
      { href: '/painel/agenda', nome: 'Agenda', icone: CalendarDays },
      { href: '/painel/clientes', nome: 'Clientes', icone: User },
    ],
  },
  {
    titulo: 'Barbearia',
    itens: [
      { href: '/painel/barbeiros', nome: 'Barbeiros', icone: Users },
      { href: '/painel/servicos', nome: 'Serviços', icone: Scissors },
      { href: '/painel/promocoes', nome: 'Promoções', icone: Percent },
    ],
  },
  {
    titulo: 'Financeiro',
    itens: [
      {
        href: '/painel/financeiro',
        nome: 'Financeiro',
        icone: Wallet,
        filhos: [
          { href: '/painel/financeiro', nome: 'Receitas' },
          { href: '/painel/financeiro/repasses', nome: 'Repasses' },
          { href: '/painel/relatorios', nome: 'Relatórios' },
        ],
      },
    ],
  },
]

const RODAPE: Item[] = [
  { href: '/painel/perfil', nome: 'Perfil da barbearia', icone: Store },
  { href: '/painel/configuracoes', nome: 'Configurações', icone: Settings },
]

// Menu recolhido: preferência deste navegador (sem o storage, o menu abre expandido).
const CHAVE_RECOLHIDO = 'navalha:menu-recolhido'
const ouvintes = new Set<() => void>()
function lerRecolhido(): boolean {
  try {
    return localStorage.getItem(CHAVE_RECOLHIDO) === '1'
  } catch {
    return false
  }
}
function gravarRecolhido(valor: boolean) {
  try {
    localStorage.setItem(CHAVE_RECOLHIDO, valor ? '1' : '0')
  } catch {
    // Sem storage (aba anônima bloqueada): vale só até recarregar.
  }
  ouvintes.forEach((avisar) => avisar())
}
function assinarRecolhido(avisar: () => void) {
  ouvintes.add(avisar)
  return () => {
    ouvintes.delete(avisar)
  }
}

export function Casca({
  barbearia,
  plano,
  usuario,
  contagens,
  naoLidas,
  aviso,
  children,
}: {
  barbearia: { id: string; nome: string; fuso: string }
  plano: string
  usuario: { id: string; nome: string; papel: string }
  contagens: Record<string, number>
  naoLidas: number
  /** Aviso fixo no topo (backlog Admin 09: "Reservas pausadas" em todo o painel). */
  aviso: { texto: string; href: string; acao: string } | null
  children: ReactNode
}) {
  const caminho = usePathname()
  const recolhido = useSyncExternalStore(assinarRecolhido, lerRecolhido, () => false)
  const [gaveta, setGaveta] = useState(false)
  const [financeiroAberto, setFinanceiroAberto] = useState(true)

  const ativo = (href: string) =>
    href === '/painel' || href === '/painel/financeiro'
      ? caminho === href
      : caminho === href || caminho.startsWith(`${href}/`)
  const grupoAtivo = (item: Item) =>
    ativo(item.href) || (item.filhos?.some((f) => ativo(f.href)) ?? false)

  const link = (item: Item) => {
    const Icone = item.icone
    const total = contagens[item.href]
    return (
      <Link
        key={item.href}
        href={item.href}
        className={s.item}
        aria-current={ativo(item.href) ? 'page' : undefined}
        title={recolhido ? item.nome : undefined}
        onClick={() => setGaveta(false)}
      >
        <Icone size={18} strokeWidth={1.75} aria-hidden />
        <span className={s.itemNome}>{item.nome}</span>
        {total ? <span className={s.contagem}>{total}</span> : null}
      </Link>
    )
  }

  return (
    <div className={s.casca} data-recolhido={recolhido ? 'sim' : undefined}>
      <nav
        className={s.lateral}
        aria-label="Menu do painel"
        data-aberta={gaveta ? 'sim' : undefined}
      >
        <div className={s.barbearia}>
          <Link href="/painel" className={s.marca} onClick={() => setGaveta(false)}>
            <Logo tamanho={30} />
            <span className={s.marcaTexto}>
              <strong>{barbearia.nome}</strong>
              <span>Plano {plano}</span>
            </span>
          </Link>
          <button
            type="button"
            className={s.recolher}
            onClick={() => gravarRecolhido(!recolhido)}
            aria-label={recolhido ? 'Expandir o menu' : 'Recolher o menu'}
            aria-pressed={recolhido}
          >
            <PanelLeft size={16} strokeWidth={1.75} aria-hidden />
          </button>
        </div>

        <div className={s.grupos}>
          {GRUPOS.map((grupo) => (
            <div key={grupo.titulo} className={s.grupo}>
              <span className={s.rotuloGrupo}>{grupo.titulo}</span>
              {grupo.itens.map((item) => {
                if (!item.filhos) return link(item)
                const Icone = item.icone
                const aberto = financeiroAberto
                return (
                  <div key={item.href}>
                    <button
                      type="button"
                      className={s.item}
                      data-dentro={grupoAtivo(item) ? 'sim' : undefined}
                      aria-expanded={aberto}
                      title={recolhido ? item.nome : undefined}
                      onClick={() =>
                        // No menu recolhido (só no desktop), o clique expande o menu.
                        recolhido && window.matchMedia('(min-width: 1024px)').matches
                          ? gravarRecolhido(false)
                          : setFinanceiroAberto(!financeiroAberto)
                      }
                    >
                      <Icone size={18} strokeWidth={1.75} aria-hidden />
                      <span className={s.itemNome}>{item.nome}</span>
                      <ChevronDown size={16} className={s.seta} aria-hidden />
                    </button>
                    {aberto ? (
                      <div className={s.filhos}>
                        {item.filhos.map((filho) => (
                          <Link
                            key={filho.href}
                            href={filho.href}
                            className={s.filho}
                            aria-current={ativo(filho.href) ? 'page' : undefined}
                            onClick={() => setGaveta(false)}
                          >
                            {filho.nome}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <div className={s.rodapeLateral}>{RODAPE.map(link)}</div>
      </nav>
      {gaveta ? (
        <button
          type="button"
          className={s.veu}
          aria-label="Fechar o menu"
          onClick={() => setGaveta(false)}
        />
      ) : null}

      <div className={s.principal}>
        <header className={s.topo}>
          <button
            type="button"
            className={s.abrirMenu}
            onClick={() => setGaveta(true)}
            aria-label="Abrir o menu"
          >
            <Menu size={18} aria-hidden />
          </button>
          <Busca barbeariaId={barbearia.id} fuso={barbearia.fuso} />
          <Relogio fuso={barbearia.fuso} />
          <div className={s.topoDireita}>
            <Notificacoes usuarioId={usuario.id} naoLidas={naoLidas} fuso={barbearia.fuso} />
            <span className={s.divisoria} aria-hidden="true" />
            <MenuDoUsuario nome={usuario.nome} papel={usuario.papel} />
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
