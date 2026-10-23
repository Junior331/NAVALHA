'use client'

import { SlidersHorizontal } from 'lucide-react'
import { useId, useState } from 'react'
import { Avatar, Botao, useFlutuante } from '@/componentes/ui'
import s from './agenda.module.css'

// Figma Admin 02 · Filtros: status e barbeiros, com a contagem do período na tela. O número no
// botão é quantos itens estão desmarcados.

export function Filtros({
  ocultos,
  grupos,
  barbeiros,
  gruposVisiveis,
  barbeirosVisiveis,
  aoAplicar,
}: {
  ocultos: number
  grupos: { chave: string; rotulo: string; total: number }[]
  barbeiros: { id: string; nome: string; total: number }[]
  gruposVisiveis: string[] | null
  barbeirosVisiveis: string[] | null
  /** null = todos marcados */
  aoAplicar: (status: string[] | null, barbeiro: string[] | null) => void
}) {
  const { aberto, setAberto, raiz } = useFlutuante()
  const idPainel = useId()
  const idTitulo = useId()
  const [status, setStatus] = useState<string[]>([])
  const [equipe, setEquipe] = useState<string[]>([])

  function alternar() {
    if (!aberto) {
      setStatus(gruposVisiveis ?? grupos.map((g) => g.chave))
      setEquipe(barbeirosVisiveis ?? barbeiros.map((b) => b.id))
    }
    setAberto(!aberto)
  }

  function aplicar() {
    setAberto(false)
    aoAplicar(
      status.length === grupos.length
        ? null
        : grupos.map((g) => g.chave).filter((c) => status.includes(c)),
      equipe.length === barbeiros.length
        ? null
        : barbeiros.map((b) => b.id).filter((id) => equipe.includes(id)),
    )
  }

  const marcar = (lista: string[], valor: string, marcado: boolean) =>
    marcado ? [...lista, valor] : lista.filter((v) => v !== valor)

  return (
    <div ref={raiz} className={s.ancoraFiltros}>
      <button
        type="button"
        className={s.botaoBarra}
        onClick={alternar}
        aria-expanded={aberto}
        aria-controls={aberto ? idPainel : undefined}
      >
        <SlidersHorizontal size={17} strokeWidth={1.75} aria-hidden />
        Filtros
        {ocultos ? (
          <span className={s.contadorFiltros}>
            {ocultos}
            <span className="so-leitor"> desmarcados</span>
          </span>
        ) : null}
      </button>
      {aberto ? (
        <div id={idPainel} className={s.painelFiltros} role="dialog" aria-labelledby={idTitulo}>
          <div className={s.filtrosTopo}>
            <h2 id={idTitulo}>Filtros</h2>
            <button
              type="button"
              className={s.limpar}
              onClick={() => {
                setStatus(grupos.map((g) => g.chave))
                setEquipe(barbeiros.map((b) => b.id))
              }}
            >
              Limpar
            </button>
          </div>
          <fieldset className={s.filtrosGrupo}>
            <legend className="rotulo">Status</legend>
            {grupos.map((g) => (
              <label key={g.chave} className={s.filtroOpcao}>
                <input
                  type="checkbox"
                  checked={status.includes(g.chave)}
                  onChange={(e) => setStatus(marcar(status, g.chave, e.target.checked))}
                />
                <span className={s.pontoStatus} data-grupo={g.chave} aria-hidden="true" />
                <span className={s.filtroNome}>{g.rotulo}</span>
                <span className={s.filtroTotal}>{g.total}</span>
              </label>
            ))}
          </fieldset>
          <fieldset className={s.filtrosGrupo}>
            <legend className="rotulo">Barbeiro</legend>
            {barbeiros.map((b) => (
              <label key={b.id} className={s.filtroOpcao}>
                <input
                  type="checkbox"
                  checked={equipe.includes(b.id)}
                  onChange={(e) => setEquipe(marcar(equipe, b.id, e.target.checked))}
                />
                <Avatar nome={b.nome} tamanho={28} />
                <span className={s.filtroNome}>{b.nome}</span>
                <span className={s.filtroTotal}>{b.total}</span>
              </label>
            ))}
          </fieldset>
          <div className={s.filtrosRodape}>
            <Botao variante="secundario" onClick={() => setAberto(false)}>
              Cancelar
            </Botao>
            <Botao variante="secundario" onClick={aplicar}>
              Aplicar filtros
            </Botao>
          </div>
        </div>
      ) : null}
    </div>
  )
}
