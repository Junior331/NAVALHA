'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { PaginaDaBarbearia } from '@navalha/servidor'
import { minutosEmTexto, reais } from '@/lib/formato'
import v from './vitrine.module.css'

// Serviços da página pública. Escolher aqui já leva ao fluxo com os serviços marcados
// (backlog Cliente 03), e o botão tem um rótulo só: "Agendar horário".
export function EscolhaDeServicos({
  slug,
  servicos,
  aceitaAgendamentos,
}: {
  slug: string
  servicos: PaginaDaBarbearia['servicos']
  aceitaAgendamentos: boolean
}) {
  const [escolhidos, setEscolhidos] = useState<string[]>([])
  const selecionados = servicos.filter((s) => escolhidos.includes(s.id))
  const total = selecionados.reduce((t, s) => t + s.precoCentavos, 0)
  const duracao = selecionados.reduce((t, s) => t + s.duracaoMin, 0)
  const destino = `/${slug}/agendar${escolhidos.length ? `?servicos=${escolhidos.join(',')}` : ''}`

  return (
    <>
      <ul className={v.servicos}>
        {servicos.map((s) => (
          <li key={s.id}>
            <label className={v.servico}>
              <input
                type="checkbox"
                checked={escolhidos.includes(s.id)}
                disabled={!aceitaAgendamentos}
                onChange={(e) =>
                  setEscolhidos(
                    e.target.checked
                      ? [...escolhidos, s.id]
                      : escolhidos.filter((id) => id !== s.id),
                  )
                }
              />
              <span className={v.servicoTexto}>
                <strong>{s.nome}</strong>
                <span className={v.suave}>
                  {minutosEmTexto(s.duracaoMin)}
                  {s.descricao ? ` · ${s.descricao}` : ''}
                </span>
              </span>
              <span className={v.preco}>
                {s.precoSemDescontoCentavos > s.precoCentavos ? (
                  <s className={v.suave}>{reais(s.precoSemDescontoCentavos)}</s>
                ) : null}
                {reais(s.precoCentavos)}
              </span>
            </label>
          </li>
        ))}
      </ul>
      {aceitaAgendamentos ? (
        <div className={v.barraAgendar}>
          <span>
            {selecionados.length
              ? `${selecionados.length} serviço${selecionados.length > 1 ? 's' : ''} · ${minutosEmTexto(duracao)} · ${reais(total)}`
              : 'Escolha os serviços ou siga direto'}
          </span>
          <Link href={destino} className={v.botaoAgendar}>
            Agendar horário
          </Link>
        </div>
      ) : null}
    </>
  )
}
