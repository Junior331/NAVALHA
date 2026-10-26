'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Logo } from '@/componentes/logo'
import { Botao, BotaoLink, Campo, Cartao, Mensagem } from '@/componentes/ui'
import t from '@/componentes/tabela.module.css'
import { api, ErroDaApi, supabaseNoNavegador } from '@/lib/supabase'
import { centavosDe, contatoMascarado, mascararReais, soDigitos } from '@/lib/mascaras'
import { FormularioDeRecebimentos } from '../painel/recebimentos/formulario'
import s from './onboarding.module.css'

// Figma Acessos · Onboarding do dono: 01 Equipe → 02 Serviços → 03 Horários → Recebimentos (passo
// novo, ajustes-taxas §Subconta) → 04 Tudo pronto.
type Etapa = 'equipe' | 'servicos' | 'horarios' | 'recebimentos' | 'pronto'
const ETAPAS: { id: Etapa; nome: string }[] = [
  { id: 'equipe', nome: 'Equipe' },
  { id: 'servicos', nome: 'Serviços' },
  { id: 'horarios', nome: 'Horários' },
  { id: 'recebimentos', nome: 'Recebimentos' },
  { id: 'pronto', nome: 'Tudo pronto' },
]

// Modelo do Onboarding 02 (o dono ajusta antes de salvar).
const MODELO = [
  { nome: 'Corte masculino', categoria: 'Cabelo', duracao: 30, preco: '45,00' },
  { nome: 'Barba', categoria: 'Barba', duracao: 20, preco: '30,00' },
  { nome: 'Corte + barba', categoria: 'Combo', duracao: 50, preco: '70,00' },
  { nome: 'Sobrancelha', categoria: 'Estética', duracao: 10, preco: '15,00' },
  { nome: 'Pigmentação', categoria: 'Química', duracao: 40, preco: '60,00' },
]

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

interface Dono {
  membroId: string
  barbeariaId: string
}

export default function Onboarding() {
  const [etapa, setEtapa] = useState<Etapa>('equipe')
  const [dono, setDono] = useState<Dono | null>(null)
  const [ativou, setAtivou] = useState(false)
  const supabase = supabaseNoNavegador()

  useEffect(() => {
    supabase
      .from('membros')
      .select('id, barbearia_id')
      .eq('papel', 'dono')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => data && setDono({ membroId: data.id, barbeariaId: data.barbearia_id }))
  }, [supabase])

  const indice = ETAPAS.findIndex((e) => e.id === etapa)

  return (
    <main className={s.pagina}>
      <header className={s.topo}>
        <Logo tamanho={30} titulo="Navalha" />
        <ol className={s.etapas}>
          {ETAPAS.map((e, i) => (
            <li
              key={e.id}
              aria-current={e.id === etapa ? 'step' : undefined}
              className={i < indice ? s.feita : undefined}
            >
              <span>{i < indice ? '✓' : i + 1}</span> {e.nome}
            </li>
          ))}
        </ol>
        <Link href="/painel">Prefere fazer depois? Ir para o painel</Link>
      </header>
      <section className={s.conteudo}>
        <p className="rotulo">
          Etapa {indice + 1} de {ETAPAS.length}
        </p>
        {!dono ? (
          <p>Carregando a barbearia…</p>
        ) : etapa === 'equipe' ? (
          <Equipe dono={dono} avancar={() => setEtapa('servicos')} />
        ) : etapa === 'servicos' ? (
          <Servicos dono={dono} avancar={() => setEtapa('horarios')} />
        ) : etapa === 'horarios' ? (
          <Horarios dono={dono} avancar={() => setEtapa('recebimentos')} />
        ) : etapa === 'recebimentos' ? (
          <Recebimentos
            dono={dono}
            avancar={(ativado) => {
              setAtivou(ativado)
              setEtapa('pronto')
            }}
          />
        ) : (
          <Pronto ativou={ativou} />
        )}
      </section>
    </main>
  )
}

function Equipe({ dono, avancar }: { dono: Dono; avancar: () => void }) {
  const [nome, setNome] = useState('')
  const [contato, setContato] = useState('')
  const [links, setLinks] = useState<{ nome: string; link: string }[]>([])
  const [erro, setErro] = useState<string | null>(null)

  async function convidar() {
    setErro(null)
    try {
      const r = await api<{ link: string }>('/api/convites', {
        corpo: { barbeariaId: dono.barbeariaId, nome, ...(contato ? { contato } : {}) },
      })
      setLinks((atual) => [...atual, { nome, link: r.link }])
      setNome('')
      setContato('')
    } catch (e) {
      setErro(e instanceof ErroDaApi ? e.message : 'Não foi possível gerar o convite.')
    }
  }

  return (
    <>
      <h1>Convide os barbeiros que atendem com você</h1>
      <p className={s.subtitulo}>Cada um recebe um link para criar o próprio acesso no app.</p>
      <Cartao className={s.formulario}>
        <Campo rotulo="Nome do barbeiro" value={nome} onChange={(e) => setNome(e.target.value)} />
        <Campo
          rotulo="E-mail ou WhatsApp (opcional)"
          value={contato}
          onChange={(e) => setContato(contatoMascarado(e.target.value))}
        />
        <Botao variante="secundario" onClick={convidar} disabled={nome.trim().length < 2}>
          Gerar convite
        </Botao>
        {erro ? <Mensagem tipo="erro">{erro}</Mensagem> : null}
      </Cartao>
      {links.map((l) => (
        <div key={l.link} className={t.linhaLink}>
          <strong style={{ fontFamily: 'var(--fonte)' }}>{l.nome}</strong>
          <span style={{ flex: 1 }}>{l.link}</span>
          <Botao variante="secundario" onClick={() => navigator.clipboard.writeText(l.link)}>
            Copiar
          </Botao>
        </div>
      ))}
      <div className={s.acoes}>
        <Botao variante="fantasma" onClick={avancar}>
          Pular por agora
        </Botao>
        <Botao onClick={avancar}>Continuar</Botao>
      </div>
    </>
  )
}

function Servicos({ dono, avancar }: { dono: Dono; avancar: () => void }) {
  const [linhas, setLinhas] = useState(MODELO.map((m) => ({ ...m, marcado: true })))
  const [existentes, setExistentes] = useState<number | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const supabase = supabaseNoNavegador()

  useEffect(() => {
    supabase
      .from('servicos')
      .select('id', { count: 'exact', head: true })
      .eq('barbearia_id', dono.barbeariaId)
      .then(({ count }) => setExistentes(count ?? 0))
  }, [supabase, dono.barbeariaId])

  async function salvar() {
    setSalvando(true)
    setErro(null)
    const escolhidos = linhas.filter((l) => l.marcado && l.nome.trim())
    if (escolhidos.length) {
      const { data, error } = await supabase
        .from('servicos')
        .insert(
          escolhidos.map((l, i) => ({
            barbearia_id: dono.barbeariaId,
            nome: l.nome.trim(),
            categoria: l.categoria,
            duracao_min: l.duracao,
            preco_centavos: centavosDe(l.preco),
            ordem: i + 1,
          })),
        )
        .select('id')
      if (error || !data) {
        setSalvando(false)
        return setErro('Não foi possível salvar os serviços.')
      }
      // O dono atende: entra como quem realiza cada serviço.
      await supabase.from('servico_barbeiro').insert(
        data.map((sv) => ({
          servico_id: sv.id,
          membro_id: dono.membroId,
          barbearia_id: dono.barbeariaId,
        })),
      )
    }
    setSalvando(false)
    avancar()
  }

  const atualizar = (i: number, campo: string, valor: string | boolean | number) =>
    setLinhas((atual) => atual.map((l, j) => (j === i ? { ...l, [campo]: valor } : l)))

  return (
    <>
      <h1>Quais serviços você oferece?</h1>
      <p className={s.subtitulo}>Ajuste preço e duração. Dá para mudar tudo depois em Serviços.</p>
      {existentes ? (
        <Mensagem tipo="info">
          Você já tem {existentes} serviço(s) cadastrado(s). Os marcados abaixo serão adicionados.
        </Mensagem>
      ) : null}
      <div className={t.envoltorio}>
        <table className={t.tabela}>
          <thead>
            <tr>
              <th scope="col">
                <span className="so-leitor">Incluir</span>
              </th>
              <th scope="col">Serviço</th>
              <th scope="col">Duração (min)</th>
              <th scope="col">Preço (R$)</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={i}>
                <td>
                  <input
                    type="checkbox"
                    checked={l.marcado}
                    onChange={(e) => atualizar(i, 'marcado', e.target.checked)}
                    aria-label={`Incluir ${l.nome}`}
                  />
                </td>
                <td>
                  <input
                    className={t.busca}
                    value={l.nome}
                    onChange={(e) => atualizar(i, 'nome', e.target.value)}
                    aria-label="Nome do serviço"
                  />
                </td>
                <td>
                  <input
                    className={t.busca}
                    style={{ minWidth: 80 }}
                    inputMode="numeric"
                    value={l.duracao || ''}
                    onChange={(e) =>
                      atualizar(i, 'duracao', Number(soDigitos(e.target.value)) || 0)
                    }
                    aria-label="Duração em minutos"
                  />
                </td>
                <td>
                  <input
                    className={t.busca}
                    style={{ minWidth: 80 }}
                    inputMode="decimal"
                    value={l.preco}
                    onChange={(e) => atualizar(i, 'preco', mascararReais(e.target.value))}
                    aria-label="Preço em reais"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Botao
        variante="fantasma"
        onClick={() =>
          setLinhas([
            ...linhas,
            { nome: '', categoria: 'Cabelo', duracao: 30, preco: '', marcado: true },
          ])
        }
      >
        + Adicionar serviço personalizado
      </Botao>
      {erro ? <Mensagem tipo="erro">{erro}</Mensagem> : null}
      <div className={s.acoes}>
        <Botao variante="fantasma" onClick={avancar}>
          Pular por agora
        </Botao>
        <Botao onClick={salvar} disabled={salvando}>
          {salvando ? 'Salvando…' : 'Continuar'}
        </Botao>
      </div>
    </>
  )
}

function Horarios({ dono, avancar }: { dono: Dono; avancar: () => void }) {
  const [dias, setDias] = useState(
    DIAS.map((_, i) => ({ aberto: i !== 0, abre: '09:00', fecha: i === 6 ? '16:00' : '18:00' })),
  )
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const supabase = supabaseNoNavegador()

  useEffect(() => {
    supabase
      .from('horarios_barbearia')
      .select('dia_semana, abre, fecha')
      .eq('barbearia_id', dono.barbeariaId)
      .then(({ data }) => {
        if (!data?.length) return
        setDias(
          DIAS.map((_, i) => {
            const d = data.find((x) => x.dia_semana === i)
            return d
              ? { aberto: true, abre: d.abre.slice(0, 5), fecha: d.fecha.slice(0, 5) }
              : { aberto: false, abre: '09:00', fecha: '18:00' }
          }),
        )
      })
  }, [supabase, dono.barbeariaId])

  async function salvar() {
    setSalvando(true)
    setErro(null)
    const abertos = dias.map((d, i) => ({ ...d, dia: i })).filter((d) => d.aberto)
    if (abertos.some((d) => d.fecha <= d.abre)) {
      setSalvando(false)
      return setErro('O horário de fechar precisa ser depois do de abrir.')
    }
    const fechados = dias
      .map((d, i) => ({ ...d, dia: i }))
      .filter((d) => !d.aberto)
      .map((d) => d.dia)
    const lojas = abertos.map((d) => ({
      barbearia_id: dono.barbeariaId,
      dia_semana: d.dia,
      abre: d.abre,
      fecha: d.fecha,
    }))
    const turnos = abertos.map((d) => ({
      membro_id: dono.membroId,
      barbearia_id: dono.barbeariaId,
      dia_semana: d.dia,
      inicio: d.abre,
      fim: d.fecha,
    }))
    const r1 = await supabase.from('horarios_barbearia').upsert(lojas)
    const r2 = await supabase.from('horarios_atendimento').upsert(turnos)
    if (fechados.length) {
      await supabase
        .from('horarios_barbearia')
        .delete()
        .eq('barbearia_id', dono.barbeariaId)
        .in('dia_semana', fechados)
      await supabase
        .from('horarios_atendimento')
        .delete()
        .eq('membro_id', dono.membroId)
        .in('dia_semana', fechados)
    }
    setSalvando(false)
    if (r1.error || r2.error) return setErro('Não foi possível salvar os horários.')
    avancar()
  }

  return (
    <>
      <h1>Em que dias e horários você atende?</h1>
      <p className={s.subtitulo}>
        Vale para a barbearia e para a sua agenda. Cada barbeiro ajusta a própria no app.
      </p>
      <Cartao className={s.dias}>
        {dias.map((d, i) => (
          <div key={DIAS[i]} className={s.dia}>
            <label>
              <input
                type="checkbox"
                checked={d.aberto}
                onChange={(e) =>
                  setDias(dias.map((x, j) => (j === i ? { ...x, aberto: e.target.checked } : x)))
                }
              />{' '}
              {DIAS[i]}
            </label>
            {d.aberto ? (
              <span>
                <input
                  type="time"
                  className={t.busca}
                  style={{ minWidth: 0 }}
                  value={d.abre}
                  onChange={(e) =>
                    setDias(dias.map((x, j) => (j === i ? { ...x, abre: e.target.value } : x)))
                  }
                  aria-label={`${DIAS[i]} abre`}
                />{' '}
                até{' '}
                <input
                  type="time"
                  className={t.busca}
                  style={{ minWidth: 0 }}
                  value={d.fecha}
                  onChange={(e) =>
                    setDias(dias.map((x, j) => (j === i ? { ...x, fecha: e.target.value } : x)))
                  }
                  aria-label={`${DIAS[i]} fecha`}
                />
              </span>
            ) : (
              <span style={{ color: 'var(--texto-suave)' }}>Fechado</span>
            )}
          </div>
        ))}
      </Cartao>
      {erro ? <Mensagem tipo="erro">{erro}</Mensagem> : null}
      <div className={s.acoes}>
        <Botao onClick={salvar} disabled={salvando}>
          {salvando ? 'Salvando…' : 'Continuar'}
        </Botao>
      </div>
    </>
  )
}

function Recebimentos({ dono, avancar }: { dono: Dono; avancar: (ativado: boolean) => void }) {
  return (
    <>
      <h1>Ative os recebimentos</h1>
      <p className={s.subtitulo}>
        Para receber Pix e cartão dos agendamentos online, a Navalha abre uma conta de pagamentos no
        Asaas em nome da barbearia. O valor fica retido até o atendimento e, depois, pode ser sacado
        por Pix.
      </p>
      <FormularioDeRecebimentos barbeariaId={dono.barbeariaId} aoAtivar={() => avancar(true)} />
      <div className={s.acoes}>
        <Botao variante="fantasma" onClick={() => avancar(false)}>
          Fazer depois
        </Botao>
      </div>
    </>
  )
}

function Pronto({ ativou }: { ativou: boolean }) {
  return (
    <>
      <h1>Tudo pronto</h1>
      <p className={s.subtitulo}>
        {ativou
          ? 'Os recebimentos estão ativos: a sua página já aceita agendamentos pagos.'
          : 'Falta um passo para receber agendamentos online: ativar os recebimentos. Até lá, a página pública não aceita agendamentos pagos.'}
      </p>
      <div className={s.acoes}>
        {ativou ? null : (
          <BotaoLink href="/painel/recebimentos" variante="secundario">
            Ativar recebimentos
          </BotaoLink>
        )}
        <BotaoLink href="/painel">Ir para o painel</BotaoLink>
      </div>
    </>
  )
}
