'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Botao } from '@/componentes/ui'
import { somarDias } from '@/lib/agenda'
import f from './filtros.module.css'

// Figma Admin 08b: todos os serviços no filtro, com busca, e um "Limpar" só. Os filtros valem na
// hora (sem botão "Aplicar").

interface Filtros {
  de: string
  ate: string
  barbeiroId?: string
  servicoIds: string[]
}

export function FiltrosDoRelatorio({
  filtros,
  barbeiros,
  servicos,
}: {
  filtros: Filtros
  barbeiros: { id: string; nome: string }[]
  servicos: { id: string; nome: string; ativo: boolean }[]
}) {
  const router = useRouter()
  const [busca, setBusca] = useState('')

  function aplicar(mudar: Partial<Filtros>) {
    const novo = { ...filtros, ...mudar }
    const p = new URLSearchParams({ de: novo.de, ate: novo.ate })
    if (novo.barbeiroId) p.set('barbeiro', novo.barbeiroId)
    if (novo.servicoIds.length) p.set('servicos', novo.servicoIds.join(','))
    router.push(`/painel/relatorios?${p.toString()}`)
  }

  const ate = filtros.ate
  const periodos = [
    { nome: '7 dias', de: somarDias(ate, -6) },
    { nome: '30 dias', de: somarDias(ate, -29) },
    { nome: '90 dias', de: somarDias(ate, -89) },
  ]
  const filtrando = Boolean(filtros.barbeiroId) || filtros.servicoIds.length > 0
  const visiveis = servicos.filter((x) =>
    x.nome.toLocaleLowerCase('pt-BR').includes(busca.toLocaleLowerCase('pt-BR')),
  )
  const resumoServicos =
    filtros.servicoIds.length === 0
      ? 'Todos os serviços'
      : filtros.servicoIds.length === 1
        ? (servicos.find((x) => x.id === filtros.servicoIds[0])?.nome ?? '1 serviço')
        : `${filtros.servicoIds.length} serviços`

  return (
    <div className={f.barra}>
      <div className={f.grupo} role="group" aria-label="Período">
        {periodos.map((p) => (
          <button
            key={p.nome}
            type="button"
            className={f.atalho}
            aria-pressed={filtros.de === p.de}
            onClick={() => aplicar({ de: p.de })}
          >
            {p.nome}
          </button>
        ))}
        <label className={f.data}>
          <span>De</span>
          <input
            type="date"
            value={filtros.de}
            max={filtros.ate}
            onChange={(e) => e.target.value && aplicar({ de: e.target.value })}
          />
        </label>
        <label className={f.data}>
          <span>Até</span>
          <input
            type="date"
            value={filtros.ate}
            min={filtros.de}
            onChange={(e) => e.target.value && aplicar({ ate: e.target.value })}
          />
        </label>
      </div>

      <div className={f.grupo}>
        <label className={f.data}>
          <span className="so-leitor">Barbeiro</span>
          <select
            value={filtros.barbeiroId ?? ''}
            onChange={(e) => aplicar({ barbeiroId: e.target.value || undefined })}
          >
            <option value="">Todos os barbeiros</option>
            {barbeiros.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nome}
              </option>
            ))}
          </select>
        </label>

        <details className={f.servicos}>
          <summary>{resumoServicos}</summary>
          <div className={f.painel}>
            <input
              type="search"
              placeholder="Buscar serviço"
              aria-label="Buscar serviço"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <ul>
              {visiveis.map((x) => (
                <li key={x.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={filtros.servicoIds.includes(x.id)}
                      onChange={(e) =>
                        aplicar({
                          servicoIds: e.target.checked
                            ? [...filtros.servicoIds, x.id]
                            : filtros.servicoIds.filter((id) => id !== x.id),
                        })
                      }
                    />
                    {x.nome}
                    {x.ativo ? '' : ' (inativo)'}
                  </label>
                </li>
              ))}
              {visiveis.length === 0 ? <li>Nenhum serviço com esse nome.</li> : null}
            </ul>
          </div>
        </details>

        {filtrando ? (
          <Botao
            variante="fantasma"
            onClick={() => router.push(`/painel/relatorios?de=${filtros.de}&ate=${filtros.ate}`)}
          >
            Limpar filtros
          </Botao>
        ) : null}
      </div>
    </div>
  )
}
