'use client'

import { ExternalLink, ImageIcon, MapPin, Star, Upload } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { Botao, Campo, Cartao, Mensagem, Modal, Toast } from '@/componentes/ui'
import { iniciais } from '@/lib/formato'
import { api, ErroDaApi, supabaseNoNavegador } from '@/lib/supabase'
import c from '../conta.module.css'
import s from '../painel.module.css'
import { AlterarCapa, enviarImagem, LIMITE_DA_IMAGEM, megabytes, TIPOS_DE_IMAGEM } from './capa'
import { Divulgar } from './divulgar'
import p from './perfil.module.css'

// Figma Admin 09 · Perfil da barbearia. Endereço e bairro dividem um campo ("Rua, 128 · Centro"),
// assim como cidade e UF ("Recife — PE"), como no Figma; ao salvar, cada parte vai para a coluna
// dela. O link público não muda por aqui: QR Codes e links já divulgados continuariam apontando
// para o endereço antigo.

interface Dados {
  nome: string
  descricao: string
  whatsapp: string
  instagram: string
  endereco: string
  bairro: string
  cidade: string
  uf: string
  capaUrl: string | null
  logoUrl: string | null
}

/** O que o formulário edita: os campos combinados ficam como texto até salvar. */
interface Formulario {
  nome: string
  descricao: string
  whatsapp: string
  instagram: string
  endereco: string
  cidadeUf: string
  capaUrl: string | null
  logoUrl: string | null
}

interface Horario {
  dia: number
  abre: string
  fecha: string
}

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const LIMITE_DESCRICAO = 240

function paraFormulario(d: Dados): Formulario {
  return {
    nome: d.nome,
    descricao: d.descricao,
    whatsapp: d.whatsapp,
    instagram: d.instagram.replace(/^@/, ''),
    endereco: [d.endereco, d.bairro].filter(Boolean).join(' · '),
    cidadeUf: [d.cidade, d.uf.toUpperCase()].filter(Boolean).join(' — '),
    capaUrl: d.capaUrl,
    logoUrl: d.logoUrl,
  }
}

/** "Rua das Palmeiras, 128 · Centro" → endereço e bairro. */
function separarEndereco(texto: string): { endereco: string; bairro: string } {
  const i = texto.lastIndexOf('·')
  return i < 0
    ? { endereco: texto.trim(), bairro: '' }
    : { endereco: texto.slice(0, i).trim(), bairro: texto.slice(i + 1).trim() }
}

/** "Recife — PE", "Recife - PE", "Recife/PE" → cidade e UF. */
function separarCidade(texto: string): { cidade: string; uf: string } {
  const partes = texto.trim().match(/^(.*?)\s*[—–\-/,]\s*([A-Za-z]{2})$/)
  return partes
    ? { cidade: (partes[1] ?? '').trim(), uf: (partes[2] ?? '').toUpperCase() }
    : { cidade: texto.trim(), uf: '' }
}

export function EditorDoPerfil({
  barbeariaId,
  slug,
  link,
  qrCode,
  recebimentosAtivos,
  aceitarOnline,
  aparecerNasBuscas,
  avaliacao,
  situacao,
  inicial,
  horarios,
}: {
  barbeariaId: string
  slug: string
  link: string
  qrCode: string
  recebimentosAtivos: boolean
  aceitarOnline: boolean
  aparecerNasBuscas: boolean
  avaliacao: { media: number | null; total: number }
  /** "Aberto agora · fecha às 19:00", no fuso da barbearia. */
  situacao: string
  inicial: Dados
  horarios: Horario[]
}) {
  const router = useRouter()
  const [base, setBase] = useState(() => paraFormulario(inicial))
  const [form, setForm] = useState(base)
  const [gradeSalva, setGradeSalva] = useState<Horario[]>(horarios)
  const [grade, setGrade] = useState<Horario[]>(horarios)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)
  const [editandoCapa, setEditandoCapa] = useState(false)
  const [enviandoLogo, setEnviandoLogo] = useState(false)
  const entradaDoLogo = useRef<HTMLInputElement>(null)

  const [online, setOnline] = useState(aceitarOnline)
  const [buscas, setBuscas] = useState(aparecerNasBuscas)
  const [confirmarPausa, setConfirmarPausa] = useState(false)
  const [erroInterruptor, setErroInterruptor] = useState<string | null>(null)

  const chaveDaGrade = (lista: Horario[]) =>
    JSON.stringify([...lista].sort((a, b) => a.dia - b.dia))
  const mudou =
    JSON.stringify(form) !== JSON.stringify(base) ||
    chaveDaGrade(grade) !== chaveDaGrade(gradeSalva)
  const gradeInvalida = grade.some((h) => !h.abre || !h.fecha || h.fecha <= h.abre)
  const podeSalvar = mudou && !salvando && !gradeInvalida && form.nome.trim().length >= 2
  const campo = (nome: 'nome' | 'whatsapp' | 'instagram' | 'endereco' | 'cidadeUf') => ({
    value: form[nome],
    onChange: (e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, [nome]: e.target.value }),
  })
  const host = link.replace(/^https?:\/\//, '').replace(/\/[^/]*$/, '')
  const rua = separarEndereco(form.endereco)
  const enderecoNaPrevia = [
    [rua.endereco, rua.bairro].filter(Boolean).join(' · '),
    separarCidade(form.cidadeUf).cidade,
  ]
    .filter(Boolean)
    .join(', ')

  function alternarDia(dia: number, aberto: boolean) {
    setGrade(
      aberto
        ? [...grade, { dia, abre: '09:00', fecha: '19:00' }]
        : grade.filter((h) => h.dia !== dia),
    )
  }

  function mudarHora(dia: number, campoHora: 'abre' | 'fecha', valor: string) {
    setGrade(grade.map((h) => (h.dia === dia ? { ...h, [campoHora]: valor } : h)))
  }

  async function enviarLogo(arquivo: File | undefined) {
    if (!arquivo) return
    if (!TIPOS_DE_IMAGEM.includes(arquivo.type) || arquivo.size > LIMITE_DA_IMAGEM) {
      setErro(`O logo precisa ser JPG, PNG ou WebP, até ${megabytes(LIMITE_DA_IMAGEM)}.`)
      return
    }
    setEnviandoLogo(true)
    setErro(null)
    try {
      const url = await enviarImagem(barbeariaId, 'logo', arquivo)
      setForm((atual) => ({ ...atual, logoUrl: url }))
    } catch {
      setErro('Não foi possível enviar o logo. Tente de novo.')
    } finally {
      setEnviandoLogo(false)
      if (entradaDoLogo.current) entradaDoLogo.current.value = ''
    }
  }

  async function salvar() {
    if (!podeSalvar) return
    setSalvando(true)
    setErro(null)
    const supabase = supabaseNoNavegador()
    const vazioNulo = (texto: string) => texto.trim() || null
    const { endereco, bairro } = separarEndereco(form.endereco)
    const { cidade, uf } = separarCidade(form.cidadeUf)
    const instagram = form.instagram.trim().replace(/^@/, '')
    const { error } = await supabase
      .from('barbearias')
      .update({
        nome: form.nome.trim(),
        descricao: vazioNulo(form.descricao),
        whatsapp: vazioNulo(form.whatsapp),
        instagram: vazioNulo(instagram),
        endereco: vazioNulo(endereco),
        bairro: vazioNulo(bairro),
        cidade: vazioNulo(cidade),
        uf: vazioNulo(uf),
        capa_url: form.capaUrl,
        logo_url: form.logoUrl,
      })
      .eq('id', barbeariaId)
    let erroHorarios = null
    if (!error && chaveDaGrade(grade) !== chaveDaGrade(gradeSalva)) {
      const abertos = grade.map((h) => h.dia)
      const fechados = DIAS.map((_, i) => i).filter((d) => !abertos.includes(d))
      const remocao = fechados.length
        ? await supabase
            .from('horarios_barbearia')
            .delete()
            .eq('barbearia_id', barbeariaId)
            .in('dia_semana', fechados)
        : { error: null }
      const gravacao = grade.length
        ? await supabase.from('horarios_barbearia').upsert(
            grade.map((h) => ({
              barbearia_id: barbeariaId,
              dia_semana: h.dia,
              abre: h.abre,
              fecha: h.fecha,
            })),
          )
        : { error: null }
      erroHorarios = remocao.error ?? gravacao.error
    }
    setSalvando(false)
    if (error || erroHorarios) {
      setErro('Não foi possível salvar. Confira os campos e tente de novo.')
      return
    }
    const salvoAgora = paraFormulario({
      nome: form.nome.trim(),
      descricao: form.descricao.trim(),
      whatsapp: form.whatsapp.trim(),
      instagram,
      endereco,
      bairro,
      cidade,
      uf,
      capaUrl: form.capaUrl,
      logoUrl: form.logoUrl,
    })
    setBase(salvoAgora)
    setForm(salvoAgora)
    setGradeSalva(grade)
    setSalvo(true)
    setTimeout(() => setSalvo(false), 5000)
    router.refresh()
  }

  function descartar() {
    setForm(base)
    setGrade(gradeSalva)
    setErro(null)
  }

  async function definirOnline(aceitar: boolean) {
    setErroInterruptor(null)
    try {
      await api(`/api/barbearias/${barbeariaId}/agendamentos-online`, { corpo: { aceitar } })
      setOnline(aceitar)
      setConfirmarPausa(false)
      router.refresh()
    } catch (e) {
      setErroInterruptor(e instanceof ErroDaApi ? e.message : 'Não foi possível mudar agora.')
    }
  }

  async function definirBuscas(aparecer: boolean) {
    setErroInterruptor(null)
    const { error } = await supabaseNoNavegador()
      .from('barbearias')
      .update({ aparecer_nas_buscas: aparecer })
      .eq('id', barbeariaId)
    if (error) setErroInterruptor('Não foi possível mudar agora.')
    else setBuscas(aparecer)
  }

  const logo = (tamanho: string) => (
    <span
      className={`${p.logo} ${tamanho}`}
      style={form.logoUrl ? { backgroundImage: `url(${form.logoUrl})` } : undefined}
      aria-hidden="true"
    >
      {form.logoUrl ? null : iniciais(form.nome || 'Barbearia')}
    </span>
  )

  return (
    <div className={p.pagina}>
      <div className={s.cabecalhoPagina}>
        <div>
          <h1>Perfil da barbearia</h1>
          <p>Como sua barbearia aparece para os clientes no app</p>
        </div>
        <div className={s.acoes}>
          <a className={p.botaoLink} href={`/${slug}`} target="_blank" rel="noreferrer">
            <ExternalLink size={17} strokeWidth={1.75} aria-hidden />
            Ver página pública
          </a>
          <Botao variante="secundario" onClick={salvar} disabled={!podeSalvar}>
            {salvando ? 'Salvando…' : 'Salvar alterações'}
          </Botao>
        </div>
      </div>

      <div className={p.colunas}>
        <div className={p.coluna}>
          <Cartao className={p.cartao}>
            <h2 className={p.titulo}>Identidade visual</h2>
            <div
              className={p.capa}
              style={form.capaUrl ? { backgroundImage: `url(${form.capaUrl})` } : undefined}
              data-com-imagem={form.capaUrl ? 'sim' : undefined}
            >
              {form.capaUrl ? null : (
                <>
                  <ImageIcon size={20} strokeWidth={1.5} aria-hidden />
                  <span>Capa da barbearia · 1600×600 px · JPG ou PNG</span>
                </>
              )}
              <Botao variante="secundario" onClick={() => setEditandoCapa(true)}>
                <Upload size={16} strokeWidth={1.75} aria-hidden />
                {form.capaUrl ? 'Trocar capa' : 'Enviar capa'}
              </Botao>
            </div>
            <div className={p.linhaLogo}>
              {logo(p.logoGrande ?? '')}
              <div className={p.textoLogo}>
                <strong>Logo</strong>
                <span>Quadrado, mínimo 400×400 px · PNG, JPG ou WebP</span>
              </div>
              <Botao
                variante="secundario"
                onClick={() => entradaDoLogo.current?.click()}
                disabled={enviandoLogo}
              >
                <Upload size={16} strokeWidth={1.75} aria-hidden />
                {enviandoLogo ? 'Enviando…' : 'Enviar logo'}
              </Botao>
              {form.logoUrl ? (
                <Botao variante="fantasma" onClick={() => setForm({ ...form, logoUrl: null })}>
                  Remover
                </Botao>
              ) : null}
              <input
                ref={entradaDoLogo}
                type="file"
                accept={TIPOS_DE_IMAGEM.join(',')}
                className="so-leitor"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(e) => enviarLogo(e.target.files?.[0])}
              />
            </div>
          </Cartao>

          <Cartao className={p.cartao}>
            <h2 className={p.titulo}>Dados públicos</h2>
            <div className={p.campos}>
              <Campo rotulo="Nome da barbearia" {...campo('nome')} />
              <Campo
                rotulo="Link público"
                value={slug}
                readOnly
                prefixo={`${host}/`}
                ajuda="O link não muda depois do cadastro."
              />
              <label className={`${p.areaTexto} ${p.largo}`}>
                <span className={p.rotuloComContador}>
                  Descrição
                  <span className={p.contador}>
                    {form.descricao.length} / {LIMITE_DESCRICAO}
                  </span>
                </span>
                <textarea
                  maxLength={LIMITE_DESCRICAO}
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                />
              </label>
              <Campo rotulo="WhatsApp" mascara="celular" {...campo('whatsapp')} />
              <Campo
                rotulo="Instagram"
                prefixo={<IconeInstagram />}
                placeholder="barbearia"
                {...campo('instagram')}
              />
              <div className={`${p.largo} ${p.linhaEndereco}`}>
                <Campo
                  rotulo="Endereço"
                  placeholder="Rua das Palmeiras, 128 · Centro"
                  {...campo('endereco')}
                />
                <Campo rotulo="Cidade / UF" placeholder="Recife — PE" {...campo('cidadeUf')} />
              </div>
            </div>
          </Cartao>

          <Cartao className={p.cartao}>
            <h2 className={p.titulo}>Horário de funcionamento</h2>
            <p className={p.subtitulo}>O expediente de cada barbeiro fica dentro deste horário.</p>
            <div>
              {DIAS.map((nome, dia) => {
                const horario = grade.find((h) => h.dia === dia)
                return (
                  <div key={nome} className={c.dia}>
                    <label className={c.marcar}>
                      <input
                        type="checkbox"
                        checked={Boolean(horario)}
                        onChange={(e) => alternarDia(dia, e.target.checked)}
                      />
                      {nome}
                    </label>
                    {horario ? (
                      <span className={c.horas}>
                        <input
                          type="time"
                          aria-label={`${nome}: abre às`}
                          value={horario.abre}
                          onChange={(e) => mudarHora(dia, 'abre', e.target.value)}
                        />
                        até
                        <input
                          type="time"
                          aria-label={`${nome}: fecha às`}
                          value={horario.fecha}
                          onChange={(e) => mudarHora(dia, 'fecha', e.target.value)}
                        />
                      </span>
                    ) : (
                      <span style={{ color: 'var(--texto-suave)' }}>Fechado</span>
                    )}
                  </div>
                )
              })}
            </div>
            {gradeInvalida ? (
              <Mensagem tipo="erro">O horário de fechar precisa ser depois do de abrir.</Mensagem>
            ) : null}
          </Cartao>
          {erro ? <Mensagem tipo="erro">{erro}</Mensagem> : null}
        </div>

        <div className={p.coluna}>
          <section aria-labelledby="titulo-previa">
            <h2 id="titulo-previa" className={`rotulo ${p.rotuloPrevia}`}>
              Prévia no app do cliente
            </h2>
            <div className={p.previa}>
              <div
                className={p.previaCapa}
                style={form.capaUrl ? { backgroundImage: `url(${form.capaUrl})` } : undefined}
              />
              <div className={p.previaCorpo}>
                {logo(p.logoPrevia ?? '')}
                <strong className={p.previaNome}>{form.nome || 'Nome da barbearia'}</strong>
                <span className={p.previaLinha}>
                  <Star size={15} strokeWidth={1.75} className={p.estrela} aria-hidden />
                  {avaliacao.media === null ? (
                    'Ainda sem avaliações'
                  ) : (
                    <>
                      <span className={p.nota}>
                        {avaliacao.media.toLocaleString('pt-BR', {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })}
                      </span>
                      · {avaliacao.total} {avaliacao.total === 1 ? 'avaliação' : 'avaliações'}
                    </>
                  )}
                </span>
                {enderecoNaPrevia ? (
                  <span className={p.previaLinha}>
                    <MapPin size={15} strokeWidth={1.75} aria-hidden />
                    {enderecoNaPrevia}
                  </span>
                ) : null}
                <span
                  className={p.situacao}
                  data-aberto={situacao.startsWith('Aberto') ? 'sim' : undefined}
                >
                  {situacao}
                </span>
                {form.descricao ? <p className={p.previaDescricao}>{form.descricao}</p> : null}
                <span className={p.previaBotao}>Agendar horário</span>
              </div>
            </div>
          </section>

          <Cartao className={p.cartao}>
            <h2 className={p.titulo}>Visibilidade</h2>
            <Interruptor
              id="rotulo-buscas"
              titulo="Aparecer nas buscas"
              texto="Clientes encontram a barbearia no app"
              ligado={buscas}
              aoMudar={() => definirBuscas(!buscas)}
            />
            <Interruptor
              id="rotulo-online"
              titulo="Aceitar agendamentos online"
              texto={
                recebimentosAtivos ? (
                  'Desative para pausar novas reservas'
                ) : (
                  <>
                    Liga depois de <Link href="/painel/recebimentos">ativar os recebimentos</Link>
                  </>
                )
              }
              ligado={online}
              desativado={!recebimentosAtivos}
              aoMudar={() => (online ? setConfirmarPausa(true) : definirOnline(true))}
            />
            {erroInterruptor ? <Mensagem tipo="erro">{erroInterruptor}</Mensagem> : null}
          </Cartao>

          <Divulgar link={link} qrCode={qrCode} slug={slug} />
        </div>
      </div>

      {mudou ? (
        <div className={p.barraSalvar} role="region" aria-label="Alterações não salvas">
          <span className={p.pontoPendente} aria-hidden="true" />
          <span>Você tem alterações não salvas</span>
          <Botao variante="secundario" onClick={descartar} disabled={salvando}>
            Descartar
          </Botao>
          <Botao variante="secundario" onClick={salvar} disabled={!podeSalvar}>
            {salvando ? 'Salvando…' : 'Salvar alterações'}
          </Botao>
        </div>
      ) : null}

      {salvo ? (
        <Toast titulo="Perfil atualizado" aoFechar={() => setSalvo(false)}>
          As mudanças já aparecem para os clientes no app.
        </Toast>
      ) : null}

      <AlterarCapa
        barbeariaId={barbeariaId}
        atual={form.capaUrl}
        aberto={editandoCapa}
        aoFechar={() => setEditandoCapa(false)}
        aoUsar={(url) => setForm((atual) => ({ ...atual, capaUrl: url }))}
      />

      <Modal
        aberto={confirmarPausa}
        aoFechar={() => setConfirmarPausa(false)}
        titulo="Pausar os agendamentos online?"
        descricao="Os clientes deixam de conseguir agendar pela página e pelo app até você ligar de novo. Os agendamentos já feitos continuam valendo."
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setConfirmarPausa(false)}>
              Manter ligado
            </Botao>
            <Botao variante="perigo" onClick={() => definirOnline(false)}>
              Pausar reservas
            </Botao>
          </>
        }
      >
        <p>Um aviso de “Reservas pausadas” fica no topo do painel enquanto estiver desligado.</p>
      </Modal>
    </div>
  )
}

function Interruptor({
  id,
  titulo,
  texto,
  ligado,
  desativado,
  aoMudar,
}: {
  id: string
  titulo: string
  texto: ReactNode
  ligado: boolean
  desativado?: boolean
  aoMudar: () => void
}) {
  return (
    <div className={p.interruptor}>
      <div>
        <strong id={id}>{titulo}</strong>
        <span>{texto}</span>
      </div>
      <button
        type="button"
        role="switch"
        className={c.chave}
        aria-checked={ligado}
        aria-labelledby={id}
        disabled={desativado}
        onClick={aoMudar}
      />
    </div>
  )
}

/** Glifo do Instagram (a lucide não traz ícones de marca). */
function IconeInstagram() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  )
}
