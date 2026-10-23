'use client'

import { useState } from 'react'
import { reais, reaisCompacto } from '@/lib/formato'
import s from './graficos.module.css'

// Gráficos de uma série (skill dataviz): barras ≤ 24px com ponta arredondada de 4px apoiadas na
// base, grade de 1px discreta, tooltip por barra no hover e no foco, e tabela acessível com os
// mesmos valores (o tooltip nunca é o único caminho até o número).

export type Formato = 'reais' | 'percentual' | 'numero'

// Formatação dentro do componente: Server Components não podem passar funções para cá.
const FORMATOS: Record<Formato, { valor: (v: number) => string; eixo: (v: number) => string }> = {
  reais: { valor: reais, eixo: reaisCompacto },
  percentual: { valor: (v) => `${v}%`, eixo: (v) => `${v}%` },
  numero: { valor: (v) => v.toLocaleString('pt-BR'), eixo: (v) => v.toLocaleString('pt-BR') },
}

export interface Ponto {
  rotulo: string
  valor: number
  detalhe?: string
}

export function GraficoDeColunas({
  titulo,
  pontos,
  formato,
}: {
  titulo: string
  pontos: Ponto[]
  formato: Formato
}) {
  const formatar = FORMATOS[formato].valor
  const formatarEixo = FORMATOS[formato].eixo
  const [foco, setFoco] = useState<number | null>(null)
  const largura = 720
  const altura = 200
  const margem = { esquerda: 48, direita: 8, topo: 8, base: 24 }
  const area = {
    l: largura - margem.esquerda - margem.direita,
    a: altura - margem.topo - margem.base,
  }
  const maximo = Math.max(1, ...pontos.map((p) => p.valor))
  const passoEixo = escalaLimpa(maximo)
  const topoEixo = Math.ceil(maximo / passoEixo) * passoEixo
  const faixa = area.l / Math.max(1, pontos.length)
  const espessura = Math.min(24, Math.max(4, faixa - 2))
  const y = (v: number) => margem.topo + area.a - (v / topoEixo) * area.a
  const marcas = Array.from(
    { length: Math.round(topoEixo / passoEixo) + 1 },
    (_, i) => i * passoEixo,
  )
  const ativo = foco === null ? null : pontos[foco]

  return (
    <figure className={s.figura}>
      <div className={s.area}>
        <svg viewBox={`0 0 ${largura} ${altura}`} role="img" aria-label={titulo} className={s.svg}>
          {marcas.map((m) => (
            <g key={m}>
              <line
                x1={margem.esquerda}
                x2={largura - margem.direita}
                y1={y(m)}
                y2={y(m)}
                className={s.grade}
              />
              <text x={margem.esquerda - 8} y={y(m) + 4} className={s.eixo} textAnchor="end">
                {formatarEixo(m)}
              </text>
            </g>
          ))}
          {pontos.map((p, i) => {
            const x = margem.esquerda + i * faixa + (faixa - espessura) / 2
            const h = Math.max(0, y(0) - y(p.valor))
            const raio = Math.min(4, h / 2, espessura / 2)
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
                    className={foco === i ? `${s.barra} ${s.barraAtiva}` : s.barra}
                    pointerEvents="none"
                  />
                ) : null}
              </g>
            )
          })}
          {pontos.map((p, i) =>
            i % Math.ceil(pontos.length / 6) === 0 || i === pontos.length - 1 ? (
              <text
                key={`r-${p.rotulo}`}
                x={margem.esquerda + i * faixa + faixa / 2}
                y={altura - 6}
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
      <details className={s.tabela}>
        <summary>Ver em tabela</summary>
        <table>
          <caption className="so-leitor">{titulo}</caption>
          <tbody>
            {pontos.map((p) => (
              <tr key={p.rotulo}>
                <th scope="row">{p.detalhe ?? p.rotulo}</th>
                <td>{formatar(p.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}

/** Barras horizontais com o valor na ponta (ocupação, ranking). */
export function BarrasHorizontais({
  itens,
  maximo,
  formato,
}: {
  itens: Ponto[]
  maximo?: number
  formato: Formato
}) {
  const formatar = FORMATOS[formato].valor
  const topo = maximo ?? Math.max(1, ...itens.map((i) => i.valor))
  return (
    <ul className={s.horizontais}>
      {itens.map((item) => (
        <li key={item.rotulo}>
          <span className={s.nome}>{item.rotulo}</span>
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
