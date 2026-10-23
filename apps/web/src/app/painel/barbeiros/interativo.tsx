'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Botao, Campo, Mensagem, Modal } from '@/componentes/ui'
import t from '@/componentes/tabela.module.css'
import { api, ErroDaApi } from '@/lib/supabase'
import m from './menu.module.css'

interface Convite {
  token: string
  expiraEm: string
  link: string
}

// Figma Admin 04 → 04b → 04c: formulário, link gerado, link copiado.
export function ConvidarBarbeiro({
  barbeariaId,
  servicos,
}: {
  barbeariaId: string
  servicos: { id: string; nome: string }[]
}) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [nome, setNome] = useState('')
  const [contato, setContato] = useState('')
  const [escolhidos, setEscolhidos] = useState<string[]>([])
  const [convite, setConvite] = useState<Convite | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  function recomecar() {
    setConvite(null)
    setCopiado(false)
    setErro(null)
  }

  function fechar() {
    setAberto(false)
    setNome('')
    setContato('')
    setEscolhidos([])
    recomecar()
    router.refresh()
  }

  async function gerar() {
    setEnviando(true)
    setErro(null)
    try {
      setConvite(
        await api<Convite>('/api/convites', {
          corpo: { barbeariaId, nome, servicoIds: escolhidos, ...(contato ? { contato } : {}) },
        }),
      )
    } catch (e) {
      setErro(e instanceof ErroDaApi ? e.message : 'Não foi possível gerar o convite.')
    } finally {
      setEnviando(false)
    }
  }

  async function copiar() {
    if (!convite) return
    await navigator.clipboard.writeText(convite.link)
    setCopiado(true)
  }

  const mensagem = convite
    ? `Oi, ${nome}! Este é o seu convite para entrar na equipe pelo Navalha: ${convite.link}`
    : ''
  const digitos = contato.replace(/\D/g, '')
  const whatsapp = `https://wa.me/${digitos.length >= 10 ? `55${digitos.replace(/^55/, '')}` : ''}?text=${encodeURIComponent(mensagem)}`
  const email = `mailto:${contato.includes('@') ? contato : ''}?subject=${encodeURIComponent('Convite para a equipe')}&body=${encodeURIComponent(mensagem)}`

  return (
    <>
      <Botao onClick={() => setAberto(true)}>Convidar barbeiro +</Botao>
      <Modal
        aberto={aberto}
        aoFechar={fechar}
        titulo={convite ? 'Convite criado' : 'Convidar barbeiro'}
        descricao={
          convite
            ? 'Compartilhe o link com a nova pessoa da equipe.'
            : 'Gere um link para a pessoa criar o próprio acesso.'
        }
        rodape={
          convite ? (
            <>
              <Botao variante="secundario" onClick={recomecar}>
                Gerar novo link
              </Botao>
              <Botao onClick={fechar}>Concluir</Botao>
            </>
          ) : (
            <>
              <Botao variante="secundario" onClick={fechar}>
                Cancelar
              </Botao>
              <Botao onClick={gerar} disabled={enviando || nome.trim().length < 2}>
                {enviando ? 'Gerando…' : 'Gerar link'}
              </Botao>
            </>
          )
        }
      >
        {convite ? (
          <>
            <Mensagem tipo="sucesso">
              Link gerado para {nome} · Barbeiro · {escolhidos.length} serviço
              {escolhidos.length === 1 ? '' : 's'} · vale por 7 dias
            </Mensagem>
            <div>
              <p className="rotulo">Link de convite</p>
              <div className={t.linhaLink}>
                <span style={{ flex: 1 }}>{convite.link}</span>
                <Botao variante="secundario" onClick={copiar}>
                  {copiado ? 'Copiado ✓' : 'Copiar'}
                </Botao>
              </div>
              {copiado ? (
                <p role="status" style={{ color: 'var(--sucesso)', fontSize: 13, marginTop: 6 }}>
                  Link copiado para a área de transferência.
                </p>
              ) : null}
            </div>
            <div>
              <p className="rotulo">Enviar por</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <a className={m.acaoLink} href={whatsapp} target="_blank" rel="noreferrer">
                  WhatsApp
                </a>
                <a className={m.acaoLink} href={email}>
                  E-mail
                </a>
              </div>
            </div>
            <p style={{ color: 'var(--texto-suave)', fontSize: 13 }}>
              Expira em{' '}
              {new Date(convite.expiraEm).toLocaleString('pt-BR', {
                day: '2-digit',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              · uso único
            </p>
          </>
        ) : (
          <>
            <Campo rotulo="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
            <Campo
              rotulo="WhatsApp ou e-mail (opcional)"
              value={contato}
              onChange={(e) => setContato(e.target.value)}
            />
            <div>
              <p className="rotulo" style={{ marginBottom: 8 }}>
                Serviços que atende
              </p>
              <div className={t.chips}>
                {servicos.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={t.chip}
                    aria-pressed={escolhidos.includes(s.id)}
                    onClick={() =>
                      setEscolhidos((atual) =>
                        atual.includes(s.id) ? atual.filter((x) => x !== s.id) : [...atual, s.id],
                      )
                    }
                  >
                    {s.nome}
                  </button>
                ))}
              </div>
            </div>
            {erro ? <Mensagem tipo="erro">{erro}</Mensagem> : null}
          </>
        )}
      </Modal>
    </>
  )
}

// Figma Admin 03c · menu da linha, com as confirmações do backlog.
export function AcoesDoBarbeiro({ membroId, nome }: { membroId: string; nome: string }) {
  const router = useRouter()
  const [acao, setAcao] = useState<'pausar' | 'remover' | null>(null)
  const [afetados, setAfetados] = useState<number | null>(null)
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [motivo, setMotivo] = useState('')
  const [resultado, setResultado] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function abrirRemocao() {
    setAcao('remover')
    setAfetados(null)
    try {
      const r = await api<{ quantidade: number }>(`/api/barbeiros/${membroId}/afetados`)
      setAfetados(r.quantidade)
    } catch {
      setAfetados(null)
    }
  }

  function fechar() {
    setAcao(null)
    setResultado(null)
    setErro(null)
    router.refresh()
  }

  async function executar() {
    setEnviando(true)
    setErro(null)
    try {
      if (acao === 'remover') {
        const r = await api<{ cancelados: number }>(`/api/barbeiros/${membroId}/remocao`, {
          corpo: {},
        })
        setResultado(
          `${nome} saiu da equipe. ${r.cancelados} agendamento(s) cancelado(s) com estorno integral.`,
        )
      } else {
        const r = await api<{ afetados: number }>(`/api/barbeiros/${membroId}/pausa`, {
          corpo: {
            inicio: new Date(inicio).toISOString(),
            fim: new Date(fim).toISOString(),
            ...(motivo ? { motivo } : {}),
          },
        })
        setResultado(
          r.afetados
            ? `Agenda pausada. ${r.afetados} agendamento(s) já marcados no período continuam: cancele ou remarque na agenda.`
            : 'Agenda pausada. Nenhum agendamento no período.',
        )
      }
    } catch (e) {
      setErro(e instanceof ErroDaApi ? e.message : 'Não foi possível concluir.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <details className={m.menu}>
        <summary aria-label={`Ações para ${nome}`}>⋯</summary>
        <div className={m.lista}>
          <Link href={`/painel/agenda?barbeiro=${membroId}`}>Ver agenda</Link>
          <button type="button" onClick={() => setAcao('pausar')}>
            Pausar agenda
          </button>
          <button type="button" className={m.perigo} onClick={abrirRemocao}>
            Remover da barbearia
          </button>
        </div>
      </details>
      <Modal
        aberto={acao !== null}
        aoFechar={fechar}
        titulo={acao === 'remover' ? `Remover ${nome} da barbearia?` : `Pausar a agenda de ${nome}`}
        {...(acao === 'pausar'
          ? { descricao: 'Ninguém consegue agendar com ele nesse período.' }
          : {})}
        rodape={
          resultado ? (
            <Botao onClick={fechar}>Fechar</Botao>
          ) : (
            <>
              <Botao variante="secundario" onClick={fechar}>
                Manter como está
              </Botao>
              <Botao
                variante={acao === 'remover' ? 'perigo' : 'primario'}
                onClick={executar}
                disabled={enviando || (acao === 'pausar' && (!inicio || !fim))}
              >
                {acao === 'remover' ? 'Remover da barbearia' : 'Pausar agenda'}
              </Botao>
            </>
          )
        }
      >
        {resultado ? (
          <Mensagem tipo="sucesso">{resultado}</Mensagem>
        ) : acao === 'remover' ? (
          <p>
            {afetados === null
              ? 'Conferindo os agendamentos futuros…'
              : afetados === 0
                ? `${nome} não tem agendamentos futuros.`
                : `${nome} tem ${afetados} agendamento(s) futuro(s). Eles serão cancelados pela barbearia, com estorno integral ao cliente, e os clientes serão avisados.`}
          </p>
        ) : (
          <>
            <Campo
              rotulo="Início"
              type="datetime-local"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
            />
            <Campo
              rotulo="Fim"
              type="datetime-local"
              value={fim}
              onChange={(e) => setFim(e.target.value)}
            />
            <Campo
              rotulo="Motivo (opcional)"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </>
        )}
        {erro ? <Mensagem tipo="erro">{erro}</Mensagem> : null}
      </Modal>
    </>
  )
}
