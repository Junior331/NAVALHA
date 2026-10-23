'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState, type ReactNode } from 'react'
import { instanteLocal, partesLocais } from '@navalha/core'
import { Avatar } from '@/componentes/ui'
import { distribuirEmFaixas, faixaDaGrade, somarDias } from '@/lib/agenda'
import { diaPorExtenso, hora, intervaloDeDias, reais } from '@/lib/formato'
import { GRUPOS_DE_STATUS, STATUS } from '@/lib/status'
import cabecalho from '../painel.module.css'
import s from './agenda.module.css'
import { DetalheDoEvento } from './evento'
import { Filtros } from './filtros'
import type { ContextoDaAgenda, EventoDaAgenda, PosicaoDoResumo } from './tipos'

const PX_POR_MIN = 1.4
const LARGURA_DO_RESUMO = 320

type Coluna = {
  chave: string
  dia: string
  hoje: boolean
  cabecalho: ReactNode
  eventos: EventoDaAgenda[]
}

export function GradeDaAgenda({
  contexto,
  visao,
  data,
  dias,
  gruposVisiveis,
  barbeirosVisiveis,
  eventoInicial,
  eventos,
  expediente,
  verPagamento,
  novo,
}: {
  contexto: ContextoDaAgenda
  visao: 'dia' | 'semana'
  data: string
  dias: string[]
  /** null = todos */
  gruposVisiveis: string[] | null
  barbeirosVisiveis: string[] | null
  eventoInicial: string | null
  eventos: EventoDaAgenda[]
  expediente: { abre: string; fecha: string }[]
  verPagamento: boolean
  novo: ReactNode
}) {
  const router = useRouter()
  const { fuso } = contexto
  const ultimoCartao = useRef<HTMLElement | null>(null)
  const [aberto, setAberto] = useState<{
    evento: EventoDaAgenda
    posicao: PosicaoDoResumo | null
  } | null>(() => {
    const evento = eventoInicial ? eventos.find((e) => e.id === eventoInicial) : undefined
    return evento ? { evento, posicao: null } : null
  })

  const endereco = (mudar: {
    data?: string
    visao?: string
    status?: string[] | null
    barbeiro?: string[] | null
  }) => {
    const p = new URLSearchParams()
    p.set('data', mudar.data ?? data)
    p.set('visao', mudar.visao ?? visao)
    const status = mudar.status === undefined ? gruposVisiveis : mudar.status
    const barbeiro = mudar.barbeiro === undefined ? barbeirosVisiveis : mudar.barbeiro
    if (status) p.set('status', status.join(','))
    if (barbeiro) p.set('barbeiro', barbeiro.join(','))
    return `/painel/agenda?${p.toString()}`
  }
  const passo = visao === 'semana' ? 7 : 1

  const nomeDoBarbeiro = new Map(contexto.barbeiros.map((b) => [b.id, b.nome]))
  const grupoDe = (e: EventoDaAgenda) =>
    GRUPOS_DE_STATUS.find((g) => g.status.includes(e.status))?.chave ?? ''
  const barbeiros = contexto.barbeiros.filter(
    (b) => !barbeirosVisiveis || barbeirosVisiveis.includes(b.id),
  )
  const visiveis = eventos.filter(
    (e) =>
      (!gruposVisiveis || gruposVisiveis.includes(grupoDe(e))) &&
      (!barbeirosVisiveis || barbeirosVisiveis.includes(e.barbeiroId)),
  )

  const minutoNoDia = (iso: string) => partesLocais(new Date(iso), fuso).minutos
  const diaDe = (iso: string) => partesLocais(new Date(iso), fuso).data
  const intervalo = (e: EventoDaAgenda) => ({
    inicioMin: minutoNoDia(e.inicio),
    fimMin: Math.max(
      minutoNoDia(e.inicio) + 15,
      diaDe(e.fim) === diaDe(e.inicio) ? minutoNoDia(e.fim) : 24 * 60,
    ),
  })
  const faixa = faixaDaGrade(expediente, visiveis.map(intervalo))
  const horas = Array.from(
    { length: (faixa.fimMin - faixa.inicioMin) / 60 },
    (_, i) => faixa.inicioMin + i * 60,
  )
  const altura = (faixa.fimMin - faixa.inicioMin) * PX_POR_MIN
  const meioDia = (dia: string) => instanteLocal(dia, 12 * 60, fuso)

  const colunas: Coluna[] =
    visao === 'dia'
      ? barbeiros.map((b) => {
          const doBarbeiro = visiveis.filter((e) => e.barbeiroId === b.id)
          return {
            chave: b.id,
            dia: data,
            hoje: false,
            cabecalho: (
              <>
                <Avatar nome={b.nome} tamanho={30} />
                <span className={s.barbeiroColuna}>
                  <strong>{b.nome}</strong>
                  <span>
                    {doBarbeiro.length} agendamento{doBarbeiro.length === 1 ? '' : 's'}
                  </span>
                </span>
              </>
            ),
            eventos: doBarbeiro,
          }
        })
      : dias.map((dia) => {
          const semana = meioDia(dia)
            .toLocaleDateString('pt-BR', { weekday: 'short', timeZone: fuso })
            .replace('.', '')
          return {
            chave: dia,
            dia,
            hoje: dia === contexto.hoje,
            cabecalho: (
              <>
                <span className={s.diaSemana}>
                  {semana.charAt(0).toUpperCase()}
                  {semana.slice(1)}
                </span>
                <span className={s.diaNumero}>{Number(dia.slice(8, 10))}</span>
                {dia === contexto.hoje ? <span className="so-leitor">(hoje)</span> : null}
              </>
            ),
            eventos: visiveis.filter((e) => diaDe(e.inicio) === dia),
          }
        })

  const agora = partesLocais(new Date(contexto.agora), fuso)
  const linhaDoAgora =
    agora.minutos >= faixa.inicioMin && agora.minutos <= faixa.fimMin
      ? (agora.minutos - faixa.inicioMin) * PX_POR_MIN
      : null

  const primeiro = dias[0] ?? data
  const ultimo = dias[dias.length - 1] ?? data
  const subtitulo =
    visao === 'dia' ? diaPorExtenso(meioDia(data), fuso) : semanaPorExtenso(primeiro, ultimo)
  const ocultos =
    (gruposVisiveis ? GRUPOS_DE_STATUS.length - gruposVisiveis.length : 0) +
    (barbeirosVisiveis ? contexto.barbeiros.length - barbeiros.length : 0)

  function abrirResumo(evento: EventoDaAgenda, cartao: HTMLElement) {
    const r = cartao.getBoundingClientRect()
    const cabeADireita = r.right + 8 + LARGURA_DO_RESUMO <= window.innerWidth - 16
    const left = cabeADireita ? r.right + 8 : Math.max(16, r.left - 8 - LARGURA_DO_RESUMO)
    ultimoCartao.current = cartao
    setAberto({
      evento,
      posicao:
        r.top > window.innerHeight / 2
          ? { left, bottom: Math.max(16, window.innerHeight - r.bottom) }
          : { left, top: Math.max(16, r.top) },
    })
  }

  function fechar() {
    setAberto(null)
    ultimoCartao.current?.focus()
  }

  return (
    <div className={s.agenda}>
      <div className={cabecalho.cabecalhoPagina}>
        <div>
          <h1>Agenda</h1>
          <p>
            {subtitulo} · {visiveis.length} agendamento{visiveis.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className={s.barra}>
          <div className={s.navegacao}>
            <Link
              className={s.quadrado}
              href={endereco({ data: somarDias(data, -passo) })}
              aria-label={visao === 'semana' ? 'Semana anterior' : 'Dia anterior'}
            >
              <ChevronLeft size={18} strokeWidth={1.75} aria-hidden />
            </Link>
            <label className={s.periodo}>
              <span aria-hidden="true">{intervaloDeDias(primeiro, ultimo)}</span>
              <input
                type="date"
                value={data}
                aria-label="Ir para a data"
                onClick={(e) => e.currentTarget.showPicker?.()}
                onChange={(e) => e.target.value && router.push(endereco({ data: e.target.value }))}
              />
            </label>
            <Link
              className={s.quadrado}
              href={endereco({ data: somarDias(data, passo) })}
              aria-label={visao === 'semana' ? 'Próxima semana' : 'Próximo dia'}
            >
              <ChevronRight size={18} strokeWidth={1.75} aria-hidden />
            </Link>
          </div>
          <Link className={s.botaoBarra} href={endereco({ data: contexto.hoje })}>
            Hoje
          </Link>
          <div className={s.segmentos} role="group" aria-label="Visão da agenda">
            <Link
              href={endereco({ visao: 'dia' })}
              aria-current={visao === 'dia' ? 'page' : undefined}
            >
              Dia
            </Link>
            <Link
              href={endereco({ visao: 'semana' })}
              aria-current={visao === 'semana' ? 'page' : undefined}
            >
              Semana
            </Link>
          </div>
          <Filtros
            ocultos={ocultos}
            grupos={GRUPOS_DE_STATUS.map((g) => ({
              chave: g.chave,
              rotulo: g.rotulo,
              total: eventos.filter((e) => g.status.includes(e.status)).length,
            }))}
            barbeiros={contexto.barbeiros.map((b) => ({
              id: b.id,
              nome: b.nome,
              total: eventos.filter((e) => e.barbeiroId === b.id).length,
            }))}
            gruposVisiveis={gruposVisiveis}
            barbeirosVisiveis={barbeirosVisiveis}
            aoAplicar={(status, barbeiro) => router.push(endereco({ status, barbeiro }))}
          />
          {novo}
        </div>
      </div>

      {/* Rolável pelo teclado também (a grade pode passar da tela nos dois sentidos). */}
      <div
        className={s.rolagem}
        tabIndex={0}
        role="region"
        aria-label="Grade da agenda"
        onScroll={() => aberto?.posicao && setAberto(null)}
      >
        <div
          className={s.grade}
          data-visao={visao}
          style={{
            gridTemplateColumns: `64px repeat(${Math.max(1, colunas.length)}, minmax(${visao === 'dia' ? 220 : 128}px, 1fr))`,
            gridTemplateRows: `auto minmax(${altura}px, 1fr)`,
          }}
        >
          <div className={s.canto} />
          {colunas.map((c) => (
            <div
              key={c.chave}
              className={s.cabecalhoColuna}
              data-hoje={c.hoje ? 'sim' : undefined}
              aria-current={c.hoje ? 'date' : undefined}
            >
              {c.cabecalho}
            </div>
          ))}

          <div className={s.horas}>
            {horas.map((m) => (
              <span key={m} style={{ top: (m - faixa.inicioMin) * PX_POR_MIN }}>
                {String(m / 60).padStart(2, '0')}h
              </span>
            ))}
          </div>
          {colunas.map((c) => (
            <div key={c.chave} className={s.coluna} data-hoje={c.hoje ? 'sim' : undefined}>
              {horas.map((m) => (
                <span
                  key={m}
                  className={s.linhaHora}
                  style={{ top: (m - faixa.inicioMin) * PX_POR_MIN }}
                />
              ))}
              {c.dia === contexto.hoje && linhaDoAgora !== null ? (
                <span className={s.agora} style={{ top: linhaDoAgora }} aria-hidden="true" />
              ) : null}
              {distribuirEmFaixas(c.eventos.map((e) => ({ ...e, ...intervalo(e) }))).map((e) => {
                const barbeiro = nomeDoBarbeiro.get(e.barbeiroId) ?? 'Barbeiro'
                const servicos = e.servicos.join(' + ')
                // Lado a lado na semana o cartão fica estreito: só o início e o nome.
                const estreito = visao === 'semana' && e.faixas > 1
                const longo = e.fimMin - e.inicioMin >= 60 && !estreito
                // Até 30 min não cabem duas linhas: horário e nome na mesma linha.
                const curto = e.fimMin - e.inicioMin < 35
                const original = eventos.find((x) => x.id === e.id) ?? e
                return (
                  <button
                    key={e.id}
                    type="button"
                    className={s.evento}
                    data-status={e.status}
                    data-curto={curto ? 'sim' : undefined}
                    style={{
                      top: (e.inicioMin - faixa.inicioMin) * PX_POR_MIN + 2,
                      height: Math.max(24, (e.fimMin - e.inicioMin) * PX_POR_MIN - 4),
                      left: `calc(${(e.faixa / e.faixas) * 100}% + 4px)`,
                      width: `calc(${100 / e.faixas}% - 8px)`,
                    }}
                    aria-label={`${hora(e.inicio, fuso)} a ${hora(e.fim, fuso)}, ${e.cliente.nome}, ${servicos}, ${barbeiro}, ${STATUS[e.status].rotulo}`}
                    onClick={(clique) => abrirResumo(original, clique.currentTarget)}
                  >
                    <span className={s.eventoTopo}>
                      <span className={s.eventoHora}>
                        {hora(e.inicio, fuso)}
                        {estreito ? '' : ` - ${hora(e.fim, fuso)}`}
                      </span>
                      {visao === 'dia' && longo ? (
                        <span className={s.eventoStatus}>{STATUS[e.status].rotulo}</span>
                      ) : null}
                    </span>
                    <span className={s.eventoNome}>{e.cliente.nome}</span>
                    {longo ? (
                      <span className={s.eventoServico}>
                        {servicos} · {visao === 'dia' ? reaisInteiros(e.valorCentavos) : barbeiro}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
        {colunas.length === 0 ? (
          <p className={s.semColunas}>
            {contexto.barbeiros.length === 0
              ? 'Nenhum barbeiro ativo na equipe.'
              : 'Nenhum barbeiro selecionado nos filtros.'}
          </p>
        ) : null}
      </div>

      {aberto ? (
        <DetalheDoEvento
          key={aberto.evento.id}
          evento={aberto.evento}
          posicao={aberto.posicao}
          contexto={contexto}
          verPagamento={verPagamento}
          aoFechar={fechar}
        />
      ) : null}
    </div>
  )
}

function semanaPorExtenso(primeiro: string, ultimo: string): string {
  const mes = (d: string) =>
    new Date(`${d}T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' })
  const dia = (d: string) => d.slice(8, 10)
  if (primeiro === ultimo) return `${dia(primeiro)} de ${mes(primeiro)}`
  return mes(primeiro) === mes(ultimo)
    ? `${dia(primeiro)} a ${dia(ultimo)} de ${mes(ultimo)}`
    : `${dia(primeiro)} de ${mes(primeiro)} a ${dia(ultimo)} de ${mes(ultimo)}`
}

/** "R$ 85" nos cartões do dia; centavos só quando existem. */
function reaisInteiros(centavos: number): string {
  return centavos % 100 === 0 ? `R$ ${centavos / 100}` : reais(centavos)
}
