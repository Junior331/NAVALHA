'use client'

import { useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { partesLocais, type Liquidacao } from '@navalha/core'
import { Botao, Etiqueta, Mensagem, Modal, Selecao } from '@/componentes/ui'
import { linkDoWhatsapp } from '@/lib/agenda'
import { dataLonga, hora, reais } from '@/lib/formato'
import { STATUS } from '@/lib/status'
import { api, ErroDaApi } from '@/lib/supabase'
import s from './agenda.module.css'
import type { ContextoDaAgenda, EventoDaAgenda } from './tipos'

// Figma Admin 02b (evento), 02i (remarcar), 02j (cancelar) e a ação nova de no-show.

interface PreviaCancelamento {
  evento: string
  opcoes: Liquidacao[]
}

interface Horarios {
  barbeiros: { barbeiroId: string; nome: string; inicios: string[] }[]
}

type Tela =
  | { tipo: 'detalhe' }
  | { tipo: 'remarcar' }
  | { tipo: 'cancelar'; previa: Liquidacao | null }
  | { tipo: 'no_show'; previa: Liquidacao | null }
  | { tipo: 'feito'; titulo: string; texto: string; whatsapp: string | null }

// "Cliente não compareceu" não é motivo de cancelamento: no-show é outra ação (backlog 02j).
const MOTIVOS = [
  'Barbeiro indisponível',
  'Barbearia fechada no horário',
  'Pedido do cliente',
  'Outro motivo',
]

function linhaDoPagamento(e: EventoDaAgenda, fuso: string): string | null {
  if (e.pagoNoBalcao) return 'Na barbearia, fora do app'
  const p = e.pagamento
  if (!p) return e.valorPagoCentavos === 0 ? 'Sem cobrança (prêmio ou valor zero)' : null
  const cartao = `Cartão final ${p.cartaoFinal ?? '····'}`
  const captura = p.capturarEm
    ? ` · captura em ${dataLonga(p.capturarEm, fuso)}, ${hora(p.capturarEm, fuso)}`
    : ''
  switch (p.status) {
    case 'pix_aguardando':
      return 'Pix · aguardando pagamento'
    case 'pix_pago':
      return `Pix · pago ${reais(e.valorPagoCentavos)}`
    case 'tokenizado':
      return `${cartao} · reservado, a pré-autorizar na janela de 72h${captura}`
    case 'pre_autorizado':
      return `${cartao} · confirmado, ${reais(e.valorPagoCentavos)} a capturar${captura}`
    case 'recusado':
      return `${cartao} · recusado, aguardando o cliente regularizar`
    case 'capturado':
      return `${cartao} · cobrado ${reais(e.valorPagoCentavos)}`
    case 'pre_autorizacao_cancelada':
      return `${cartao} · pré-autorização liberada, nada cobrado`
    case 'estornado_parcial':
      return `${p.meio === 'pix' ? 'Pix' : cartao} · devolvido em parte`
    case 'estornado':
      return `${p.meio === 'pix' ? 'Pix' : cartao} · devolvido`
    default:
      return null
  }
}

export function DetalheDoEvento({
  evento,
  contexto,
  verPagamento,
  aoFechar,
}: {
  evento: EventoDaAgenda
  contexto: ContextoDaAgenda
  verPagamento: boolean
  aoFechar: () => void
}) {
  const router = useRouter()
  const { fuso } = contexto
  const [tela, setTela] = useState<Tela>({ tipo: 'detalhe' })
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [mudou, setMudou] = useState(false)

  const [dataNova, setDataNova] = useState(partesLocais(new Date(evento.inicio), fuso).data)
  const [barbeiroNovo, setBarbeiroNovo] = useState(evento.barbeiroId)
  const [horarios, setHorarios] = useState<string[] | null>(null)
  const [escolhido, setEscolhido] = useState<string | null>(null)
  const [motivo, setMotivo] = useState(MOTIVOS[0] ?? '')

  const agora = new Date(contexto.agora).getTime()
  const inicio = new Date(evento.inicio).getTime()
  const ativo = evento.status === 'reservado' || evento.status === 'confirmado'
  const podeIniciar = evento.status === 'confirmado' && agora >= inicio - 30 * 60_000
  const podeConcluir = evento.status === 'em_atendimento'
  const podeNoShow =
    evento.status === 'confirmado' && agora > new Date(evento.toleranciaAte).getTime()
  const nomeDoBarbeiro =
    contexto.barbeiros.find((b) => b.id === evento.barbeiroId)?.nome ?? 'Barbeiro'
  const quando = `${dataLonga(evento.inicio, fuso)}, ${hora(evento.inicio, fuso)}`
  const pagamento = verPagamento ? linhaDoPagamento(evento, fuso) : null
  const primeiroNome = evento.cliente.nome.split(' ')[0] ?? evento.cliente.nome

  function fechar() {
    if (mudou) router.refresh()
    aoFechar()
  }

  // Leituras (prévias) não travam os botões; só as ações marcam 'enviando'.
  async function carregar<T>(fn: () => Promise<T>): Promise<T | null> {
    setErro(null)
    try {
      return await fn()
    } catch (e) {
      setErro(e instanceof ErroDaApi ? e.message : 'Algo deu errado. Tente de novo.')
      return null
    }
  }

  async function agir<T>(fn: () => Promise<T>): Promise<T | null> {
    setEnviando(true)
    try {
      return await carregar(fn)
    } finally {
      setEnviando(false)
    }
  }

  async function buscarHorarios(data: string, barbeiro: string) {
    setHorarios(null)
    setEscolhido(null)
    setErro(null)
    try {
      const r = await api<Horarios>(
        `/api/agendamentos/${evento.id}/remarcacao?data=${data}&barbeiro=${barbeiro}`,
      )
      setHorarios(r.barbeiros.flatMap((b) => b.inicios))
    } catch (e) {
      setErro(e instanceof ErroDaApi ? e.message : 'Não foi possível buscar os horários.')
      setHorarios([])
    }
  }

  async function abrirRemarcar() {
    setTela({ tipo: 'remarcar' })
    await buscarHorarios(dataNova, barbeiroNovo)
  }

  async function remarcar() {
    if (!escolhido) return
    const ok = await agir(() =>
      api(`/api/agendamentos/${evento.id}/remarcacao`, {
        corpo: {
          inicio: escolhido,
          ...(barbeiroNovo !== evento.barbeiroId ? { barbeiroId: barbeiroNovo } : {}),
        },
      }),
    )
    if (!ok) return
    setMudou(true)
    const novo = `${dataLonga(escolhido, fuso)}, ${hora(escolhido, fuso)}`
    setTela({
      tipo: 'feito',
      titulo: 'Agendamento remarcado',
      texto: `Novo horário: ${novo}.${evento.cliente.temApp ? ' O cliente recebe o aviso no app.' : ''}`,
      whatsapp: linkDoWhatsapp(
        evento.cliente.celular,
        `Olá, ${primeiroNome}! Aqui é da ${contexto.barbeariaNome}. Seu horário foi remarcado para ${novo}. Qualquer dúvida, é só responder.`,
      ),
    })
  }

  async function abrirCancelar() {
    setTela({ tipo: 'cancelar', previa: null })
    const r = await carregar(() =>
      api<PreviaCancelamento>(`/api/agendamentos/${evento.id}/cancelamento`),
    )
    if (r) setTela({ tipo: 'cancelar', previa: r.opcoes[0] ?? null })
  }

  async function cancelar(previa: Liquidacao | null) {
    const ok = await agir(() =>
      api(`/api/agendamentos/${evento.id}/cancelamento`, { corpo: { motivo } }),
    )
    if (!ok) return
    setMudou(true)
    const devolvido = previa?.devolvidoAoCliente ?? 0
    setTela({
      tipo: 'feito',
      titulo: 'Agendamento cancelado',
      texto:
        devolvido > 0
          ? `O horário ficou livre e ${reais(devolvido)} voltam para o cliente.`
          : 'O horário ficou livre na agenda.',
      whatsapp: linkDoWhatsapp(
        evento.cliente.celular,
        `Olá, ${primeiroNome}! Aqui é da ${contexto.barbeariaNome}. Precisamos cancelar seu horário de ${quando}.${devolvido > 0 ? ` Os ${reais(devolvido)} que você pagou voltam integralmente para você.` : ''} Desculpe o transtorno; se quiser, é só marcar outro horário.`,
      ),
    })
  }

  async function abrirNoShow() {
    setTela({ tipo: 'no_show', previa: null })
    const r = await carregar(() => api<Liquidacao>(`/api/agendamentos/${evento.id}/no-show`))
    if (r) setTela({ tipo: 'no_show', previa: r })
  }

  async function marcarNoShow() {
    const ok = await agir(() =>
      api(`/api/agendamentos/${evento.id}/no-show`, { metodo: 'POST', corpo: {} }),
    )
    if (!ok) return
    setMudou(true)
    setTela({
      tipo: 'feito',
      titulo: 'No-show registrado',
      texto: 'A retenção é aplicada na liquidação, em seguida.',
      whatsapp: null,
    })
  }

  async function mudarAtendimento(acao: 'iniciar' | 'concluir') {
    const ok = await agir(() =>
      api(`/api/agendamentos/${evento.id}/${acao}`, { metodo: 'POST', corpo: {} }),
    )
    if (!ok) return
    router.refresh()
    aoFechar()
  }

  const whatsappGeral = linkDoWhatsapp(
    evento.cliente.celular,
    `Olá, ${primeiroNome}! Aqui é da ${contexto.barbeariaNome}, sobre o seu horário de ${quando}.`,
  )

  const voltar = (
    <Botao variante="secundario" onClick={() => setTela({ tipo: 'detalhe' })} disabled={enviando}>
      Voltar
    </Botao>
  )

  let titulo = evento.cliente.nome
  let corpo: ReactNode
  let rodape: ReactNode

  if (tela.tipo === 'detalhe') {
    corpo = (
      <dl className={s.detalhes}>
        <div>
          <dt>Status</dt>
          <dd>
            <Etiqueta tom={STATUS[evento.status].tom}>{STATUS[evento.status].rotulo}</Etiqueta>
          </dd>
        </div>
        <div>
          <dt>Horário</dt>
          <dd>
            {quando} até {hora(evento.fim, fuso)}
          </dd>
        </div>
        <div>
          <dt>Serviço</dt>
          <dd>{evento.servicos.join(', ')}</dd>
        </div>
        <div>
          <dt>Barbeiro</dt>
          <dd>{nomeDoBarbeiro}</dd>
        </div>
        {pagamento ? (
          <div>
            <dt>Pagamento</dt>
            <dd>{pagamento}</dd>
          </div>
        ) : null}
        <div>
          <dt>Cliente</dt>
          <dd>
            {evento.cliente.celular ?? 'Sem celular'}
            {whatsappGeral ? (
              <>
                {' · '}
                <a href={whatsappGeral} target="_blank" rel="noreferrer">
                  Falar no WhatsApp
                </a>
              </>
            ) : null}
          </dd>
        </div>
        {evento.observacoes ? (
          <div>
            <dt>Observações</dt>
            <dd>{evento.observacoes}</dd>
          </div>
        ) : null}
      </dl>
    )
    rodape = (
      <>
        {ativo ? (
          <Botao variante="perigo" onClick={abrirCancelar} disabled={enviando}>
            Cancelar agendamento
          </Botao>
        ) : null}
        {podeNoShow ? (
          <Botao variante="secundario" onClick={abrirNoShow} disabled={enviando}>
            Marcar no-show
          </Botao>
        ) : null}
        {ativo ? (
          <Botao variante="secundario" onClick={abrirRemarcar} disabled={enviando}>
            Remarcar
          </Botao>
        ) : null}
        {podeIniciar ? (
          <Botao onClick={() => mudarAtendimento('iniciar')} disabled={enviando}>
            Iniciar atendimento
          </Botao>
        ) : null}
        {podeConcluir ? (
          <Botao onClick={() => mudarAtendimento('concluir')} disabled={enviando}>
            Concluir atendimento
          </Botao>
        ) : null}
        {!ativo && !podeConcluir ? <Botao onClick={fechar}>Fechar</Botao> : null}
      </>
    )
  } else if (tela.tipo === 'remarcar') {
    titulo = 'Remarcar'
    corpo = (
      <>
        <p className={s.resumo}>
          {evento.cliente.nome} · {evento.servicos.join(', ')} · horário atual: {quando}
        </p>
        <div className={s.duasColunas}>
          <label className={s.campoData}>
            <span>Nova data</span>
            <input
              type="date"
              min={contexto.hoje}
              value={dataNova}
              onChange={(e) => {
                setDataNova(e.target.value)
                if (e.target.value) void buscarHorarios(e.target.value, barbeiroNovo)
              }}
            />
          </label>
          <Selecao
            rotulo="Barbeiro"
            value={barbeiroNovo}
            onChange={(e) => {
              setBarbeiroNovo(e.target.value)
              void buscarHorarios(dataNova, e.target.value)
            }}
          >
            {contexto.barbeiros.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nome}
              </option>
            ))}
          </Selecao>
        </div>
        <fieldset className={s.horarios}>
          <legend>Horários livres</legend>
          {horarios === null ? (
            <p className={s.suave}>Buscando horários…</p>
          ) : horarios.length === 0 ? (
            <p className={s.suave}>Nenhum horário livre nesse dia. Tente outra data ou barbeiro.</p>
          ) : (
            <div className={s.grupoHorarios}>
              {horarios.map((h) => (
                <button
                  key={h}
                  type="button"
                  className={s.horario}
                  aria-pressed={escolhido === h}
                  onClick={() => setEscolhido(h)}
                >
                  {hora(h, fuso)}
                </button>
              ))}
            </div>
          )}
        </fieldset>
      </>
    )
    rodape = (
      <>
        {voltar}
        <Botao onClick={remarcar} disabled={enviando || !escolhido}>
          {enviando ? 'Remarcando…' : 'Confirmar remarcação'}
        </Botao>
      </>
    )
  } else if (tela.tipo === 'cancelar') {
    titulo = 'Cancelar agendamento'
    const previa = tela.previa
    corpo = (
      <>
        <p className={s.resumo}>
          {evento.cliente.nome} · {quando}
        </p>
        {previa === null ? (
          <p className={s.suave}>Calculando os valores…</p>
        ) : previa.devolvidoAoCliente > 0 || previa.custoGateway > 0 ? (
          <dl className={s.valores}>
            <div>
              <dt>O cliente recebe de volta</dt>
              <dd>{reais(previa.devolvidoAoCliente)} (100%)</dd>
            </div>
            {previa.quemPagaGateway === 'barbearia' && previa.custoGateway > 0 ? (
              <div>
                <dt>Custo do estorno</dt>
                <dd>{reais(previa.custoGateway)}, descontado da carteira da barbearia</dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <Mensagem tipo="info">
            Nada foi cobrado pelo app neste agendamento: não há valor a devolver.
          </Mensagem>
        )}
        <Selecao rotulo="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
          {MOTIVOS.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </Selecao>
        <p className={s.suave}>
          {evento.cliente.temApp ? 'O cliente recebe o aviso no app. ' : ''}Se o cliente não veio,
          use “Marcar no-show”, e não o cancelamento.
        </p>
      </>
    )
    rodape = (
      <>
        {voltar}
        <Botao
          variante="perigo"
          onClick={() => cancelar(previa)}
          disabled={enviando || previa === null}
        >
          {enviando ? 'Cancelando…' : 'Confirmar cancelamento'}
        </Botao>
      </>
    )
  } else if (tela.tipo === 'no_show') {
    titulo = 'Marcar no-show'
    const previa = tela.previa
    corpo = (
      <>
        <p className={s.resumo}>
          {evento.cliente.nome} não veio ao horário de {quando}.
        </p>
        {previa === null ? (
          <p className={s.suave}>Calculando os valores…</p>
        ) : previa.barbearia > 0 || previa.devolvidoAoCliente > 0 ? (
          <dl className={s.valores}>
            <div>
              <dt>Retenção da política</dt>
              <dd>{evento.retencaoPct}% do valor pago</dd>
            </div>
            <div>
              <dt>A barbearia recebe</dt>
              <dd>{reais(previa.barbearia)}</dd>
            </div>
            <div>
              <dt>Taxa da Navalha</dt>
              <dd>{reais(Math.max(0, previa.navalha))}</dd>
            </div>
            <div>
              <dt>O cliente recebe de volta</dt>
              <dd>{reais(previa.devolvidoAoCliente)}</dd>
            </div>
          </dl>
        ) : (
          <Mensagem tipo="info">
            Nada foi cobrado pelo app neste agendamento: o no-show fica só no histórico.
          </Mensagem>
        )}
      </>
    )
    rodape = (
      <>
        {voltar}
        <Botao variante="perigo" onClick={marcarNoShow} disabled={enviando || previa === null}>
          {enviando ? 'Registrando…' : 'Confirmar no-show'}
        </Botao>
      </>
    )
  } else {
    titulo = tela.titulo
    corpo = (
      <>
        <Mensagem tipo="sucesso">{tela.texto}</Mensagem>
        {tela.whatsapp ? (
          <p>
            Quer avisar também pelo WhatsApp?{' '}
            <a href={tela.whatsapp} target="_blank" rel="noreferrer">
              Abrir conversa com a mensagem pronta
            </a>
          </p>
        ) : null}
      </>
    )
    rodape = <Botao onClick={fechar}>Fechar</Botao>
  }

  return (
    <Modal
      aberto
      aoFechar={fechar}
      titulo={titulo}
      descricao={
        tela.tipo === 'detalhe' ? `${evento.codigo} · ${STATUS[evento.status].rotulo}` : undefined
      }
      rodape={rodape}
    >
      {corpo}
      {erro ? <Mensagem tipo="erro">{erro}</Mensagem> : null}
    </Modal>
  )
}
