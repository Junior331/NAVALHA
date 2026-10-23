'use client'

import Link from 'next/link'
import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react'
import s from './ui.module.css'

type Variante = 'primario' | 'secundario' | 'perigo' | 'fantasma'

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

export function Etiqueta({ tom = 'neutro', children }: { tom?: Tom; children: ReactNode }) {
  return <span className={[s.etiqueta, s[tom]].join(' ')}>{children}</span>
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
  useEffect(() => {
    const dialogo = ref.current
    if (!dialogo) return
    if (aberto && !dialogo.open) dialogo.showModal()
    if (!aberto && dialogo.open) dialogo.close()
  }, [aberto])
  return (
    <dialog ref={ref} className={s.modal} onClose={aoFechar} aria-labelledby="modal-titulo">
      <div className={s.modalCabecalho}>
        <div>
          <h2 id="modal-titulo">{titulo}</h2>
          {descricao ? (
            <p style={{ color: 'var(--texto-suave)', marginTop: 4 }}>{descricao}</p>
          ) : null}
        </div>
        <button type="button" className={s.fechar} onClick={aoFechar} aria-label="Fechar">
          ×
        </button>
      </div>
      <div className={s.modalCorpo}>{children}</div>
      {rodape ? <div className={s.modalRodape}>{rodape}</div> : null}
    </dialog>
  )
}
