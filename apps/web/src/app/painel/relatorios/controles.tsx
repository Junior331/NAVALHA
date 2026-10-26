'use client'

import { CalendarDays, ChevronDown, Download, File, SlidersHorizontal } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useId, useState } from 'react'
import { Botao, Toast, useFlutuante } from '@/componentes/ui'
import {
  enderecoDoRelatorio,
  nomeDoArquivo,
  type ChaveDoPeriodo,
  type EstadoDoRelatorio,
} from '@/lib/relatorio'
import r from './relatorios.module.css'

// Controles do relatório (Figma Admin 08): período, comparação, filtros e exportação. Tudo vai
// para a URL, e a página (servidor) recalcula.

const ATALHOS: { chave: ChaveDoPeriodo; nome: string }[] = [
  { chave: 'hoje', nome: 'Hoje' },
  { chave: 'semana', nome: 'Semana' },
  { chave: 'mes', nome: 'Mês' },
  { chave: 'trimestre', nome: 'Trimestre' },
  { chave: 'ano', nome: 'Ano' },
]

export function PeriodoDoRelatorio({
  estado,
  rotulo,
}: {
  estado: EstadoDoRelatorio
  /** "01 – 07 out 2026" */
  rotulo: string
}) {
  const router = useRouter()
  const { aberto, setAberto, raiz } = useFlutuante()
  const idPainel = useId()
  const [de, setDe] = useState(estado.de)
  const [ate, setAte] = useState(estado.ate)

  return (
    <div className={r.periodo}>
      <div className={r.segmentos} role="group" aria-label="Período">
        {ATALHOS.map((a) => (
          <Link
            key={a.chave}
            href={enderecoDoRelatorio(estado, { periodo: a.chave })}
            aria-current={estado.periodo === a.chave ? 'page' : undefined}
          >
            {a.nome}
          </Link>
        ))}
      </div>
      <div ref={raiz} className={r.ancora}>
        <button
          type="button"
          className={r.botao}
          aria-expanded={aberto}
          aria-controls={aberto ? idPainel : undefined}
          onClick={() => {
            setDe(estado.de)
            setAte(estado.ate)
            setAberto(!aberto)
          }}
        >
          <CalendarDays size={17} strokeWidth={1.75} aria-hidden />
          {rotulo}
          <ChevronDown size={16} strokeWidth={1.75} aria-hidden />
        </button>
        {aberto ? (
          <div id={idPainel} className={`${r.flutuante} ${r.flutuanteEsquerda}`}>
            <strong className={r.flutuanteTitulo}>Escolher período</strong>
            <div className={r.datas}>
              <label>
                De
                <input type="date" value={de} max={ate} onChange={(e) => setDe(e.target.value)} />
              </label>
              <label>
                Até
                <input type="date" value={ate} min={de} onChange={(e) => setAte(e.target.value)} />
              </label>
            </div>
            <div className={r.rodapeFlutuante}>
              <Botao variante="secundario" onClick={() => setAberto(false)}>
                Cancelar
              </Botao>
              <Botao
                variante="secundario"
                disabled={!de || !ate}
                onClick={() => {
                  setAberto(false)
                  router.push(enderecoDoRelatorio(estado, { periodo: 'personalizado', de, ate }))
                }}
              >
                Aplicar
              </Botao>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function CompararComAnterior({ estado }: { estado: EstadoDoRelatorio }) {
  const router = useRouter()
  return (
    <div className={r.comparar}>
      <span id="rotulo-comparar">Comparar com período anterior</span>
      <button
        type="button"
        role="switch"
        className={r.chave}
        aria-checked={estado.comparar}
        aria-labelledby="rotulo-comparar"
        onClick={() => router.push(enderecoDoRelatorio(estado, { comparar: !estado.comparar }))}
      />
    </div>
  )
}

export function FiltrosDoRelatorio({
  estado,
  barbeiros,
  servicos,
}: {
  estado: EstadoDoRelatorio
  barbeiros: { id: string; nome: string }[]
  servicos: { id: string; nome: string }[]
}) {
  const router = useRouter()
  const { aberto, setAberto, raiz } = useFlutuante()
  const idPainel = useId()
  const idTitulo = useId()
  const [marcados, setMarcados] = useState({
    barbeiros: [] as string[],
    servicos: [] as string[],
    pagamentos: [] as string[],
  })
  const total = estado.barbeiros.length + estado.servicos.length + estado.pagamentos.length

  const grupos: {
    chave: keyof typeof marcados
    titulo: string
    opcoes: { id: string; nome: string }[]
  }[] = [
    { chave: 'barbeiros', titulo: 'Barbeiro', opcoes: barbeiros },
    { chave: 'servicos', titulo: 'Serviço', opcoes: servicos },
    {
      chave: 'pagamentos',
      titulo: 'Pagamento',
      opcoes: [
        { id: 'pix', nome: 'Pix' },
        { id: 'cartao', nome: 'Cartão' },
        { id: 'balcao', nome: 'Dinheiro (balcão)' },
      ],
    },
  ]

  function aplicar(novos: typeof marcados) {
    setAberto(false)
    router.push(enderecoDoRelatorio(estado, novos))
  }

  return (
    <div ref={raiz} className={r.ancora}>
      <button
        type="button"
        className={r.botao}
        aria-expanded={aberto}
        aria-controls={aberto ? idPainel : undefined}
        onClick={() => {
          setMarcados({
            barbeiros: estado.barbeiros,
            servicos: estado.servicos,
            pagamentos: estado.pagamentos,
          })
          setAberto(!aberto)
        }}
      >
        <SlidersHorizontal size={17} strokeWidth={1.75} aria-hidden />
        Filtros
        {total ? (
          <span className={r.contador}>
            {total}
            <span className="so-leitor"> marcados</span>
          </span>
        ) : null}
      </button>
      {aberto ? (
        <div
          id={idPainel}
          className={`${r.flutuante} ${r.filtros}`}
          role="dialog"
          aria-labelledby={idTitulo}
        >
          <div className={r.flutuanteTopo}>
            <h2 id={idTitulo} className={r.flutuanteTitulo}>
              Filtros
            </h2>
            <button
              type="button"
              className={r.limpar}
              onClick={() => setMarcados({ barbeiros: [], servicos: [], pagamentos: [] })}
            >
              Limpar
            </button>
          </div>
          {grupos.map((g) => (
            <fieldset key={g.chave} className={r.grupo}>
              <legend className="rotulo">{g.titulo}</legend>
              <div className={r.opcoes}>
                {g.opcoes.map((o) => (
                  <label key={o.id} className={r.opcao}>
                    <input
                      type="checkbox"
                      checked={marcados[g.chave].includes(o.id)}
                      onChange={(e) =>
                        setMarcados({
                          ...marcados,
                          [g.chave]: e.target.checked
                            ? [...marcados[g.chave], o.id]
                            : marcados[g.chave].filter((x) => x !== o.id),
                        })
                      }
                    />
                    {o.nome}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <div className={r.rodapeFlutuante}>
            <Botao
              variante="secundario"
              onClick={() => aplicar({ barbeiros: [], servicos: [], pagamentos: [] })}
            >
              Limpar
            </Botao>
            <Botao variante="secundario" onClick={() => aplicar(marcados)}>
              Aplicar filtros
            </Botao>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function ExportarCsv({
  estado,
  resumo,
  linhas,
}: {
  estado: EstadoDoRelatorio
  /** "01 a 07 de outubro · 84 atendimentos" */
  resumo: string
  linhas: { resumo: number; detalhado: number }
}) {
  const { aberto, setAberto, raiz } = useFlutuante()
  const idPainel = useId()
  const idTitulo = useId()
  const [conteudo, setConteudo] = useState<'resumo' | 'detalhado'>('resumo')
  const [separador, setSeparador] = useState<'virgula' | 'ponto-e-virgula'>('virgula')
  const [baixando, setBaixando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [feito, setFeito] = useState<{ arquivo: string; detalhe: string } | null>(null)

  async function baixar() {
    setBaixando(true)
    setErro(null)
    try {
      const consulta = enderecoDoRelatorio(estado).split('?')[1] ?? ''
      const p = new URLSearchParams(consulta)
      p.set('conteudo', conteudo)
      p.set('separador', separador)
      const resposta = await fetch(`/painel/relatorios/csv?${p.toString()}`)
      if (!resposta.ok) throw new Error(String(resposta.status))
      const arquivo = nomeDoArquivo(estado.de, estado.ate)
      const url = URL.createObjectURL(await resposta.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = arquivo
      link.click()
      URL.revokeObjectURL(url)
      setAberto(false)
      const quantas = linhas[conteudo]
      setFeito({
        arquivo,
        detalhe: `${quantas} ${quantas === 1 ? 'linha' : 'linhas'} · ${conteudo === 'resumo' ? 'resumo por barbeiro' : 'detalhado por atendimento'}`,
      })
      setTimeout(() => setFeito(null), 6000)
    } catch {
      setErro('Não foi possível gerar o CSV. Tente de novo.')
    } finally {
      setBaixando(false)
    }
  }

  const opcoes = [
    {
      chave: 'resumo' as const,
      titulo: 'Resumo por barbeiro',
      texto: `${linhas.resumo} ${linhas.resumo === 1 ? 'linha' : 'linhas'} · produção, atendimentos e ticket médio`,
    },
    {
      chave: 'detalhado' as const,
      titulo: 'Detalhado por atendimento',
      texto: `${linhas.detalhado} ${linhas.detalhado === 1 ? 'linha' : 'linhas'} · data, cliente, serviço e valores`,
    },
  ]

  return (
    <div ref={raiz} className={r.ancora}>
      <button
        type="button"
        className={r.botao}
        aria-expanded={aberto}
        aria-controls={aberto ? idPainel : undefined}
        onClick={() => setAberto(!aberto)}
      >
        <Download size={17} strokeWidth={1.75} aria-hidden />
        Exportar CSV
      </button>
      {aberto ? (
        <div
          id={idPainel}
          className={`${r.flutuante} ${r.exportar}`}
          role="dialog"
          aria-labelledby={idTitulo}
        >
          <div>
            <h2 id={idTitulo} className={r.flutuanteTitulo}>
              Exportar relatório
            </h2>
            <p className={r.flutuanteSubtitulo}>{resumo}</p>
          </div>
          <fieldset className={r.grupo}>
            <legend className="rotulo">Conteúdo</legend>
            {opcoes.map((o) => (
              <label key={o.chave} className={r.cartaoOpcao}>
                <input
                  type="radio"
                  name="conteudo-csv"
                  checked={conteudo === o.chave}
                  onChange={() => setConteudo(o.chave)}
                />
                <span>
                  <strong>{o.titulo}</strong>
                  <span>{o.texto}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <fieldset className={r.grupo}>
            <legend className="rotulo">Separador</legend>
            <div className={r.separadores}>
              {(
                [
                  ['virgula', 'Vírgula ( , )'],
                  ['ponto-e-virgula', 'Ponto e vírgula ( ; )'],
                ] as const
              ).map(([chave, nome]) => (
                <button
                  key={chave}
                  type="button"
                  aria-pressed={separador === chave}
                  onClick={() => setSeparador(chave)}
                >
                  {nome}
                </button>
              ))}
            </div>
          </fieldset>
          {erro ? <p className={r.erro}>{erro}</p> : null}
          <div className={r.rodapeFlutuante}>
            <Botao variante="secundario" onClick={() => setAberto(false)} disabled={baixando}>
              Cancelar
            </Botao>
            <Botao variante="secundario" onClick={baixar} disabled={baixando}>
              {baixando ? 'Gerando…' : 'Baixar CSV'}
            </Botao>
          </div>
        </div>
      ) : null}
      {feito ? (
        <Toast titulo="CSV exportado" aoFechar={() => setFeito(null)}>
          <span className={r.arquivoExportado}>
            <File size={14} strokeWidth={1.75} aria-hidden />
            {feito.arquivo}
          </span>
          <span>{feito.detalhe}</span>
        </Toast>
      ) : null}
    </div>
  )
}
