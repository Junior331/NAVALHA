'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { instanteLocal, partesLocais, type Desconto } from '@navalha/core'
import { Botao, Campo, Mensagem, Modal } from '@/componentes/ui'
import { somarDias } from '@/lib/agenda'
import { descreverPromocao, textoDoDesconto } from '@/lib/promocao'
import { supabaseNoNavegador } from '@/lib/supabase'
import s from './promocoes.module.css'

export interface PromocaoDoPainel {
  id: string
  nome: string
  descricao: string | null
  tipo: 'cupom' | 'automatica'
  codigo: string | null
  desconto: Desconto
  servicoIds: string[] | null
  diasSemana: number[] | null
  inicio: string
  fim: string
  limiteUsos: number | null
  umUsoPorCliente: boolean
  ativa: boolean
}

const DIAS = [
  { valor: 1, nome: 'Seg' },
  { valor: 2, nome: 'Ter' },
  { valor: 3, nome: 'Qua' },
  { valor: 4, nome: 'Qui' },
  { valor: 5, nome: 'Sex' },
  { valor: 6, nome: 'Sáb' },
  { valor: 0, nome: 'Dom' },
]

// Figma Admin 07 · Nova promoção, com prévia ao vivo de como o cliente vê. "Dias válidos" é
// regra aplicada no checkout, não só texto (backlog 07).
export function EditorDePromocao({
  barbeariaId,
  fuso,
  servicos,
  promocao,
}: {
  barbeariaId: string
  fuso: string
  servicos: { id: string; nome: string }[]
  promocao?: PromocaoDoPainel
}) {
  const router = useRouter()
  const hoje = partesLocais(new Date(), fuso).data
  const dataLocal = (iso: string) => partesLocais(new Date(iso), fuso).data
  const [aberto, setAberto] = useState(false)
  const [nome, setNome] = useState(promocao?.nome ?? '')
  const [tipo, setTipo] = useState<'cupom' | 'automatica'>(promocao?.tipo ?? 'cupom')
  const [codigo, setCodigo] = useState(promocao?.codigo ?? '')
  const [tipoDesconto, setTipoDesconto] = useState<'percentual' | 'fixo'>(
    promocao?.desconto.tipo ?? 'percentual',
  )
  const [valor, setValor] = useState(
    promocao
      ? promocao.desconto.tipo === 'percentual'
        ? String(promocao.desconto.pct)
        : (promocao.desconto.valor / 100).toFixed(2).replace('.', ',')
      : '10',
  )
  const [todos, setTodos] = useState(!promocao?.servicoIds)
  const [escolhidos, setEscolhidos] = useState<string[]>(promocao?.servicoIds ?? [])
  const [dias, setDias] = useState<number[]>(promocao?.diasSemana ?? [])
  const [inicio, setInicio] = useState(promocao ? dataLocal(promocao.inicio) : hoje)
  const [fim, setFim] = useState(promocao ? dataLocal(promocao.fim) : somarDias(hoje, 30))
  const [limite, setLimite] = useState(promocao?.limiteUsos ? String(promocao.limiteUsos) : '')
  const [umUso, setUmUso] = useState(promocao?.umUsoPorCliente ?? true)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const numero = Number(valor.replace(/\./g, '').replace(',', '.'))
  const desconto: Desconto =
    tipoDesconto === 'percentual'
      ? { tipo: 'percentual', pct: Math.round(numero) }
      : { tipo: 'fixo', valor: Math.round(numero * 100) }
  const codigoLimpo = codigo.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const fimDoDia = new Date(instanteLocal(somarDias(fim || hoje, 1), 0, fuso).getTime() - 1000)
  const nomesDosServicos = servicos.filter((x) => escolhidos.includes(x.id)).map((x) => x.nome)
  const descricao = descreverPromocao({
    desconto,
    servicos: todos ? 'todos' : nomesDosServicos,
    dias: dias.length ? dias : null,
    fim: fimDoDia,
    fuso,
  })

  const problema =
    nome.trim().length < 2
      ? 'Dê um nome à promoção'
      : tipo === 'cupom' && codigoLimpo.length < 3
        ? 'O código precisa de ao menos 3 letras ou números'
        : !(numero > 0) || (tipoDesconto === 'percentual' && numero > 100)
          ? 'Informe um desconto válido'
          : !todos && escolhidos.length === 0
            ? 'Escolha ao menos um serviço'
            : !inicio || !fim || fim < inicio
              ? 'O fim precisa ser depois do início'
              : limite && !(Number(limite) > 0)
                ? 'O limite de usos precisa ser maior que zero'
                : null

  function alternarDia(dia: number) {
    setDias(dias.includes(dia) ? dias.filter((d) => d !== dia) : [...dias, dia])
  }

  async function salvar() {
    if (problema) {
      setErro(problema)
      return
    }
    setSalvando(true)
    setErro(null)
    const linha = {
      barbearia_id: barbeariaId,
      nome: nome.trim(),
      descricao,
      tipo,
      codigo: tipo === 'cupom' ? codigoLimpo : null,
      desconto_tipo: desconto.tipo,
      desconto_valor: desconto.tipo === 'percentual' ? desconto.pct : desconto.valor,
      servico_ids: todos ? null : escolhidos,
      dias_semana: dias.length ? dias : null,
      inicio: instanteLocal(inicio, 0, fuso).toISOString(),
      fim: fimDoDia.toISOString(),
      limite_usos: limite ? Number(limite) : null,
      um_uso_por_cliente: umUso,
    }
    const tabela = supabaseNoNavegador().from('promocoes')
    const { error } = promocao
      ? await tabela.update(linha).eq('id', promocao.id)
      : await tabela.insert(linha)
    setSalvando(false)
    if (error) {
      setErro(
        error.code === '23505'
          ? 'Já existe um cupom com esse código nesta barbearia.'
          : 'Não foi possível salvar a promoção. Confira os campos.',
      )
      return
    }
    setAberto(false)
    router.refresh()
  }

  return (
    <>
      {promocao ? (
        <Botao variante="fantasma" onClick={() => setAberto(true)}>
          Editar
        </Botao>
      ) : (
        <Botao onClick={() => setAberto(true)}>Nova promoção +</Botao>
      )}
      {aberto ? (
        <Modal
          aberto
          aoFechar={() => setAberto(false)}
          titulo={promocao ? 'Editar promoção' : 'Nova promoção'}
          rodape={
            <>
              <Botao variante="secundario" onClick={() => setAberto(false)}>
                Cancelar
              </Botao>
              <Botao onClick={salvar} disabled={salvando}>
                {salvando ? 'Salvando…' : promocao ? 'Salvar alterações' : 'Publicar promoção'}
              </Botao>
            </>
          }
        >
          <div className={s.previa} aria-label="Prévia para o cliente">
            <span className={s.selo}>
              {textoDoDesconto(desconto).replace(' de desconto', ' OFF')}
            </span>
            <strong>{nome.trim() || 'Nome da promoção'}</strong>
            <span>{descricao}</span>
            {tipo === 'cupom' ? (
              <span className={s.codigo}>Use o cupom {codigoLimpo || 'CODIGO'}</span>
            ) : (
              <span className={s.codigo}>Desconto aplicado sozinho no checkout</span>
            )}
          </div>

          <Campo rotulo="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />

          <fieldset className={s.grupo}>
            <legend>Como o cliente usa</legend>
            <label className={s.opcao}>
              <input
                type="radio"
                name="tipo"
                checked={tipo === 'cupom'}
                onChange={() => setTipo('cupom')}
              />
              Cupom com código
            </label>
            <label className={s.opcao}>
              <input
                type="radio"
                name="tipo"
                checked={tipo === 'automatica'}
                onChange={() => setTipo('automatica')}
              />
              Oferta automática, sem código
            </label>
          </fieldset>
          {tipo === 'cupom' ? (
            <Campo
              rotulo="Código do cupom"
              value={codigoLimpo}
              onChange={(e) => setCodigo(e.target.value)}
              ajuda="Letras e números, sem espaço. O cliente digita no checkout."
            />
          ) : null}

          <div className={s.linha}>
            <fieldset className={s.grupo}>
              <legend>Desconto</legend>
              <label className={s.opcao}>
                <input
                  type="radio"
                  name="desconto"
                  checked={tipoDesconto === 'percentual'}
                  onChange={() => setTipoDesconto('percentual')}
                />
                Porcentagem
              </label>
              <label className={s.opcao}>
                <input
                  type="radio"
                  name="desconto"
                  checked={tipoDesconto === 'fixo'}
                  onChange={() => setTipoDesconto('fixo')}
                />
                Valor fixo
              </label>
            </fieldset>
            <Campo
              rotulo={tipoDesconto === 'percentual' ? 'Desconto (%)' : 'Desconto (R$)'}
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </div>

          <fieldset className={s.grupo}>
            <legend>Serviços</legend>
            <label className={s.opcao}>
              <input type="checkbox" checked={todos} onChange={(e) => setTodos(e.target.checked)} />
              Todos os serviços
            </label>
            {todos ? null : (
              <div className={s.servicos}>
                {servicos.map((x) => (
                  <label key={x.id} className={s.opcao}>
                    <input
                      type="checkbox"
                      checked={escolhidos.includes(x.id)}
                      onChange={(e) =>
                        setEscolhidos(
                          e.target.checked
                            ? [...escolhidos, x.id]
                            : escolhidos.filter((id) => id !== x.id),
                        )
                      }
                    />
                    {x.nome}
                  </label>
                ))}
              </div>
            )}
          </fieldset>

          <fieldset className={s.grupo}>
            <legend>Dias válidos</legend>
            <div className={s.dias} role="group" aria-label="Dias da semana">
              {DIAS.map((d) => (
                <button
                  key={d.valor}
                  type="button"
                  aria-pressed={dias.includes(d.valor)}
                  onClick={() => alternarDia(d.valor)}
                >
                  {d.nome}
                </button>
              ))}
            </div>
            <span className={s.ajuda}>
              Nenhum marcado: vale todos os dias. O checkout só aplica nos dias marcados.
            </span>
          </fieldset>

          <div className={s.linha}>
            <Campo
              rotulo="Começa em"
              type="date"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
            />
            <Campo
              rotulo="Termina em"
              type="date"
              value={fim}
              onChange={(e) => setFim(e.target.value)}
            />
          </div>
          <div className={s.linha}>
            <Campo
              rotulo="Limite de usos (opcional)"
              inputMode="numeric"
              value={limite}
              onChange={(e) => setLimite(e.target.value.replace(/\D/g, ''))}
            />
            <label className={s.opcao} style={{ alignSelf: 'end', paddingBottom: 10 }}>
              <input type="checkbox" checked={umUso} onChange={(e) => setUmUso(e.target.checked)} />
              Um uso por cliente
            </label>
          </div>
          {inicio > hoje && !promocao ? (
            <Mensagem tipo="info">
              A promoção fica agendada e começa a valer em {inicio.split('-').reverse().join('/')}.
            </Mensagem>
          ) : null}
          {erro ? <Mensagem tipo="erro">{erro}</Mensagem> : null}
        </Modal>
      ) : null}
    </>
  )
}

/** Pausar e retomar sem apagar (backlog 07b: a agendada também pode ser pausada). */
export function AlternarPromocao({
  id,
  ativa,
  nome,
}: {
  id: string
  ativa: boolean
  nome: string
}) {
  const router = useRouter()
  const [enviando, setEnviando] = useState(false)
  async function alternar() {
    setEnviando(true)
    await supabaseNoNavegador().from('promocoes').update({ ativa: !ativa }).eq('id', id)
    setEnviando(false)
    router.refresh()
  }
  return (
    <Botao
      variante="fantasma"
      onClick={alternar}
      disabled={enviando}
      aria-label={`${ativa ? 'Pausar' : 'Retomar'} ${nome}`}
    >
      {ativa ? 'Pausar' : 'Retomar'}
    </Botao>
  )
}
