'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { Botao, Campo, Mensagem, Modal, Selecao } from '@/componentes/ui'
import { linkDoWhatsapp } from '@/lib/agenda'
import { dataLonga, hora, minutosEmTexto, reais } from '@/lib/formato'
import { api, ErroDaApi } from '@/lib/supabase'
import s from './agenda.module.css'
import type { ContextoDaAgenda, ServicoDoBalcao } from './tipos'

// Figma Admin 02d–02h: novo agendamento pela equipe. Entra Confirmado (sem "Status inicial":
// o agendamento é instantâneo, backlog 02g) e o pagamento é combinado na barbearia.

const PASSOS = ['Cliente', 'Serviços', 'Horário', 'Revisão'] as const

interface ClienteConhecido {
  id: string
  nome: string
  celular: string | null
  visitas: number
}

interface Horarios {
  duracaoMin: number
  valorBrutoCentavos: number
  barbeiros: { barbeiroId: string; nome: string; inicios: string[] }[]
}

export function NovoAgendamento({
  contexto,
  servicos,
  dataInicial,
}: {
  contexto: ContextoDaAgenda
  servicos: ServicoDoBalcao[]
  dataInicial: string
}) {
  const router = useRouter()
  const { fuso } = contexto
  const [aberto, setAberto] = useState(false)
  const [passo, setPasso] = useState(0)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const [termo, setTermo] = useState('')
  const [encontrados, setEncontrados] = useState<ClienteConhecido[] | null>(null)
  const [conhecido, setConhecido] = useState<ClienteConhecido | null>(null)
  const [novo, setNovo] = useState(false)
  const [nome, setNome] = useState('')
  const [celular, setCelular] = useState('')
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [escolhidos, setEscolhidos] = useState<string[]>([])
  const [data, setData] = useState(dataInicial)
  const [barbeiro, setBarbeiro] = useState('')
  const [horarios, setHorarios] = useState<Horarios | null>(null)
  const [vaga, setVaga] = useState<{ barbeiroId: string; inicio: string } | null>(null)
  const [observacoes, setObservacoes] = useState('')
  const [feito, setFeito] = useState<{ codigo: string } | null>(null)

  const celularLimpo = celular.replace(/\D/g, '')
  const clienteOk = novo
    ? nome.trim().length >= 2 && (celularLimpo === '' || celularLimpo.length >= 10)
    : conhecido !== null
  const nomeDoCliente = novo ? nome.trim() : (conhecido?.nome ?? '')
  const celularDoCliente = novo ? celularLimpo || null : (conhecido?.celular ?? null)
  const selecionados = servicos.filter((x) => escolhidos.includes(x.id))
  const total = selecionados.reduce((t, x) => t + x.precoCentavos, 0)
  const duracao = selecionados.reduce((t, x) => t + x.duracaoMin, 0)
  const nomeDoBarbeiro = (id: string) =>
    contexto.barbeiros.find((b) => b.id === id)?.nome ?? 'Barbeiro'

  function fechar() {
    setAberto(false)
    setPasso(0)
    setErro(null)
    setTermo('')
    setEncontrados(null)
    setConhecido(null)
    setNovo(false)
    setNome('')
    setCelular('')
    setEscolhidos([])
    setData(dataInicial)
    setBarbeiro('')
    setHorarios(null)
    setVaga(null)
    setObservacoes('')
    if (feito) router.refresh()
    setFeito(null)
  }

  function buscarClientes(texto: string) {
    setTermo(texto)
    setConhecido(null)
    if (espera.current) clearTimeout(espera.current)
    if (texto.trim().length < 2) {
      setEncontrados(null)
      return
    }
    espera.current = setTimeout(async () => {
      try {
        setEncontrados(
          await api<ClienteConhecido[]>(
            `/api/barbearias/${contexto.barbeariaId}/clientes?termo=${encodeURIComponent(texto.trim())}`,
          ),
        )
      } catch {
        setEncontrados([])
      }
    }, 250)
  }

  async function buscarHorarios(dia: string, quem: string) {
    setHorarios(null)
    setVaga(null)
    setErro(null)
    try {
      const params = new URLSearchParams({ data: dia, servicos: escolhidos.join(','), equipe: '1' })
      if (quem) params.set('barbeiro', quem)
      setHorarios(
        await api<Horarios>(
          `/api/barbearias/${contexto.barbeariaId}/disponibilidade?${params.toString()}`,
        ),
      )
    } catch (e) {
      setErro(e instanceof ErroDaApi ? e.message : 'Não foi possível buscar os horários.')
      setHorarios({ duracaoMin: 0, valorBrutoCentavos: 0, barbeiros: [] })
    }
  }

  async function avancar() {
    setErro(null)
    if (passo === 1) await buscarHorarios(data, barbeiro)
    setPasso(passo + 1)
  }

  async function confirmar() {
    if (!vaga) return
    setEnviando(true)
    setErro(null)
    try {
      const r = await api<{ agendamentoId: string; codigo: string }>('/api/agendamentos/balcao', {
        corpo: {
          barbeariaId: contexto.barbeariaId,
          cliente: novo
            ? { nome: nome.trim(), ...(celularLimpo ? { celular: celularLimpo } : {}) }
            : { id: conhecido?.id },
          servicoIds: escolhidos,
          barbeiroId: vaga.barbeiroId,
          inicio: vaga.inicio,
          ...(observacoes.trim() ? { observacoes: observacoes.trim() } : {}),
        },
      })
      setFeito({ codigo: r.codigo })
    } catch (e) {
      setErro(e instanceof ErroDaApi ? e.message : 'Não foi possível agendar.')
    } finally {
      setEnviando(false)
    }
  }

  const podeAvancar =
    (passo === 0 && clienteOk) || (passo === 1 && escolhidos.length > 0) || (passo === 2 && vaga)
  const quando = vaga ? `${dataLonga(vaga.inicio, fuso)}, ${hora(vaga.inicio, fuso)}` : ''

  let corpo
  if (feito) {
    const whatsapp = linkDoWhatsapp(
      celularDoCliente,
      `Olá, ${nomeDoCliente.split(' ')[0]}! Seu horário na ${contexto.barbeariaNome} está confirmado para ${quando}, com ${vaga ? nomeDoBarbeiro(vaga.barbeiroId) : ''}. Código ${feito.codigo}.`,
    )
    corpo = (
      <>
        <Mensagem tipo="sucesso">
          Agendamento {feito.codigo} confirmado para {nomeDoCliente}, {quando}.
        </Mensagem>
        {whatsapp ? (
          <p>
            <a href={whatsapp} target="_blank" rel="noreferrer">
              Enviar a confirmação pelo WhatsApp
            </a>
          </p>
        ) : null}
      </>
    )
  } else if (passo === 0) {
    corpo = novo ? (
      <div className={s.formulario}>
        <Campo
          rotulo="Nome do cliente"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          autoFocus
        />
        <Campo
          rotulo="Celular (opcional)"
          inputMode="tel"
          value={celular}
          onChange={(e) => setCelular(e.target.value)}
          ajuda="Com DDD. Serve para avisar pelo WhatsApp."
          erro={
            celularLimpo !== '' && celularLimpo.length < 10 ? 'Celular com DDD, só números' : null
          }
        />
        <Botao variante="fantasma" onClick={() => setNovo(false)}>
          Buscar um cliente que já veio
        </Botao>
      </div>
    ) : (
      <div className={s.formulario}>
        <Campo
          rotulo="Buscar cliente"
          placeholder="Nome ou celular"
          value={termo}
          onChange={(e) => buscarClientes(e.target.value)}
          autoFocus
        />
        {encontrados && encontrados.length > 0 ? (
          <fieldset className={s.lista}>
            <legend className="so-leitor">Clientes encontrados</legend>
            {encontrados.map((c) => (
              <label key={c.id} className={s.opcao}>
                <input
                  type="radio"
                  name="cliente"
                  checked={conhecido?.id === c.id}
                  onChange={() => setConhecido(c)}
                />
                <span>
                  <strong>{c.nome}</strong>
                  <span className={s.suave}>
                    {c.celular ?? 'Sem celular'} · {c.visitas} visita{c.visitas === 1 ? '' : 's'}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        ) : encontrados ? (
          <p className={s.suave}>Nenhum cliente com esse nome ou celular.</p>
        ) : null}
        <Botao
          variante="secundario"
          onClick={() => {
            setNovo(true)
            if (!nome && termo && !/\d/.test(termo)) setNome(termo)
          }}
        >
          Cadastrar cliente novo
        </Botao>
      </div>
    )
  } else if (passo === 1) {
    corpo = (
      <fieldset className={s.lista}>
        <legend className="so-leitor">Serviços</legend>
        {servicos.map((x) => (
          <label key={x.id} className={s.opcao}>
            <input
              type="checkbox"
              checked={escolhidos.includes(x.id)}
              onChange={(e) =>
                setEscolhidos(
                  e.target.checked ? [...escolhidos, x.id] : escolhidos.filter((id) => id !== x.id),
                )
              }
            />
            <span>
              <strong>{x.nome}</strong>
              <span className={s.suave}>
                {minutosEmTexto(x.duracaoMin)} · {reais(x.precoCentavos)}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
    )
  } else if (passo === 2) {
    corpo = (
      <>
        <div className={s.duasColunas}>
          <label className={s.campoData}>
            <span>Data</span>
            <input
              type="date"
              min={contexto.hoje}
              value={data}
              onChange={(e) => {
                setData(e.target.value)
                if (e.target.value) void buscarHorarios(e.target.value, barbeiro)
              }}
            />
          </label>
          <Selecao
            rotulo="Barbeiro"
            value={barbeiro}
            onChange={(e) => {
              setBarbeiro(e.target.value)
              void buscarHorarios(data, e.target.value)
            }}
          >
            <option value="">Qualquer barbeiro</option>
            {contexto.barbeiros.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nome}
              </option>
            ))}
          </Selecao>
        </div>
        {horarios === null ? (
          <p className={s.suave}>Buscando horários…</p>
        ) : horarios.barbeiros.every((b) => b.inicios.length === 0) ? (
          <p className={s.suave}>
            Nenhum horário livre nesse dia para {minutosEmTexto(duracao)} de atendimento. Tente
            outra data ou outro barbeiro.
          </p>
        ) : (
          horarios.barbeiros
            .filter((b) => b.inicios.length > 0)
            .map((b) => (
              <fieldset key={b.barbeiroId} className={s.horarios}>
                <legend>{b.nome}</legend>
                <div className={s.grupoHorarios}>
                  {b.inicios.map((inicio) => (
                    <button
                      key={inicio}
                      type="button"
                      className={s.horario}
                      aria-pressed={vaga?.barbeiroId === b.barbeiroId && vaga.inicio === inicio}
                      onClick={() => setVaga({ barbeiroId: b.barbeiroId, inicio })}
                    >
                      {hora(inicio, fuso)}
                    </button>
                  ))}
                </div>
              </fieldset>
            ))
        )}
      </>
    )
  } else {
    corpo = (
      <>
        <dl className={s.detalhes}>
          <div>
            <dt>Cliente</dt>
            <dd>
              {nomeDoCliente}
              {celularDoCliente ? ` · ${celularDoCliente}` : ''}
            </dd>
          </div>
          <div>
            <dt>Serviços</dt>
            <dd>
              {selecionados.map((x) => x.nome).join(', ')} · {minutosEmTexto(duracao)}
            </dd>
          </div>
          <div>
            <dt>Horário</dt>
            <dd>
              {quando} · {vaga ? nomeDoBarbeiro(vaga.barbeiroId) : ''}
            </dd>
          </div>
          <div>
            <dt>Valor</dt>
            <dd>{reais(total)}</dd>
          </div>
          <div>
            <dt>Pagamento</dt>
            <dd>Na barbearia, fora do app</dd>
          </div>
        </dl>
        <label className={s.campoTexto}>
          <span>Observações (opcional)</span>
          <textarea
            rows={2}
            maxLength={300}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
          />
        </label>
      </>
    )
  }

  return (
    <>
      <Botao onClick={() => setAberto(true)}>Novo agendamento +</Botao>
      {aberto ? (
        <Modal
          aberto
          aoFechar={fechar}
          titulo={feito ? 'Agendado' : 'Novo agendamento'}
          descricao={feito ? undefined : `Passo ${passo + 1} de 4 · ${PASSOS[passo]}`}
          rodape={
            feito ? (
              <Botao onClick={fechar}>Concluir</Botao>
            ) : (
              <>
                {passo > 0 ? (
                  <Botao
                    variante="secundario"
                    onClick={() => setPasso(passo - 1)}
                    disabled={enviando}
                  >
                    Voltar
                  </Botao>
                ) : (
                  <Botao variante="secundario" onClick={fechar}>
                    Cancelar
                  </Botao>
                )}
                {passo < 3 ? (
                  <Botao onClick={avancar} disabled={!podeAvancar}>
                    Continuar
                  </Botao>
                ) : (
                  <Botao onClick={confirmar} disabled={enviando}>
                    {enviando ? 'Agendando…' : 'Confirmar agendamento'}
                  </Botao>
                )}
              </>
            )
          }
        >
          {feito ? null : (
            <ol className={s.passos} aria-label="Etapas">
              {PASSOS.map((p, i) => (
                <li
                  key={p}
                  aria-current={i === passo ? 'step' : undefined}
                  className={i < passo ? s.passoFeito : undefined}
                >
                  {p}
                </li>
              ))}
            </ol>
          )}
          {corpo}
          {erro ? <Mensagem tipo="erro">{erro}</Mensagem> : null}
        </Modal>
      ) : null}
    </>
  )
}
