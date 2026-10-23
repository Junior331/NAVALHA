'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { instanteLocal, partesLocais, type StatusAgendamento } from '@navalha/core'
import { Etiqueta } from '@/componentes/ui'
import { distribuirEmFaixas, faixaDaGrade, somarDias } from '@/lib/agenda'
import { hora } from '@/lib/formato'
import { STATUS } from '@/lib/status'
import s from './agenda.module.css'
import { DetalheDoEvento } from './evento'
import type { ContextoDaAgenda, EventoDaAgenda } from './tipos'

const PX_POR_MIN = 1.4
const NA_GRADE: StatusAgendamento[] = [
  'reservado',
  'confirmado',
  'em_atendimento',
  'concluido',
  'no_show',
]
const LEGENDA: StatusAgendamento[] = NA_GRADE

type Coluna = {
  chave: string
  titulo: string
  subtitulo?: string
  dia: string
  eventos: EventoDaAgenda[]
}

export function GradeDaAgenda({
  contexto,
  visao,
  data,
  dias,
  filtro,
  eventos,
  expediente,
  verPagamento,
}: {
  contexto: ContextoDaAgenda
  visao: 'dia' | 'semana'
  data: string
  dias: string[]
  filtro: string | null
  eventos: EventoDaAgenda[]
  expediente: { abre: string; fecha: string }[]
  verPagamento: boolean
}) {
  const router = useRouter()
  const [aberto, setAberto] = useState<EventoDaAgenda | null>(null)
  const { fuso } = contexto

  const endereco = (mudar: { data?: string; visao?: string; barbeiro?: string | null }) => {
    const p = new URLSearchParams()
    p.set('data', mudar.data ?? data)
    p.set('visao', mudar.visao ?? visao)
    const barbeiro = mudar.barbeiro === undefined ? filtro : mudar.barbeiro
    if (barbeiro) p.set('barbeiro', barbeiro)
    return `/painel/agenda?${p.toString()}`
  }
  const passo = visao === 'semana' ? 7 : 1

  const nomeDoBarbeiro = new Map(contexto.barbeiros.map((b) => [b.id, b.nome]))
  const doFiltro = eventos.filter((e) => !filtro || e.barbeiroId === filtro)
  const naGrade = doFiltro.filter((e) => NA_GRADE.includes(e.status))
  // Cancelado libera o espaço na grade (backlog Admin 02) e vai para a lista abaixo.
  const cancelados = doFiltro.filter((e) => e.status.startsWith('cancelado'))

  const minutoNoDia = (iso: string) => partesLocais(new Date(iso), fuso).minutos
  const diaDe = (iso: string) => partesLocais(new Date(iso), fuso).data
  const intervalo = (e: EventoDaAgenda) => ({
    inicioMin: minutoNoDia(e.inicio),
    fimMin: Math.max(
      minutoNoDia(e.inicio) + 15,
      diaDe(e.fim) === diaDe(e.inicio) ? minutoNoDia(e.fim) : 24 * 60,
    ),
  })
  const faixa = faixaDaGrade(expediente, naGrade.map(intervalo))
  const horas = Array.from(
    { length: (faixa.fimMin - faixa.inicioMin) / 60 },
    (_, i) => faixa.inicioMin + i * 60,
  )
  const altura = (faixa.fimMin - faixa.inicioMin) * PX_POR_MIN

  const barbeirosVisiveis = contexto.barbeiros.filter((b) => !filtro || b.id === filtro)
  const colunas: Coluna[] =
    visao === 'dia'
      ? barbeirosVisiveis.map((b) => ({
          chave: b.id,
          titulo: b.nome,
          dia: data,
          eventos: naGrade.filter((e) => e.barbeiroId === b.id),
        }))
      : dias.map((dia) => {
          const meioDia = instanteLocal(dia, 12 * 60, fuso)
          return {
            chave: dia,
            titulo: meioDia.toLocaleDateString('pt-BR', { weekday: 'short', timeZone: fuso }),
            subtitulo: meioDia.toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              timeZone: fuso,
            }),
            dia,
            eventos: naGrade.filter((e) => diaDe(e.inicio) === dia),
          }
        })

  const agora = partesLocais(new Date(contexto.agora), fuso)
  const linhaDoAgora =
    agora.minutos >= faixa.inicioMin && agora.minutos <= faixa.fimMin
      ? (agora.minutos - faixa.inicioMin) * PX_POR_MIN
      : null

  return (
    <div className={s.agenda}>
      <div className={s.barra}>
        <div className={s.navegacao}>
          <Link className={s.botaoBarra} href={endereco({ data: contexto.hoje })}>
            Hoje
          </Link>
          <Link
            className={s.botaoBarra}
            href={endereco({ data: somarDias(data, -passo) })}
            aria-label={visao === 'semana' ? 'Semana anterior' : 'Dia anterior'}
          >
            ‹
          </Link>
          <Link
            className={s.botaoBarra}
            href={endereco({ data: somarDias(data, passo) })}
            aria-label={visao === 'semana' ? 'Próxima semana' : 'Próximo dia'}
          >
            ›
          </Link>
          <label className={s.dataBarra}>
            <span className="so-leitor">Ir para a data</span>
            <input
              type="date"
              value={data}
              onChange={(e) => e.target.value && router.push(endereco({ data: e.target.value }))}
            />
          </label>
        </div>
        <div className={s.navegacao}>
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
          <label className={s.filtro}>
            <span className="so-leitor">Barbeiro</span>
            <select
              value={filtro ?? ''}
              onChange={(e) => router.push(endereco({ barbeiro: e.target.value || null }))}
            >
              <option value="">Todos os barbeiros</option>
              {contexto.barbeiros.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nome}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <ul className={s.legenda} aria-label="Legenda dos status">
        {LEGENDA.map((status) => (
          <li key={status}>
            <span className={`${s.amostra} ${s[status]}`} aria-hidden="true" />
            {STATUS[status].rotulo}
          </li>
        ))}
      </ul>

      {/* Rolável pelo teclado também (a grade pode passar da tela nos dois sentidos). */}
      <div className={s.rolagem} tabIndex={0} role="region" aria-label="Grade da agenda">
        <div
          className={s.grade}
          style={{
            gridTemplateColumns: `56px repeat(${colunas.length}, minmax(${visao === 'dia' ? 180 : 120}px, 1fr))`,
          }}
        >
          <div className={s.canto} />
          {colunas.map((c) => (
            <div
              key={c.chave}
              className={s.cabecalhoColuna}
              aria-current={c.dia === contexto.hoje && visao === 'semana' ? 'date' : undefined}
            >
              <strong>{c.titulo}</strong>
              {c.subtitulo ? <span>{c.subtitulo}</span> : null}
            </div>
          ))}

          <div className={s.horas} style={{ height: altura }}>
            {horas.map((m) => (
              <span key={m} style={{ top: (m - faixa.inicioMin) * PX_POR_MIN }}>
                {String(m / 60).padStart(2, '0')}:00
              </span>
            ))}
          </div>
          {colunas.map((c) => (
            <div key={c.chave} className={s.coluna} style={{ height: altura }}>
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
                const servicos = e.servicos.join(', ')
                const rotulo = `${hora(e.inicio, fuso)} a ${hora(e.fim, fuso)}, ${e.cliente.nome}, ${servicos}, ${barbeiro}, ${STATUS[e.status].rotulo}`
                return (
                  <button
                    key={e.id}
                    type="button"
                    className={`${s.evento} ${s[e.status]}`}
                    style={{
                      top: (e.inicioMin - faixa.inicioMin) * PX_POR_MIN,
                      height: Math.max(22, (e.fimMin - e.inicioMin) * PX_POR_MIN - 2),
                      left: `calc(${(e.faixa / e.faixas) * 100}% + 2px)`,
                      width: `calc(${100 / e.faixas}% - 4px)`,
                    }}
                    aria-label={rotulo}
                    onClick={() => setAberto(eventos.find((x) => x.id === e.id) ?? null)}
                  >
                    <span className={s.eventoLinha}>
                      <strong>{hora(e.inicio, fuso)}</strong> {e.cliente.nome}
                    </span>
                    <span className={s.eventoLinha}>
                      {servicos}
                      {visao === 'semana' || filtro ? ` · ${barbeiro}` : ''}
                    </span>
                    <span className={s.eventoStatus}>{STATUS[e.status].rotulo}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {colunas.length === 0 ? (
        <p className={s.semColunas}>Nenhum barbeiro ativo na equipe.</p>
      ) : null}

      {cancelados.length > 0 ? (
        <section className={s.cancelados} aria-labelledby="titulo-cancelados">
          <h2 id="titulo-cancelados" className="rotulo">
            Cancelados ({cancelados.length}) · o horário ficou livre
          </h2>
          <ul>
            {cancelados.map((e) => (
              <li key={e.id}>
                <button type="button" onClick={() => setAberto(e)}>
                  <span>
                    {visao === 'semana'
                      ? `${e.inicio.slice(8, 10)}/${e.inicio.slice(5, 7)} · `
                      : ''}
                    {hora(e.inicio, fuso)} · {e.cliente.nome} · {e.servicos.join(', ')} ·{' '}
                    {nomeDoBarbeiro.get(e.barbeiroId) ?? 'Barbeiro'}
                  </span>
                  <Etiqueta tom="risco">{STATUS[e.status].rotulo}</Etiqueta>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {aberto ? (
        <DetalheDoEvento
          key={aberto.id}
          evento={aberto}
          contexto={contexto}
          verPagamento={verPagamento}
          aoFechar={() => setAberto(null)}
        />
      ) : null}
    </div>
  )
}
