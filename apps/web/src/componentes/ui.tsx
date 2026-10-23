'use client'

import { X } from 'lucide-react'
import Link from 'next/link'
import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react'
import { iniciais } from '@/lib/formato'
import s from './ui.module.css'

type Variante = 'primario' | 'secundario' | 'perigo' | 'perigoContorno' | 'fantasma'

const classesDoBotao = (variante: Variante, largo?: boolean, grande?: boolean) =>
  [s.botao, s[variante], largo && s.largo, grande && s.grande].filter(Boolean).join(' ')

export function Botao({
  variante = 'primario',
  largo,
  grande,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante
  largo?: boolean
  grande?: boolean
}) {
  return (
    <button
      type="button"
      {...props}
      className={[classesDoBotao(variante, largo, grande), className].filter(Boolean).join(' ')}
    />
  )
}

export function BotaoLink({
  href,
  variante = 'primario',
  largo,
  children,
}: {
  href: string
  variante?: Variante
  largo?: boolean
  children: ReactNode
}) {
  return (
    <Link href={href} className={classesDoBotao(variante, largo)}>
      {children}
    </Link>
  )
}

export const Campo = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { rotulo: string; ajuda?: string; erro?: string | null }
>(function Campo({ rotulo, ajuda, erro, id, className, ...props }, ref) {
  const gerado = useId()
  const idCampo = id ?? gerado
  const idAjuda = `${idCampo}-ajuda`
  return (
    <label className={s.campo} htmlFor={idCampo}>
      <span>{rotulo}</span>
      <input
        ref={ref}
        id={idCampo}
        className={[s.entrada, className].filter(Boolean).join(' ')}
        aria-invalid={erro ? true : undefined}
        aria-describedby={ajuda || erro ? idAjuda : undefined}
        {...props}
      />
      {erro ? (
        <span id={idAjuda} className={s.erroCampo}>
          {erro}
        </span>
      ) : ajuda ? (
        <span id={idAjuda} className={s.ajudaCampo}>
          {ajuda}
        </span>
      ) : null}
    </label>
  )
})

export function Selecao({
  rotulo,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { rotulo: string }) {
  const id = useId()
  return (
    <label className={s.campo} htmlFor={id}>
      <span>{rotulo}</span>
      <select id={id} className={s.entrada} {...props}>
        {children}
      </select>
    </label>
  )
}

export function Cartao({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={[s.cartao, className].filter(Boolean).join(' ')}>{children}</section>
}

export type Tom = 'neutro' | 'sucesso' | 'alerta' | 'risco' | 'informativo'

export function Etiqueta({
  tom = 'neutro',
  ponto,
  children,
}: {
  tom?: Tom
  /** Bolinha da cor do status antes do texto (popover do evento). */
  ponto?: boolean
  children: ReactNode
}) {
  return (
    <span className={[s.etiqueta, s[tom], ponto && s.comPonto].filter(Boolean).join(' ')}>
      {children}
    </span>
  )
}

/** Iniciais do nome num círculo (equipe e clientes; o painel não usa foto). */
export function Avatar({ nome, tamanho = 32 }: { nome: string; tamanho?: number }) {
  return (
    <span
      className={s.avatar}
      style={{ width: tamanho, height: tamanho, fontSize: Math.max(10, Math.round(tamanho / 3)) }}
      aria-hidden="true"
    >
      {iniciais(nome)}
    </span>
  )
}

/** Menu ou painel flutuante: fecha com Esc e com clique fora dele. */
export function useFlutuante<T extends HTMLElement = HTMLDivElement>() {
  const [aberto, setAberto] = useState(false)
  const raiz = useRef<T>(null)
  useEffect(() => {
    if (!aberto) return
    const fora = (e: PointerEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false)
    }
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAberto(false)
    }
    document.addEventListener('pointerdown', fora)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('pointerdown', fora)
      document.removeEventListener('keydown', tecla)
    }
  }, [aberto])
  return { aberto, setAberto, raiz }
}

export function Mensagem({
  tipo,
  children,
}: {
  tipo: 'erro' | 'sucesso' | 'info'
  children: ReactNode
}) {
  const classe = { erro: s.mensagemErro, sucesso: s.mensagemSucesso, info: s.mensagemInfo }[tipo]
  return (
    <p role={tipo === 'erro' ? 'alert' : 'status'} className={[s.mensagem, classe].join(' ')}>
      {children}
    </p>
  )
}

export function Vazio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className={s.vazio}>
      <strong>{titulo}</strong>
      {children}
    </div>
  )
}

/** Diálogo modal nativo (<dialog>): foco preso, Esc fecha, backdrop do navegador. */
export function Modal({
  aberto,
  aoFechar,
  titulo,
  descricao,
  children,
  rodape,
}: {
  aberto: boolean
  aoFechar: () => void
  titulo: string
  descricao?: string
  children: ReactNode
  rodape?: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const idTitulo = useId()
  useEffect(() => {
    const dialogo = ref.current
    if (!dialogo) return
    if (aberto && !dialogo.open) dialogo.showModal()
    if (!aberto && dialogo.open) dialogo.close()
  }, [aberto])
  return (
    <dialog ref={ref} className={s.modal} onClose={aoFechar} aria-labelledby={idTitulo}>
      <div className={s.modalCabecalho}>
        <div>
          <h2 id={idTitulo}>{titulo}</h2>
          {descricao ? (
            <p style={{ color: 'var(--texto-suave)', marginTop: 4 }}>{descricao}</p>
          ) : null}
        </div>
        <button type="button" className={s.fechar} onClick={aoFechar} aria-label="Fechar">
          <X size={16} aria-hidden />
        </button>
      </div>
      <div className={s.modalCorpo}>{children}</div>
      {rodape ? <div className={s.modalRodape}>{rodape}</div> : null}
    </dialog>
  )
}
