import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import t from './tabela.module.css'

/** Página pedida na URL (?pagina=N), sempre a partir de 1. */
export function paginaDaUrl(valor: string | string[] | undefined): number {
  const n = Number(typeof valor === 'string' ? valor : 1)
  return Number.isInteger(n) && n > 0 ? n : 1
}

/**
 * Rodapé das tabelas longas: "Mostrando 21–40 de 132" e anterior/próxima. São links (funcionam
 * sem JavaScript e dá para voltar pelo navegador).
 */
export function Paginacao({
  pagina,
  porPagina,
  total,
  endereco,
  rotulo,
}: {
  pagina: number
  porPagina: number
  total: number
  endereco: (pagina: number) => string
  /** O que está sendo paginado, para o leitor de tela ("extrato", "clientes"). */
  rotulo: string
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina))
  const inicio = total === 0 ? 0 : (pagina - 1) * porPagina + 1
  const fim = Math.min(total, pagina * porPagina)
  return (
    <nav className={t.rodape} aria-label={`Páginas do ${rotulo}`}>
      <span>
        Mostrando {inicio}–{fim} de {total}
      </span>
      {paginas > 1 ? (
        <span className={t.paginas}>
          {pagina > 1 ? (
            <Link className={t.pagina} href={endereco(pagina - 1)}>
              <ChevronLeft size={14} aria-hidden /> Anterior
            </Link>
          ) : (
            <span className={t.pagina} aria-disabled="true">
              <ChevronLeft size={14} aria-hidden /> Anterior
            </span>
          )}
          <span>
            Página {Math.min(pagina, paginas)} de {paginas}
          </span>
          {pagina < paginas ? (
            <Link className={t.pagina} href={endereco(pagina + 1)}>
              Próxima <ChevronRight size={14} aria-hidden />
            </Link>
          ) : (
            <span className={t.pagina} aria-disabled="true">
              Próxima <ChevronRight size={14} aria-hidden />
            </span>
          )}
        </span>
      ) : null}
    </nav>
  )
}
