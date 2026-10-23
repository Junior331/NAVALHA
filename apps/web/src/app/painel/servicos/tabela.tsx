'use client'

import { Plus } from 'lucide-react'
import { precoDoServico } from '@navalha/core'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { Botao, Campo, Etiqueta, Mensagem, Modal, Selecao, Vazio } from '@/componentes/ui'
import t from '@/componentes/tabela.module.css'
import { minutosEmTexto, reais } from '@/lib/formato'
import { supabaseNoNavegador } from '@/lib/supabase'

export interface LinhaServico {
  id: string
  nome: string
  categoria: string | null
  descricao: string | null
  duracao_min: number
  preco_centavos: number
  desconto_tipo: 'percentual' | 'fixo' | null
  desconto_valor: number | null
  ativo: boolean
  ordem: number
  barbeiros: string[]
  agendamentosFuturos: number
}

type FiltroStatus = 'todos' | 'ativos' | 'inativos'

const descontoDe = (l: Pick<LinhaServico, 'desconto_tipo' | 'desconto_valor'>) =>
  l.desconto_tipo === 'percentual'
    ? { tipo: 'percentual' as const, pct: l.desconto_valor ?? 0 }
    : l.desconto_tipo === 'fixo'
      ? { tipo: 'fixo' as const, valor: l.desconto_valor ?? 0 }
      : null

export function TabelaDeServicos({
  barbeariaId,
  podeEditar,
  servicos,
  equipe,
}: {
  barbeariaId: string
  podeEditar: boolean
  servicos: LinhaServico[]
  equipe: { id: string; nome: string }[]
}) {
  const router = useRouter()
  const [busca, setBusca] = useState('')
  const [status, setStatus] = useState<FiltroStatus>('todos')
  const [categorias, setCategorias] = useState<string[]>([])
  const [soDesconto, setSoDesconto] = useState(false)
  const [editando, setEditando] = useState<LinhaServico | 'novo' | null>(null)
  const [desativando, setDesativando] = useState<LinhaServico | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const todasCategorias = useMemo(
    () =>
      [...new Set(servicos.map((s) => s.categoria).filter((c): c is string => Boolean(c)))].sort(),
    [servicos],
  )
  const visiveis = servicos.filter(
    (s) =>
      s.nome.toLowerCase().includes(busca.trim().toLowerCase()) &&
      (status === 'todos' || (status === 'ativos' ? s.ativo : !s.ativo)) &&
      (categorias.length === 0 || (s.categoria && categorias.includes(s.categoria))) &&
      (!soDesconto || s.desconto_tipo !== null),
  )

  async function alternarAtivo(servico: LinhaServico, ativo: boolean) {
    setErro(null)
    const { error } = await supabaseNoNavegador()
      .from('servicos')
      .update({ ativo })
      .eq('id', servico.id)
    if (error) return setErro('Não foi possível alterar o serviço.')
    setDesativando(null)
    router.refresh()
  }

  return (
    <>
      <div className={t.envoltorio}>
        <div className={t.ferramentas}>
          <input
            className={t.busca}
            type="search"
            placeholder="Buscar serviço"
            aria-label="Buscar serviço"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <div className={t.chips} role="group" aria-label="Filtros">
            {(['todos', 'ativos', 'inativos'] as const).map((opcao) => (
              <button
                key={opcao}
                type="button"
                className={t.chip}
                aria-pressed={status === opcao}
                onClick={() => setStatus(opcao)}
              >
                {opcao === 'todos' ? 'Todos' : opcao === 'ativos' ? 'Ativos' : 'Inativos'}
              </button>
            ))}
            {todasCategorias.map((c) => (
              <button
                key={c}
                type="button"
                className={t.chip}
                aria-pressed={categorias.includes(c)}
                onClick={() =>
                  setCategorias((atual) =>
                    atual.includes(c) ? atual.filter((x) => x !== c) : [...atual, c],
                  )
                }
              >
                {c}
              </button>
            ))}
            <button
              type="button"
              className={t.chip}
              aria-pressed={soDesconto}
              onClick={() => setSoDesconto(!soDesconto)}
            >
              Com desconto
            </button>
          </div>
          {podeEditar ? (
            <Botao variante="secundario" onClick={() => setEditando('novo')}>
              Novo serviço
              <Plus size={18} strokeWidth={1.75} aria-hidden />
            </Botao>
          ) : null}
        </div>
        {erro ? (
          <div style={{ padding: 16 }}>
            <Mensagem tipo="erro">{erro}</Mensagem>
          </div>
        ) : null}
        {visiveis.length === 0 ? (
          <Vazio titulo="Nenhum serviço com esses filtros" />
        ) : (
          <table className={t.tabela}>
            <thead>
              <tr>
                <th scope="col">Serviço</th>
                <th scope="col">Categoria</th>
                <th scope="col">Duração</th>
                <th scope="col">Preço</th>
                <th scope="col">Desconto</th>
                <th scope="col">Ativo</th>
                <th scope="col">
                  <span className="so-leitor">Editar</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((s) => {
                const final = precoDoServico(s.preco_centavos, descontoDe(s))
                return (
                  <tr key={s.id} className={s.ativo ? undefined : t.inativo}>
                    <td>
                      <strong>{s.nome}</strong>
                      <span className={t.secundario}>
                        {s.ativo ? 'Aparece para os clientes' : 'Não aparece para os clientes'} ·{' '}
                        {s.barbeiros.length} {s.barbeiros.length === 1 ? 'barbeiro' : 'barbeiros'}
                      </span>
                    </td>
                    <td>{s.categoria ?? '—'}</td>
                    <td className={t.numero}>{minutosEmTexto(s.duracao_min)}</td>
                    <td className={t.numero}>
                      {final !== s.preco_centavos ? (
                        <>
                          {reais(final)}{' '}
                          <s style={{ color: 'var(--texto-suave)' }}>{reais(s.preco_centavos)}</s>
                        </>
                      ) : (
                        reais(s.preco_centavos)
                      )}
                    </td>
                    <td>
                      {s.desconto_tipo ? (
                        <Etiqueta tom="alerta">
                          {s.desconto_tipo === 'percentual'
                            ? `−${s.desconto_valor}%`
                            : `−${reais(s.desconto_valor ?? 0)}`}
                        </Etiqueta>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        role="switch"
                        className={t.chave}
                        aria-checked={s.ativo}
                        aria-label={`${s.ativo ? 'Desativar' : 'Ativar'} ${s.nome}`}
                        disabled={!podeEditar}
                        onClick={() => (s.ativo ? setDesativando(s) : alternarAtivo(s, true))}
                      />
                    </td>
                    <td>
                      {podeEditar ? (
                        <Botao variante="fantasma" onClick={() => setEditando(s)}>
                          Editar
                        </Botao>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        <div className={t.rodape}>
          <span>
            Mostrando {visiveis.length} de {servicos.length} serviços
          </span>
          <span>Serviços inativos não aparecem para os clientes</span>
        </div>
      </div>

      <Modal
        aberto={desativando !== null}
        aoFechar={() => setDesativando(null)}
        titulo={`Desativar ${desativando?.nome ?? ''}?`}
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setDesativando(null)}>
              Manter ativo
            </Botao>
            <Botao
              variante="perigo"
              onClick={() => desativando && alternarAtivo(desativando, false)}
            >
              Desativar
            </Botao>
          </>
        }
      >
        <p>
          Ele deixa de aparecer para os clientes na hora de agendar.
          {desativando?.agendamentosFuturos
            ? ` ${desativando.agendamentosFuturos === 1 ? 'O agendamento futuro continua mantido.' : `Os ${desativando.agendamentosFuturos} agendamentos futuros continuam mantidos.`}`
            : ''}
        </p>
        <p style={{ color: 'var(--texto-suave)' }}>Você pode reativar quando quiser.</p>
      </Modal>

      {editando ? (
        <FormularioDeServico
          barbeariaId={barbeariaId}
          servico={editando === 'novo' ? null : editando}
          equipe={equipe}
          categorias={todasCategorias}
          aoFechar={() => {
            setEditando(null)
            router.refresh()
          }}
        />
      ) : null}
    </>
  )
}

// Figma Admin 05c · Novo serviço: nome, categoria, duração, preço, desconto, quem realiza, ativo.
function FormularioDeServico({
  barbeariaId,
  servico,
  equipe,
  categorias,
  aoFechar,
}: {
  barbeariaId: string
  servico: LinhaServico | null
  equipe: { id: string; nome: string }[]
  categorias: string[]
  aoFechar: () => void
}) {
  const [nome, setNome] = useState(servico?.nome ?? '')
  const [categoria, setCategoria] = useState(servico?.categoria ?? categorias[0] ?? 'Cabelo')
  const [duracao, setDuracao] = useState(String(servico?.duracao_min ?? 30))
  const [preco, setPreco] = useState(
    servico ? (servico.preco_centavos / 100).toFixed(2).replace('.', ',') : '',
  )
  const [tipoDesconto, setTipoDesconto] = useState<'nenhum' | 'percentual' | 'fixo'>(
    servico?.desconto_tipo ?? 'nenhum',
  )
  const [desconto, setDesconto] = useState(
    servico?.desconto_valor
      ? servico.desconto_tipo === 'fixo'
        ? (servico.desconto_valor / 100).toFixed(2).replace('.', ',')
        : String(servico.desconto_valor)
      : '',
  )
  const [quem, setQuem] = useState<string[]>(servico?.barbeiros ?? equipe.map((e) => e.id))
  const [ativo, setAtivo] = useState(servico?.ativo ?? true)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const precoCentavos = Math.round(Number(preco.replace(/\./g, '').replace(',', '.')) * 100)
  const descontoNumero =
    tipoDesconto === 'fixo'
      ? Math.round(Number(desconto.replace(',', '.')) * 100)
      : Math.round(Number(desconto.replace(',', '.')))
  const descontoValido =
    tipoDesconto === 'nenhum' ||
    (descontoNumero > 0 && (tipoDesconto === 'fixo' || descontoNumero <= 100))
  const final =
    Number.isFinite(precoCentavos) && precoCentavos >= 0
      ? precoDoServico(
          precoCentavos,
          tipoDesconto === 'percentual'
            ? { tipo: 'percentual', pct: descontoNumero || 0 }
            : tipoDesconto === 'fixo'
              ? { tipo: 'fixo', valor: descontoNumero || 0 }
              : null,
        )
      : null

  async function salvar() {
    const minutos = Number(duracao)
    if (!nome.trim()) return setErro('Informe o nome do serviço.')
    if (!Number.isInteger(minutos) || minutos <= 0)
      return setErro('A duração precisa ser em minutos inteiros.')
    if (!Number.isFinite(precoCentavos) || precoCentavos < 0) return setErro('Preço inválido.')
    if (!descontoValido) return setErro('Desconto inválido.')
    setSalvando(true)
    setErro(null)
    const supabase = supabaseNoNavegador()
    const dados = {
      nome: nome.trim(),
      categoria: categoria.trim() || null,
      duracao_min: minutos,
      preco_centavos: precoCentavos,
      desconto_tipo: tipoDesconto === 'nenhum' ? null : tipoDesconto,
      desconto_valor: tipoDesconto === 'nenhum' ? null : descontoNumero,
      ativo,
    }
    const resposta = servico
      ? await supabase.from('servicos').update(dados).eq('id', servico.id).select('id').single()
      : await supabase
          .from('servicos')
          .insert({ ...dados, barbearia_id: barbeariaId })
          .select('id')
          .single()
    if (resposta.error || !resposta.data) {
      setSalvando(false)
      return setErro('Não foi possível salvar o serviço.')
    }
    const servicoId = resposta.data.id
    const antes = servico?.barbeiros ?? []
    const sair = antes.filter((id) => !quem.includes(id))
    const entrar = quem.filter((id) => !antes.includes(id))
    if (sair.length)
      await supabase
        .from('servico_barbeiro')
        .delete()
        .eq('servico_id', servicoId)
        .in('membro_id', sair)
    if (entrar.length) {
      await supabase.from('servico_barbeiro').insert(
        entrar.map((membro_id) => ({
          servico_id: servicoId,
          membro_id,
          barbearia_id: barbeariaId,
        })),
      )
    }
    setSalvando(false)
    aoFechar()
  }

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={servico ? 'Editar serviço' : 'Novo serviço'}
      descricao="Defina preço, desconto e quem realiza."
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar serviço'}
          </Botao>
        </>
      }
    >
      <Campo rotulo="Nome do serviço" value={nome} onChange={(e) => setNome(e.target.value)} />
      <Campo
        rotulo="Categoria"
        list="categorias"
        value={categoria}
        onChange={(e) => setCategoria(e.target.value)}
      />
      <datalist id="categorias">
        {['Cabelo', 'Barba', 'Combo', 'Estética', 'Química', ...categorias]
          .filter((c, i, a) => a.indexOf(c) === i)
          .map((c) => (
            <option key={c} value={c} />
          ))}
      </datalist>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Campo
          rotulo="Duração (min)"
          inputMode="numeric"
          value={duracao}
          onChange={(e) => setDuracao(e.target.value.replace(/\D/g, ''))}
        />
        <Campo
          rotulo="Preço (R$)"
          inputMode="decimal"
          value={preco}
          onChange={(e) => setPreco(e.target.value)}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Selecao
          rotulo="Desconto"
          value={tipoDesconto}
          onChange={(e) => setTipoDesconto(e.target.value as typeof tipoDesconto)}
        >
          <option value="nenhum">Sem desconto</option>
          <option value="percentual">Percentual (%)</option>
          <option value="fixo">Valor fixo (R$)</option>
        </Selecao>
        <Campo
          rotulo={tipoDesconto === 'fixo' ? 'Valor (R$)' : 'Percentual'}
          inputMode="decimal"
          disabled={tipoDesconto === 'nenhum'}
          value={desconto}
          onChange={(e) => setDesconto(e.target.value)}
        />
      </div>
      {final !== null && precoCentavos > 0 ? (
        <p className="mono" style={{ fontSize: 13, color: 'var(--texto-2)' }}>
          Preço final para o cliente: {reais(final)}
        </p>
      ) : null}
      <div>
        <p className="rotulo" style={{ marginBottom: 8 }}>
          Quem realiza
        </p>
        <div className={t.chips}>
          {equipe.map((e) => (
            <button
              key={e.id}
              type="button"
              className={t.chip}
              aria-pressed={quem.includes(e.id)}
              onClick={() =>
                setQuem((atual) =>
                  atual.includes(e.id) ? atual.filter((x) => x !== e.id) : [...atual, e.id],
                )
              }
            >
              {e.nome}
            </button>
          ))}
        </div>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          type="button"
          role="switch"
          className={t.chave}
          aria-checked={ativo}
          onClick={() => setAtivo(!ativo)}
          aria-label="Serviço ativo"
        />
        <span>
          <strong>Serviço ativo</strong>
          <span className={t.secundario}>Aparece para os clientes na hora de agendar.</span>
        </span>
      </label>
      {erro ? <Mensagem tipo="erro">{erro}</Mensagem> : null}
    </Modal>
  )
}
