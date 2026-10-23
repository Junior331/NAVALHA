'use client'

import { partesLocais } from '@navalha/core'
import { Bell, CalendarDays, ChevronDown, LogOut, Search, Settings, Store } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { Avatar, useFlutuante } from '@/componentes/ui'
import { dataCurta, diaPorExtenso, hora } from '@/lib/formato'
import { api, supabaseNoNavegador } from '@/lib/supabase'
import s from './painel.module.css'

// Barra do topo do painel (Figma Admin): busca, relógio, notificações e menu da conta.

interface ClienteEncontrado {
  id: string
  nome: string
  celular: string | null
  visitas: number
}

interface AgendamentoEncontrado {
  id: string
  codigo: string
  inicio: string
}

const semInscricao = () => () => {}

export function Busca({ barbeariaId, fuso }: { barbeariaId: string; fuso: string }) {
  const router = useRouter()
  const { aberto, setAberto, raiz } = useFlutuante<HTMLFormElement>()
  const campo = useRef<HTMLInputElement>(null)
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idLista = useId()
  const [termo, setTermo] = useState('')
  const [clientes, setClientes] = useState<ClienteEncontrado[] | null>(null)
  const [agendamento, setAgendamento] = useState<AgendamentoEncontrado | null>(null)
  const mac = useSyncExternalStore(
    semInscricao,
    () => /Mac|iPhone|iPad/.test(navigator.userAgent),
    () => true,
  )

  // ⌘K / Ctrl+K leva para a busca de qualquer tela do painel.
  useEffect(() => {
    const atalho = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        campo.current?.focus()
      }
    }
    document.addEventListener('keydown', atalho)
    return () => document.removeEventListener('keydown', atalho)
  }, [])

  function mudar(valor: string) {
    setTermo(valor)
    if (espera.current) clearTimeout(espera.current)
    const busca = valor.trim()
    if (busca.length < 2) {
      setClientes(null)
      setAgendamento(null)
      setAberto(false)
      return
    }
    espera.current = setTimeout(async () => {
      const codigo = /^nv-?\d+$/i.test(busca) ? `NV-${busca.replace(/\D/g, '')}` : null
      const [achados, porCodigo] = await Promise.all([
        api<ClienteEncontrado[]>(
          `/api/barbearias/${barbeariaId}/clientes?termo=${encodeURIComponent(busca)}`,
        ).catch(() => []),
        codigo
          ? supabaseNoNavegador()
              .from('agendamentos')
              .select('id, codigo, inicio')
              .eq('barbearia_id', barbeariaId)
              .eq('codigo', codigo)
              .maybeSingle()
              .then((r) => r.data)
          : Promise.resolve(null),
      ])
      setClientes(achados.slice(0, 6))
      setAgendamento(porCodigo)
      setAberto(true)
    }, 250)
  }

  function irPara(href: string) {
    setAberto(false)
    setTermo('')
    setClientes(null)
    setAgendamento(null)
    router.push(href)
  }

  return (
    <form
      ref={raiz}
      role="search"
      className={s.busca}
      onSubmit={(e) => {
        e.preventDefault()
        if (termo.trim()) irPara(`/painel/clientes?q=${encodeURIComponent(termo.trim())}`)
      }}
    >
      <Search size={18} strokeWidth={1.75} className={s.buscaIcone} aria-hidden />
      <input
        ref={campo}
        type="search"
        value={termo}
        onChange={(e) => mudar(e.target.value)}
        onFocus={() => clientes && setAberto(true)}
        placeholder="Buscar cliente ou agendamento"
        aria-label="Buscar cliente ou agendamento"
        autoComplete="off"
      />
      <kbd className={s.atalho}>{mac ? '⌘K' : 'Ctrl K'}</kbd>
      <p className="so-leitor" role="status">
        {aberto && clientes
          ? `${clientes.length + (agendamento ? 1 : 0)} resultados. Use Tab para chegar a eles.`
          : ''}
      </p>
      {aberto ? (
        <div id={idLista} className={`${s.flutuante} ${s.resultados}`}>
          {agendamento ? (
            <>
              <p className={s.flutuanteRotulo}>Agendamento</p>
              <button
                type="button"
                className={s.resultado}
                onClick={() =>
                  irPara(
                    `/painel/agenda?data=${partesLocais(new Date(agendamento.inicio), fuso).data}&visao=dia&evento=${agendamento.id}`,
                  )
                }
              >
                <CalendarDays size={16} aria-hidden />
                <span>
                  <strong className="mono">{agendamento.codigo}</strong>
                  <span>
                    {dataCurta(agendamento.inicio, fuso)}, {hora(agendamento.inicio, fuso)}
                  </span>
                </span>
              </button>
            </>
          ) : null}
          <p className={s.flutuanteRotulo}>Clientes</p>
          {clientes && clientes.length > 0 ? (
            clientes.map((c) => (
              <button
                key={c.id}
                type="button"
                className={s.resultado}
                onClick={() => irPara(`/painel/clientes?q=${encodeURIComponent(c.nome)}`)}
              >
                <Avatar nome={c.nome} tamanho={28} />
                <span>
                  <strong>{c.nome}</strong>
                  <span>
                    {c.celular ?? 'Sem celular'} · {c.visitas}{' '}
                    {c.visitas === 1 ? 'agendamento' : 'agendamentos'}
                  </span>
                </span>
              </button>
            ))
          ) : (
            <p className={s.semResultado}>Nenhum cliente com “{termo.trim()}”.</p>
          )}
        </div>
      ) : null}
    </form>
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

export function Relogio({ fuso }: { fuso: string }) {
  const agora = useAgora()
  return (
    <div className={s.relogio}>
      <strong>{agora ? hora(agora, fuso) : ' '}</strong>
      <span>{agora ? diaPorExtenso(agora, fuso) : ' '}</span>
    </div>
  )
}

interface Notificacao {
  id: string
  titulo: string
  corpo: string
  criada_em: string
  lida_em: string | null
}

export function Notificacoes({
  usuarioId,
  naoLidas,
  fuso,
}: {
  usuarioId: string
  naoLidas: number
  fuso: string
}) {
  const { aberto, setAberto, raiz } = useFlutuante()
  const idPainel = useId()
  const [lista, setLista] = useState<Notificacao[] | null>(null)
  const [pendentes, setPendentes] = useState(naoLidas)

  async function alternar() {
    const abrir = !aberto
    setAberto(abrir)
    if (!abrir) return
    const { data } = await supabaseNoNavegador()
      .from('notificacoes')
      .select('id, titulo, corpo, criada_em, lida_em')
      .eq('usuario_id', usuarioId)
      .order('criada_em', { ascending: false })
      .limit(8)
    setLista(data ?? [])
  }

  async function marcarComoLidas() {
    const agora = new Date().toISOString()
    await supabaseNoNavegador()
      .from('notificacoes')
      .update({ lida_em: agora })
      .eq('usuario_id', usuarioId)
      .is('lida_em', null)
    setPendentes(0)
    setLista((atual) => atual?.map((n) => ({ ...n, lida_em: n.lida_em ?? agora })) ?? null)
  }

  return (
    <div ref={raiz} className={s.ancora}>
      <button
        type="button"
        className={s.sino}
        onClick={alternar}
        aria-expanded={aberto}
        aria-controls={aberto ? idPainel : undefined}
        aria-label={pendentes ? `Notificações, ${pendentes} não lidas` : 'Notificações'}
      >
        <Bell size={18} strokeWidth={1.75} aria-hidden />
        {pendentes ? <span className={s.pontoNovo} aria-hidden="true" /> : null}
      </button>
      {aberto ? (
        <div id={idPainel} className={`${s.flutuante} ${s.painelNotificacoes}`}>
          <div className={s.flutuanteTopo}>
            <strong>Notificações</strong>
            {pendentes ? (
              <button type="button" className={s.linkAcao} onClick={marcarComoLidas}>
                Marcar como lidas
              </button>
            ) : null}
          </div>
          {lista === null ? (
            <p className={s.semResultado}>Carregando…</p>
          ) : lista.length === 0 ? (
            <p className={s.semResultado}>Nenhuma notificação por enquanto.</p>
          ) : (
            <ul className={s.notificacoes}>
              {lista.map((n) => (
                <li key={n.id} data-nova={n.lida_em ? undefined : 'sim'}>
                  <strong>{n.titulo}</strong>
                  <p>{n.corpo}</p>
                  <span className="mono">
                    {dataCurta(n.criada_em, fuso)}, {hora(n.criada_em, fuso)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}

export function MenuDoUsuario({ nome, papel }: { nome: string; papel: string }) {
  const router = useRouter()
  const { aberto, setAberto, raiz } = useFlutuante()
  const idMenu = useId()

  async function sair() {
    await supabaseNoNavegador().auth.signOut()
    router.replace('/entrar')
    router.refresh()
  }

  return (
    <div ref={raiz} className={s.ancora}>
      <button
        type="button"
        className={s.usuario}
        onClick={() => setAberto(!aberto)}
        aria-expanded={aberto}
        aria-controls={aberto ? idMenu : undefined}
      >
        <Avatar nome={nome} tamanho={36} />
        <span className={s.usuarioNome}>
          <strong>{nome}</strong>
          <span>{papel}</span>
        </span>
        <ChevronDown size={16} strokeWidth={1.75} aria-hidden />
      </button>
      {aberto ? (
        <div id={idMenu} className={`${s.flutuante} ${s.menuConta}`}>
          <Link href="/painel/perfil" className={s.opcaoMenu} onClick={() => setAberto(false)}>
            <Store size={16} aria-hidden /> Perfil da barbearia
          </Link>
          <Link
            href="/painel/configuracoes"
            className={s.opcaoMenu}
            onClick={() => setAberto(false)}
          >
            <Settings size={16} aria-hidden /> Configurações
          </Link>
          <button type="button" className={s.opcaoMenu} onClick={sair}>
            <LogOut size={16} aria-hidden /> Sair
          </button>
        </div>
      ) : null}
    </div>
  )
}
