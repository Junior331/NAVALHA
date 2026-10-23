'use client'

import { Check, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { useId } from 'react'
import { useFlutuante } from '@/componentes/ui'
import d from './dashboard.module.css'

const PERIODOS = [7, 30, 90]

// Figma Admin 01: "Últimos 30 dias" no cabeçalho do Dashboard.
export function SeletorDePeriodo({ dias }: { dias: number }) {
  const { aberto, setAberto, raiz } = useFlutuante()
  const idMenu = useId()
  return (
    <div ref={raiz} className={d.ancora}>
      <button
        type="button"
        className={d.periodo}
        onClick={() => setAberto(!aberto)}
        aria-expanded={aberto}
        aria-controls={aberto ? idMenu : undefined}
      >
        Últimos {dias} dias
        <ChevronDown size={16} strokeWidth={1.75} aria-hidden />
      </button>
      {aberto ? (
        <div id={idMenu} className={d.menuPeriodo}>
          {PERIODOS.map((p) => (
            <Link
              key={p}
              href={p === 30 ? '/painel' : `/painel?periodo=${p}`}
              aria-current={p === dias ? 'true' : undefined}
              onClick={() => setAberto(false)}
            >
              Últimos {p} dias
              {p === dias ? <Check size={16} aria-hidden /> : null}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  )
}
