'use client'

import { useState } from 'react'
import { reais } from '@/lib/formato'
import { Avatar } from './ui'
import s from './graficos.module.css'

// Gráficos de uma série (skill dataviz): barras finas com ponta arredondada apoiadas na base,
// grade de 1px discreta, eixos em mono, tooltip por barra no hover e no foco, e tabela para leitor
// de tela com os mesmos valores (o tooltip nunca é o único caminho até o número).

export type Formato = 'reais' | 'percentual' | 'numero'

// Formatação dentro do componente: Server Components não podem passar funções para cá.
const FORMATOS: Record<Formato, { valor: (v: number) => string; eixo: (v: number) => string }> = {
  reais: { valor: reais, eixo: reaisNoEixo },
  percentual: { valor: (v) => `${v}%`, eixo: (v) => `${v}%` },
  numero: { valor: (v) => v.toLocaleString('pt-BR'), eixo: (v) => v.toLocaleString('pt-BR') },
}

/** base: cor clara da marca; destaque: laranja da marca; atual: tinta (o dia de hoje, parcial). */
export type TomDaBarra = 'base' | 'destaque' | 'atual'

export interface Ponto {
  rotulo: string
  valor: number
  detalhe?: string
  tom?: TomDaBarra
}

export function GraficoDeColunas({
  titulo,
  pontos,
  formato,
  legenda,
  rotuloACada,
}: {
  titulo: string
  pontos: Ponto[]
  formato: Formato
  /** Uma entrada por tom usado (a cor nunca identifica sozinha). */
  legenda?: { tom: TomDaBarra; rotulo: string }[]
  /** Rótulo do eixo X a cada N pontos (e sempre no último). */
  rotuloACada?: number
}) {
  const formatar = FORMATOS[formato].valor
  const formatarEixo = FORMATOS[formato].eixo
  const [foco, setFoco] = useState<number | null>(null)
  const largura = 720
  const altura = 240
  const margem = { esquerda: 44, direita: 4, topo: 10, base: 30 }
  const area = {
    l: largura - margem.esquerda - margem.direita,
    a: altura - margem.topo - margem.base,
  }
  const maximo = Math.max(1, ...pontos.map((p) => p.valor))
  const passoEixo = escalaLimpa(maximo)
  const topoEixo = Math.ceil(maximo / passoEixo) * passoEixo
  const faixa = area.l / Math.max(1, pontos.length)
  const espessura = Math.min(24, Math.max(3, faixa * 0.78))
  const aCada = rotuloACada ?? Math.ceil(pontos.length / 6)
  const y = (v: number) => margem.topo + area.a - (v / topoEixo) * area.a
  const marcas = Array.from(
    { length: Math.round(topoEixo / passoEixo) + 1 },
    (_, i) => i * passoEixo,
  )
  const ativo = foco === null ? null : pontos[foco]

  return (
    <figure className={s.figura}>
      <div className={s.area}>
        <svg
          viewBox={`0 0 ${largura} ${altura}`}
          role="group"
          aria-label={titulo}
          className={s.svg}
        >
          {marcas.map((m) => (
            <g key={m}>
              <line
                x1={margem.esquerda}
                x2={largura - margem.direita}
                y1={y(m)}
                y2={y(m)}
                className={s.grade}
              />
              <text x={0} y={y(m) + 4} className={s.eixo}>
                {m === topoEixo && formato === 'reais' ? `R$ ${formatarEixo(m)}` : formatarEixo(m)}
              </text>
            </g>
          ))}
          {pontos.map((p, i) => {
            const x = margem.esquerda + i * faixa + (faixa - espessura) / 2
            const h = Math.max(0, y(0) - y(p.valor))
            const raio = Math.min(3, h / 2, espessura / 2)
            return (
              <g key={p.rotulo}>
                {/* Área de toque maior que a barra: a faixa inteira. */}
                <rect
                  x={margem.esquerda + i * faixa}
                  y={margem.topo}
                  width={faixa}
                  height={area.a}
                  fill="transparent"
                  tabIndex={0}
                  role="button"
                  aria-label={`${p.rotulo}: ${formatar(p.valor)}`}
                  onPointerEnter={() => setFoco(i)}
                  onPointerLeave={() => setFoco(null)}
                  onFocus={() => setFoco(i)}
                  onBlur={() => setFoco(null)}
                />
                {h > 0 ? (
                  <path
                    d={colunaArredondada(x, y(0), espessura, h, raio)}
                    className={[s.barra, s[p.tom ?? 'destaque'], foco === i && s.barraAtiva]
                      .filter(Boolean)
                      .join(' ')}
                    pointerEvents="none"
                  />
                ) : null}
              </g>
            )
          })}
          {pontos.map((p, i) =>
            // A cada N pontos e no último; o vizinho colado no último sai para não sobrepor.
            (i % aCada === 0 && pontos.length - 1 - i >= aCada / 2) || i === pontos.length - 1 ? (
              <text
                key={`r-${p.rotulo}`}
                x={margem.esquerda + i * faixa + faixa / 2}
                y={altura - 8}
                className={s.eixo}
                textAnchor="middle"
              >
                {p.rotulo}
              </text>
            ) : null,
          )}
        </svg>
        {ativo && foco !== null ? (
          <div
            className={s.dica}
            role="status"
            style={{ left: `${((margem.esquerda + foco * faixa + faixa / 2) / largura) * 100}%` }}
          >
            <strong>{formatar(ativo.valor)}</strong>
            <span>{ativo.detalhe ?? ativo.rotulo}</span>
          </div>
        ) : null}
      </div>
      {legenda ? (
        <ul className={s.legenda}>
          {legenda.map((l) => (
            <li key={l.tom}>
              <span className={`${s.amostra} ${s[l.tom]}`} aria-hidden="true" />
              {l.rotulo}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="so-leitor">
        <table>
          <caption>{titulo}</caption>
          <tbody>
            {pontos.map((p) => (
              <tr key={p.rotulo}>
                <th scope="row">{p.detalhe ?? p.rotulo}</th>
                <td>{formatar(p.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}

/** Barras horizontais com o valor na ponta (ocupação, ranking). */
export function BarrasHorizontais({
  itens,
  maximo,
  formato,
  comAvatar,
}: {
  itens: Ponto[]
  maximo?: number
  formato: Formato
  /** Iniciais antes do nome (equipe). */
  comAvatar?: boolean
}) {
  const formatar = FORMATOS[formato].valor
  const topo = maximo ?? Math.max(1, ...itens.map((i) => i.valor))
  return (
    <ul className={s.horizontais}>
      {itens.map((item) => (
        <li key={item.rotulo}>
          <span className={s.nome}>
            {comAvatar ? <Avatar nome={item.rotulo} tamanho={28} /> : null}
            <span className={s.nomeTexto}>{item.rotulo}</span>
          </span>
          <span className={s.trilho} aria-hidden>
            <span
              className={s.preenchido}
              style={{ width: `${Math.min(100, (item.valor / topo) * 100)}%` }}
            />
          </span>
          <span className={s.valor}>{formatar(item.valor)}</span>
        </li>
      ))}
    </ul>
  )
}

function colunaArredondada(
  x: number,
  base: number,
  largura: number,
  altura: number,
  r: number,
): string {
  const topo = base - altura
  return [
    `M${x},${base}`,
    `V${topo + r}`,
    `Q${x},${topo} ${x + r},${topo}`,
    `H${x + largura - r}`,
    `Q${x + largura},${topo} ${x + largura},${topo + r}`,
    `V${base}`,
    'Z',
  ].join(' ')
}

function escalaLimpa(maximo: number): number {
  const bruto = maximo / 4
  const potencia = 10 ** Math.floor(Math.log10(bruto))
  const fracao = bruto / potencia
  const limpo = fracao <= 1 ? 1 : fracao <= 2 ? 2 : fracao <= 5 ? 5 : 10
  return limpo * potencia
}

/** Eixo em reais sem o símbolo: 0, 250, 750, 1k, 1,5k (o "R$" vai só no rótulo do topo). */
function reaisNoEixo(centavos: number): string {
  const valor = centavos / 100
  return Math.abs(valor) >= 1000
    ? `${(valor / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`
    : valor.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}
