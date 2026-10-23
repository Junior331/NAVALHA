'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { partesLocais, type ValorComDesconto } from '@navalha/core'
import type { PaginaDaBarbearia } from '@navalha/servidor'
import { Botao, Campo, Mensagem } from '@/componentes/ui'
import { somarDias } from '@/lib/agenda'
import { avulsoRepetido, comboMaisBarato } from '@/lib/combos'
import { dataLonga, hora, minutosEmTexto, reais } from '@/lib/formato'
import { api, ErroDaApi, supabaseNoNavegador } from '@/lib/supabase'
import f from './fluxo.module.css'

// Cliente 07 (serviços), 08 (profissional), 09 (data e hora), 10 (revisar e pagar) na web.
// Agendamento instantâneo: pagou (Pix) ou garantiu o cartão, está agendado (CLAUDE.md).

type Passo = 'servicos' | 'barbeiro' | 'horario' | 'dados' | 'pagamento'
const PASSOS: { id: Passo; nome: string }[] = [
  { id: 'servicos', nome: 'Serviços' },
  { id: 'barbeiro', nome: 'Profissional' },
  { id: 'horario', nome: 'Data e hora' },
  { id: 'dados', nome: 'Seus dados' },
  { id: 'pagamento', nome: 'Pagamento' },
]
const DIAS_A_FRENTE = 14

interface Disponibilidade {
  barbeiros: { barbeiroId: string; nome: string; inicios: string[] }[]
}

type Saida = { tipo: 'pix'; reservaId: string } | { tipo: 'agendado'; agendamentoId: string }

const soDigitos = (texto: string) => texto.replace(/\D/g, '')

export function FluxoDeAgendamento({
  pagina,
  servicosIniciais,
  hoje,
}: {
  pagina: PaginaDaBarbearia
  servicosIniciais: string[]
  hoje: string
}) {
  const router = useRouter()
  const { fuso, politica } = pagina
  const [passo, setPasso] = useState<Passo>(servicosIniciais.length ? 'barbeiro' : 'servicos')
  const [servicoIds, setServicoIds] = useState<string[]>(servicosIniciais)
  const [barbeiroId, setBarbeiroId] = useState('qualquer')
  const [dias, setDias] = useState<Record<string, string[]> | null>(null)
  const [data, setData] = useState<string | null>(null)
  const [inicio, setInicio] = useState<string | null>(null)

  const [nome, setNome] = useState('')
  const [celular, setCelular] = useState('')
  const [email, setEmail] = useState('')
  const [conhecido, setConhecido] = useState(false)
  const [tentouDados, setTentouDados] = useState(false)

  const [preco, setPreco] = useState<ValorComDesconto | null>(null)
  const [cupom, setCupom] = useState('')
  const [cupomAplicado, setCupomAplicado] = useState<string | null>(null)
  const [erroCupom, setErroCupom] = useState<string | null>(null)
  const [meio, setMeio] = useState<'pix' | 'cartao'>('pix')
  const [cartao, setCartao] = useState({
    numero: '',
    nomeImpresso: '',
    validade: '',
    cvv: '',
    cpf: '',
    cep: '',
    numeroEndereco: '',
  })

  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const selecionados = pagina.servicos.filter((s) => servicoIds.includes(s.id))
  const aptos = pagina.barbeiros.filter((b) =>
    selecionados.every((s) => s.barbeiroIds.includes(b.id)),
  )
  const totalTabela = selecionados.reduce((t, s) => t + s.precoCentavos, 0)
  const duracao = selecionados.reduce((t, s) => t + s.duracaoMin, 0)
  const repetido = avulsoRepetido(selecionados)
  const combo = comboMaisBarato(selecionados, pagina.servicos)
  const indice = PASSOS.findIndex((p) => p.id === passo)
  const nomeDoBarbeiro =
    barbeiroId === 'qualquer'
      ? 'Primeiro profissional livre'
      : (pagina.barbeiros.find((b) => b.id === barbeiroId)?.nome ?? 'Profissional')
  const cobrancaEm = inicio
    ? new Date(new Date(inicio).getTime() - politica.prazoGratisHoras * 3_600_000)
    : null

  function alternarServico(id: string, marcado: boolean) {
    setServicoIds(marcado ? [...servicoIds, id] : servicoIds.filter((x) => x !== id))
  }

  async function carregarDias(quem: string) {
    setDias(null)
    setData(null)
    setInicio(null)
    const datas = Array.from({ length: DIAS_A_FRENTE }, (_, i) => somarDias(hoje, i))
    const resultados = await Promise.all(
      datas.map(async (dia): Promise<[string, string[]]> => {
        const consulta = new URLSearchParams({ data: dia, servicos: servicoIds.join(',') })
        if (quem !== 'qualquer') consulta.set('barbeiro', quem)
        try {
          const resposta = await fetch(`/api/barbearias/${pagina.id}/disponibilidade?${consulta}`)
          if (!resposta.ok) return [dia, []]
          const disponivel = (await resposta.json()) as Disponibilidade
          return [dia, [...new Set(disponivel.barbeiros.flatMap((b) => b.inicios))].sort()]
        } catch {
          return [dia, []]
        }
      }),
    )
    const mapa = Object.fromEntries(resultados)
    setDias(mapa)
    setData(datas.find((dia) => (mapa[dia]?.length ?? 0) > 0) ?? datas[0] ?? null)
  }

  async function irParaHorarios() {
    setErro(null)
    setPasso('horario')
    await carregarDias(barbeiroId)
  }

  async function irParaDados() {
    setErro(null)
    const supabase = supabaseNoNavegador()
    const { data: sessao } = await supabase.auth.getSession()
    const usuarioId = sessao.session?.user.id
    if (usuarioId && !conhecido) {
      const { data: cliente } = await supabase
        .from('clientes')
        .select('nome, celular, email')
        .eq('usuario_id', usuarioId)
        .maybeSingle()
      if (cliente) {
        setNome(cliente.nome)
        setCelular(cliente.celular ?? '')
        setEmail(cliente.email ?? sessao.session?.user.email ?? '')
        setConhecido(true)
      }
    }
    setPasso('dados')
  }

  async function calcularPreco(codigo: string | null) {
    const valor = await api<ValorComDesconto>('/api/agendamentos/preco', {
      corpo: {
        barbeariaId: pagina.id,
        servicoIds,
        inicio,
        ...(codigo ? { cupom: codigo } : {}),
      },
    })
    setPreco(valor)
  }

  const errosDados = {
    nome: nome.trim().length >= 2 ? null : 'Informe seu nome',
    celular: [10, 11].includes(soDigitos(celular).length) ? null : 'Celular com DDD',
    email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) ? null : 'E-mail inválido',
  }

  async function confirmarDados(evento: FormEvent) {
    evento.preventDefault()
    setTentouDados(true)
    if (Object.values(errosDados).some(Boolean)) return
    setOcupado(true)
    setErro(null)
    try {
      // Cadastro leve: sem conta, entra como usuário anônimo e guarda nome, celular e e-mail.
      const supabase = supabaseNoNavegador()
      const { data: sessao } = await supabase.auth.getSession()
      if (!sessao.session) {
        const { error } = await supabase.auth.signInAnonymously()
        if (error) throw new Error('Não foi possível iniciar o agendamento. Tente de novo.')
      }
      await api('/api/clientes', {
        corpo: { nome: nome.trim(), celular: soDigitos(celular), email: email.trim() },
      })
      setCupomAplicado(null)
      await calcularPreco(null)
      setPasso('pagamento')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível continuar.')
    } finally {
      setOcupado(false)
    }
  }

  async function aplicarCupom() {
    const codigo = cupom.trim()
    if (!codigo) return
    setErroCupom(null)
    try {
      await calcularPreco(codigo)
      setCupomAplicado(codigo.toUpperCase())
    } catch (e) {
      setErroCupom(e instanceof ErroDaApi ? e.message : 'Não foi possível aplicar o cupom.')
    }
  }

  async function removerCupom() {
    setCupom('')
    setCupomAplicado(null)
    setErroCupom(null)
    await calcularPreco(null)
  }

  const errosCartao = {
    numero: soDigitos(cartao.numero).length >= 13 ? null : 'Número do cartão incompleto',
    nomeImpresso: cartao.nomeImpresso.trim().length >= 2 ? null : 'Nome como está no cartão',
    validade: /^\d{2}\/\d{2}$/.test(cartao.validade) ? null : 'Validade no formato MM/AA',
    cvv: /^\d{3,4}$/.test(cartao.cvv) ? null : 'CVV com 3 ou 4 números',
    cpf: [11, 14].includes(soDigitos(cartao.cpf).length) ? null : 'CPF do titular',
    cep: soDigitos(cartao.cep).length === 8 ? null : 'CEP com 8 números',
    numeroEndereco: cartao.numeroEndereco.trim() ? null : 'Número do endereço',
  }
  const [tentouCartao, setTentouCartao] = useState(false)

  async function pagar() {
    if (meio === 'cartao') {
      setTentouCartao(true)
      if (Object.values(errosCartao).some(Boolean)) return
    }
    setOcupado(true)
    setErro(null)
    try {
      const saida = await api<Saida>('/api/agendamentos', {
        corpo: {
          barbeariaId: pagina.id,
          servicoIds,
          barbeiroId,
          inicio,
          meio,
          origem: 'web',
          ...(cupomAplicado ? { cupom: cupomAplicado } : {}),
          ...(meio === 'cartao'
            ? {
                cartao: {
                  numero: soDigitos(cartao.numero),
                  nomeImpresso: cartao.nomeImpresso.trim(),
                  validade: cartao.validade,
                  cvv: cartao.cvv,
                },
                titular: {
                  nome: nome.trim(),
                  email: email.trim(),
                  cpfCnpj: soDigitos(cartao.cpf),
                  cep: soDigitos(cartao.cep),
                  numeroEndereco: cartao.numeroEndereco.trim(),
                  celular: soDigitos(celular),
                },
              }
            : {}),
        },
      })
      if (saida.tipo === 'pix') {
        try {
          sessionStorage.setItem(`navalha:pix:${saida.reservaId}`, JSON.stringify(saida))
        } catch {
          // Sem sessionStorage a tela do Pix busca de novo pelo servidor.
        }
        router.push(`/${pagina.slug}/agendamento/${saida.reservaId}`)
      } else {
        router.push(`/${pagina.slug}/agendamento/${saida.agendamentoId}`)
      }
    } catch (e) {
      if (e instanceof ErroDaApi && e.codigo === 'horario_indisponivel') {
        setErro(`${e.message}. Escolha outro horário.`)
        setPasso('horario')
        await carregarDias(barbeiroId)
        return
      }
      setErro(e instanceof ErroDaApi ? e.message : 'Não foi possível concluir. Tente de novo.')
    } finally {
      setOcupado(false)
    }
  }

  const voltar = () => {
    setErro(null)
    setPasso(PASSOS[Math.max(0, indice - 1)]?.id ?? 'servicos')
  }

  const resumo = (
    <div className={f.resumo}>
      <strong>{selecionados.map((s) => s.nome).join(' + ') || 'Nenhum serviço'}</strong>
      <span>
        {minutosEmTexto(duracao)} · {reais(totalTabela)}
      </span>
      {indice >= 2 ? <span>{nomeDoBarbeiro}</span> : null}
      {inicio ? (
        <span>
          {dataLonga(inicio, fuso)}, {hora(inicio, fuso)}
        </span>
      ) : null}
    </div>
  )

  return (
    <div className={f.pagina}>
      <header className={f.topo}>
        <Link href={`/${pagina.slug}`} className={f.voltarParaBarbearia}>
          ← {pagina.nome}
        </Link>
        <ol className={f.passos} aria-label="Etapas do agendamento">
          {PASSOS.map((p, i) => (
            <li
              key={p.id}
              aria-current={p.id === passo ? 'step' : undefined}
              className={i < indice ? f.feito : undefined}
            >
              {p.nome}
            </li>
          ))}
        </ol>
      </header>

      <main className={f.conteudo}>
        {passo === 'servicos' ? (
          <section className={f.secao} aria-labelledby="titulo-passo">
            <h1 id="titulo-passo">Escolha os serviços</h1>
            <ul className={f.lista}>
              {pagina.servicos.map((s) => (
                <li key={s.id}>
                  <label className={f.opcao}>
                    <input
                      type="checkbox"
                      checked={servicoIds.includes(s.id)}
                      onChange={(e) => alternarServico(s.id, e.target.checked)}
                    />
                    <span className={f.opcaoTexto}>
                      <strong>{s.nome}</strong>
                      <span>{minutosEmTexto(s.duracaoMin)}</span>
                    </span>
                    <span className={f.valor}>{reais(s.precoCentavos)}</span>
                  </label>
                </li>
              ))}
            </ul>
            {repetido ? (
              <Mensagem tipo="info">
                {repetido.combo.nome} já inclui {repetido.avulso.nome}.{' '}
                <button
                  type="button"
                  className={f.acaoTexto}
                  onClick={() => alternarServico(repetido.avulso.id, false)}
                >
                  Tirar {repetido.avulso.nome}
                </button>
              </Mensagem>
            ) : combo ? (
              <Mensagem tipo="info">
                Troque pelo combo {combo.combo.nome} e economize {reais(combo.economiaCentavos)}.{' '}
                <button
                  type="button"
                  className={f.acaoTexto}
                  onClick={() => setServicoIds([combo.combo.id])}
                >
                  Trocar pelo combo
                </button>
              </Mensagem>
            ) : null}
            {selecionados.length > 0 && aptos.length === 0 ? (
              <Mensagem tipo="erro">
                Nenhum profissional faz essa combinação. Tire algum serviço para continuar.
              </Mensagem>
            ) : null}
            <div className={f.acoes}>
              <Botao
                grande
                onClick={() => setPasso('barbeiro')}
                disabled={selecionados.length === 0 || aptos.length === 0 || Boolean(repetido)}
              >
                Continuar
              </Botao>
            </div>
          </section>
        ) : null}

        {passo === 'barbeiro' ? (
          <section className={f.secao} aria-labelledby="titulo-passo">
            <h1 id="titulo-passo">Com quem?</h1>
            {resumo}
            <fieldset className={f.lista}>
              <legend className="so-leitor">Profissional</legend>
              <label className={f.opcao}>
                <input
                  type="radio"
                  name="barbeiro"
                  checked={barbeiroId === 'qualquer'}
                  onChange={() => setBarbeiroId('qualquer')}
                />
                <span className={f.opcaoTexto}>
                  <strong>Primeiro profissional livre</strong>
                  <span>Mostra todos os horários da barbearia</span>
                </span>
              </label>
              {aptos.map((b) => (
                <label key={b.id} className={f.opcao}>
                  <input
                    type="radio"
                    name="barbeiro"
                    checked={barbeiroId === b.id}
                    onChange={() => setBarbeiroId(b.id)}
                  />
                  <span className={f.opcaoTexto}>
                    <strong>{b.nome}</strong>
                    <span>
                      {b.nota !== null
                        ? `★ ${b.nota.toLocaleString('pt-BR')} · ${b.avaliacoes} avaliações`
                        : 'Novo na equipe'}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
            <div className={f.acoes}>
              <Botao variante="secundario" onClick={voltar}>
                Voltar
              </Botao>
              <Botao grande onClick={irParaHorarios}>
                Ver horários
              </Botao>
            </div>
          </section>
        ) : null}

        {passo === 'horario' ? (
          <section className={f.secao} aria-labelledby="titulo-passo">
            <h1 id="titulo-passo">Escolha o dia e o horário</h1>
            {resumo}
            {erro ? <Mensagem tipo="erro">{erro}</Mensagem> : null}
            {dias === null ? (
              <p className={f.suave}>Buscando horários livres…</p>
            ) : (
              <>
                <div className={f.dias} role="group" aria-label="Dia">
                  {Object.keys(dias).map((dia) => {
                    const livre = (dias[dia]?.length ?? 0) > 0
                    const meioDia = new Date(`${dia}T15:00:00Z`)
                    return (
                      <button
                        key={dia}
                        type="button"
                        className={livre ? f.dia : `${f.dia} ${f.diaSemVaga}`}
                        aria-pressed={data === dia}
                        aria-label={`${dataLonga(meioDia, 'UTC')}${livre ? '' : ', sem horários'}`}
                        onClick={() => {
                          setData(dia)
                          setInicio(null)
                        }}
                      >
                        <span>
                          {dia === hoje
                            ? 'Hoje'
                            : meioDia.toLocaleDateString('pt-BR', {
                                weekday: 'short',
                                timeZone: 'UTC',
                              })}
                        </span>
                        <strong>{dia.slice(8, 10)}</strong>
                        <span className={livre ? f.ponto : f.semPonto} aria-hidden="true" />
                      </button>
                    )
                  })}
                </div>
                {data && (dias[data]?.length ?? 0) === 0 ? (
                  <div className={f.semHorario}>
                    <p>Sem horários livres nesse dia.</p>
                    {Object.keys(dias).find((d) => d > data && (dias[d]?.length ?? 0) > 0) ? (
                      <Botao
                        variante="secundario"
                        onClick={() =>
                          setData(
                            Object.keys(dias).find((d) => d > data && (dias[d]?.length ?? 0) > 0) ??
                              data,
                          )
                        }
                      >
                        Próximo dia livre →
                      </Botao>
                    ) : null}
                  </div>
                ) : null}
                {data
                  ? (['Manhã', 'Tarde', 'Noite'] as const).map((periodo) => {
                      const horarios = (dias[data] ?? []).filter((h) => {
                        const minutos = partesLocais(new Date(h), fuso).minutos
                        return periodo === 'Manhã'
                          ? minutos < 12 * 60
                          : periodo === 'Tarde'
                            ? minutos >= 12 * 60 && minutos < 18 * 60
                            : minutos >= 18 * 60
                      })
                      if (horarios.length === 0) return null
                      return (
                        <fieldset key={periodo} className={f.periodo}>
                          <legend>{periodo}</legend>
                          <div className={f.horarios}>
                            {horarios.map((h) => (
                              <button
                                key={h}
                                type="button"
                                className={f.horario}
                                aria-pressed={inicio === h}
                                onClick={() => setInicio(h)}
                              >
                                {hora(h, fuso)}
                              </button>
                            ))}
                          </div>
                        </fieldset>
                      )
                    })
                  : null}
              </>
            )}
            <div className={f.acoes}>
              <Botao variante="secundario" onClick={voltar}>
                Voltar
              </Botao>
              <Botao grande onClick={irParaDados} disabled={!inicio}>
                Continuar
              </Botao>
            </div>
          </section>
        ) : null}

        {passo === 'dados' ? (
          <form
            className={f.secao}
            onSubmit={confirmarDados}
            noValidate
            aria-labelledby="titulo-passo"
          >
            <h1 id="titulo-passo">Seus dados</h1>
            {resumo}
            <p className={f.suave}>
              Sem senha e sem baixar o app: usamos seus dados para confirmar o horário e avisar de
              qualquer mudança.
            </p>
            <Campo
              rotulo="Nome"
              autoComplete="name"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              erro={tentouDados ? errosDados.nome : null}
            />
            <Campo
              rotulo="Celular (WhatsApp)"
              inputMode="tel"
              autoComplete="tel"
              value={celular}
              onChange={(e) => setCelular(e.target.value)}
              erro={tentouDados ? errosDados.celular : null}
            />
            <Campo
              rotulo="E-mail"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              erro={tentouDados ? errosDados.email : null}
              ajuda="Para receber a confirmação e o comprovante."
            />
            {erro ? <Mensagem tipo="erro">{erro}</Mensagem> : null}
            <div className={f.acoes}>
              <Botao variante="secundario" onClick={voltar}>
                Voltar
              </Botao>
              <Botao grande type="submit" disabled={ocupado}>
                {ocupado ? 'Um instante…' : 'Ir para o pagamento'}
              </Botao>
            </div>
          </form>
        ) : null}

        {passo === 'pagamento' && inicio ? (
          <section className={f.secao} aria-labelledby="titulo-passo">
            <h1 id="titulo-passo">Revisar e pagar</h1>
            <dl className={f.revisao}>
              <div>
                <dt>Serviços</dt>
                <dd>{selecionados.map((s) => s.nome).join(' + ')}</dd>
              </div>
              <div>
                <dt>Profissional</dt>
                <dd>{nomeDoBarbeiro}</dd>
              </div>
              <div>
                <dt>Quando</dt>
                <dd>
                  {dataLonga(inicio, fuso)}, {hora(inicio, fuso)} · {minutosEmTexto(duracao)}
                </dd>
              </div>
              <div>
                <dt>Onde</dt>
                <dd>
                  {pagina.nome}
                  {pagina.endereco ? ` · ${pagina.endereco}` : ''}
                </dd>
              </div>
            </dl>
            <button type="button" className={f.acaoTexto} onClick={() => setPasso('horario')}>
              Editar data e horário
            </button>

            <div className={f.cupom}>
              {cupomAplicado ? (
                <p>
                  Cupom <strong className="mono">{cupomAplicado}</strong> aplicado.{' '}
                  <button type="button" className={f.acaoTexto} onClick={removerCupom}>
                    Remover
                  </button>
                </p>
              ) : (
                <>
                  <Campo
                    rotulo="Cupom (opcional)"
                    value={cupom}
                    onChange={(e) => setCupom(e.target.value.toUpperCase())}
                    erro={erroCupom}
                  />
                  <Botao variante="secundario" onClick={aplicarCupom} disabled={!cupom.trim()}>
                    Aplicar
                  </Botao>
                </>
              )}
            </div>

            {preco ? (
              <dl className={f.valores}>
                {preco.desconto > 0 ? (
                  <>
                    <div>
                      <dt>Serviços</dt>
                      <dd>{reais(preco.valorBruto)}</dd>
                    </div>
                    <div>
                      <dt>Desconto</dt>
                      <dd>− {reais(preco.desconto)}</dd>
                    </div>
                  </>
                ) : null}
                <div className={f.total}>
                  <dt>Total</dt>
                  <dd>{reais(preco.valorPago)}</dd>
                </div>
              </dl>
            ) : null}

            <p className={f.politica}>
              Cancelamento grátis até {politica.prazoGratisHoras}h antes
              {cobrancaEm ? ` (${dataLonga(cobrancaEm, fuso)}, ${hora(cobrancaEm, fuso)})` : ''}.
              Depois disso, ou se você não vier, {politica.retencaoPct}% do valor fica com a
              barbearia. Atraso tolerado: {politica.toleranciaMin} minutos.
            </p>

            {preco && preco.valorPago > 0 ? (
              <fieldset className={f.meios}>
                <legend>Como você quer pagar?</legend>
                <label className={f.opcao}>
                  <input
                    type="radio"
                    name="meio"
                    checked={meio === 'pix'}
                    onChange={() => setMeio('pix')}
                  />
                  <span className={f.opcaoTexto}>
                    <strong>Pix</strong>
                    <span>Paga agora e o horário fica confirmado na hora</span>
                  </span>
                </label>
                <label className={f.opcao}>
                  <input
                    type="radio"
                    name="meio"
                    checked={meio === 'cartao'}
                    onChange={() => setMeio('cartao')}
                  />
                  <span className={f.opcaoTexto}>
                    <strong>Cartão de crédito</strong>
                    <span>Nada é cobrado agora · à vista, sem parcelamento</span>
                  </span>
                </label>
              </fieldset>
            ) : null}

            {meio === 'cartao' && preco && preco.valorPago > 0 ? (
              <div className={f.cartao}>
                <Campo
                  rotulo="Número do cartão"
                  inputMode="numeric"
                  autoComplete="cc-number"
                  value={cartao.numero}
                  onChange={(e) => setCartao({ ...cartao, numero: e.target.value })}
                  erro={tentouCartao ? errosCartao.numero : null}
                />
                <Campo
                  rotulo="Nome impresso no cartão"
                  autoComplete="cc-name"
                  value={cartao.nomeImpresso}
                  onChange={(e) => setCartao({ ...cartao, nomeImpresso: e.target.value })}
                  erro={tentouCartao ? errosCartao.nomeImpresso : null}
                />
                <div className={f.linha}>
                  <Campo
                    rotulo="Validade (MM/AA)"
                    inputMode="numeric"
                    autoComplete="cc-exp"
                    value={cartao.validade}
                    onChange={(e) => setCartao({ ...cartao, validade: e.target.value })}
                    erro={tentouCartao ? errosCartao.validade : null}
                  />
                  <Campo
                    rotulo="CVV"
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    value={cartao.cvv}
                    onChange={(e) => setCartao({ ...cartao, cvv: e.target.value })}
                    erro={tentouCartao ? errosCartao.cvv : null}
                  />
                </div>
                <div className={f.linha}>
                  <Campo
                    rotulo="CPF do titular"
                    inputMode="numeric"
                    value={cartao.cpf}
                    onChange={(e) => setCartao({ ...cartao, cpf: e.target.value })}
                    erro={tentouCartao ? errosCartao.cpf : null}
                  />
                  <Campo
                    rotulo="CEP do titular"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    value={cartao.cep}
                    onChange={(e) => setCartao({ ...cartao, cep: e.target.value })}
                    erro={tentouCartao ? errosCartao.cep : null}
                  />
                  <Campo
                    rotulo="Número do endereço"
                    value={cartao.numeroEndereco}
                    onChange={(e) => setCartao({ ...cartao, numeroEndereco: e.target.value })}
                    erro={tentouCartao ? errosCartao.numeroEndereco : null}
                  />
                </div>
                {cobrancaEm ? (
                  <p className={f.suave}>
                    O cartão é validado até 72h antes e cobrado só em {dataLonga(cobrancaEm, fuso)},{' '}
                    {hora(cobrancaEm, fuso)}, quando acaba o cancelamento grátis.
                  </p>
                ) : null}
              </div>
            ) : null}

            {erro ? <Mensagem tipo="erro">{erro}</Mensagem> : null}
            <div className={f.acoes}>
              <Botao variante="secundario" onClick={voltar} disabled={ocupado}>
                Voltar
              </Botao>
              <Botao grande onClick={pagar} disabled={ocupado || !preco}>
                {ocupado
                  ? 'Processando…'
                  : !preco
                    ? 'Calculando…'
                    : preco.valorPago === 0
                      ? 'Confirmar agendamento'
                      : meio === 'pix'
                        ? `Pagar ${reais(preco.valorPago)} com Pix`
                        : 'Reservar com cartão'}
              </Botao>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  )
}
