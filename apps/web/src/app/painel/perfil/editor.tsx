'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type ChangeEvent } from 'react'
import { Botao, Campo, Cartao, Mensagem, Modal } from '@/componentes/ui'
import { api, ErroDaApi, supabaseNoNavegador } from '@/lib/supabase'
import c from '../conta.module.css'

interface Dados {
  nome: string
  descricao: string
  telefone: string
  whatsapp: string
  instagram: string
  endereco: string
  bairro: string
  cidade: string
  uf: string
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

export function EditorDoPerfil({
  barbeariaId,
  recebimentosAtivos,
  aceitarOnline,
  aparecerNasBuscas,
  inicial,
  horarios,
}: {
  barbeariaId: string
  recebimentosAtivos: boolean
  aceitarOnline: boolean
  aparecerNasBuscas: boolean
  inicial: Dados
  horarios: Horario[]
}) {
  const router = useRouter()
  const [dados, setDados] = useState(inicial)
  const [grade, setGrade] = useState<Horario[]>(horarios)
  const [salvando, setSalvando] = useState(false)
  const [enviandoImagem, setEnviandoImagem] = useState<'capa' | 'logo' | null>(null)
  const [estado, setEstado] = useState<{ tipo: 'erro' | 'sucesso'; texto: string } | null>(null)

  const [online, setOnline] = useState(aceitarOnline)
  const [buscas, setBuscas] = useState(aparecerNasBuscas)
  const [confirmarPausa, setConfirmarPausa] = useState(false)
  const [erroInterruptor, setErroInterruptor] = useState<string | null>(null)

  const chaveDaGrade = (lista: Horario[]) =>
    JSON.stringify([...lista].sort((a, b) => a.dia - b.dia))
  const mudou =
    JSON.stringify(dados) !== JSON.stringify(inicial) ||
    chaveDaGrade(grade) !== chaveDaGrade(horarios)
  const gradeInvalida = grade.some((h) => !h.abre || !h.fecha || h.fecha <= h.abre)
  const campo = (nome: keyof Dados) => ({
    value: dados[nome] ?? '',
    onChange: (e: ChangeEvent<HTMLInputElement>) => setDados({ ...dados, [nome]: e.target.value }),
  })

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

  async function enviarImagem(tipo: 'capa' | 'logo', arquivo: File | undefined) {
    if (!arquivo) return
    if (arquivo.size > 2 * 1024 * 1024) {
      setEstado({ tipo: 'erro', texto: 'A imagem precisa ter até 2 MB.' })
      return
    }
    setEnviandoImagem(tipo)
    setEstado(null)
    const extensao = arquivo.type.split('/')[1] ?? 'jpg'
    const caminho = `${barbeariaId}/${tipo}-${Date.now()}.${extensao}`
    const armazenamento = supabaseNoNavegador().storage.from('barbearias')
    const { error } = await armazenamento.upload(caminho, arquivo, {
      contentType: arquivo.type,
      upsert: true,
    })
    setEnviandoImagem(null)
    if (error) {
      setEstado({ tipo: 'erro', texto: 'Não foi possível enviar a imagem. Use JPG, PNG ou WebP.' })
      return
    }
    const url = armazenamento.getPublicUrl(caminho).data.publicUrl
    setDados({ ...dados, [tipo === 'capa' ? 'capaUrl' : 'logoUrl']: url })
  }

  async function salvar() {
    setSalvando(true)
    setEstado(null)
    const supabase = supabaseNoNavegador()
    const vazioNulo = (texto: string) => texto.trim() || null
    const { error } = await supabase
      .from('barbearias')
      .update({
        nome: dados.nome.trim(),
        descricao: vazioNulo(dados.descricao),
        telefone: vazioNulo(dados.telefone),
        whatsapp: vazioNulo(dados.whatsapp),
        instagram: vazioNulo(dados.instagram),
        endereco: vazioNulo(dados.endereco),
        bairro: vazioNulo(dados.bairro),
        cidade: vazioNulo(dados.cidade),
        uf: vazioNulo(dados.uf.toUpperCase()),
        capa_url: dados.capaUrl,
        logo_url: dados.logoUrl,
      })
      .eq('id', barbeariaId)
    let erroHorarios = null
    if (!error && chaveDaGrade(grade) !== chaveDaGrade(horarios)) {
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
      setEstado({
        tipo: 'erro',
        texto: 'Não foi possível salvar. Confira os campos e tente de novo.',
      })
      return
    }
    setEstado({ tipo: 'sucesso', texto: 'Perfil salvo.' })
    router.refresh()
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

  return (
    <>
      <Cartao>
        <div className={c.cartaoTitulo}>
          <div>
            <h2>Visibilidade</h2>
            <p>Valem na hora, sem precisar salvar.</p>
          </div>
        </div>
        <div className={c.interruptor}>
          <div>
            <strong id="rotulo-online">Aceitar agendamentos online</strong>
            <span>
              {recebimentosAtivos ? (
                'Os clientes agendam e pagam pela página e pelo app.'
              ) : (
                <>
                  Liga depois de <Link href="/painel/recebimentos">ativar os recebimentos</Link>.
                </>
              )}
            </span>
          </div>
          <button
            type="button"
            role="switch"
            className={c.chave}
            aria-checked={online}
            aria-labelledby="rotulo-online"
            disabled={!recebimentosAtivos}
            onClick={() => (online ? setConfirmarPausa(true) : definirOnline(true))}
          />
        </div>
        <div className={c.interruptor}>
          <div>
            <strong id="rotulo-buscas">Aparecer nas buscas do app</strong>
            <span>Desligado, a barbearia só é encontrada pelo link da página.</span>
          </div>
          <button
            type="button"
            role="switch"
            className={c.chave}
            aria-checked={buscas}
            aria-labelledby="rotulo-buscas"
            onClick={() => definirBuscas(!buscas)}
          />
        </div>
        {erroInterruptor ? <Mensagem tipo="erro">{erroInterruptor}</Mensagem> : null}
      </Cartao>

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

      <Cartao>
        <div className={c.cartaoTitulo}>
          <div>
            <h2>Dados da barbearia</h2>
            <p>Nome, contato e endereço que aparecem para o cliente.</p>
          </div>
        </div>
        <div className={c.formulario}>
          <Campo rotulo="Nome" {...campo('nome')} />
          <label className={c.areaTexto}>
            Descrição
            <textarea
              maxLength={LIMITE_DESCRICAO}
              value={dados.descricao}
              onChange={(e) => setDados({ ...dados, descricao: e.target.value })}
            />
            <span className={c.contador}>
              {dados.descricao.length}/{LIMITE_DESCRICAO}
            </span>
          </label>
          <div className={c.linha}>
            <Campo rotulo="Telefone" inputMode="tel" {...campo('telefone')} />
            <Campo rotulo="WhatsApp" inputMode="tel" {...campo('whatsapp')} />
            <Campo rotulo="Instagram" placeholder="@barbearia" {...campo('instagram')} />
          </div>
          <div className={c.linha}>
            <Campo rotulo="Endereço" {...campo('endereco')} />
            <Campo rotulo="Bairro" {...campo('bairro')} />
          </div>
          <div className={c.linha}>
            <Campo rotulo="Cidade" {...campo('cidade')} />
            <Campo rotulo="UF" maxLength={2} {...campo('uf')} />
          </div>
        </div>
      </Cartao>

      <Cartao>
        <div className={c.cartaoTitulo}>
          <div>
            <h2>Imagens</h2>
            <p>JPG, PNG ou WebP, até 2 MB.</p>
          </div>
        </div>
        <div className={c.imagens}>
          <label className={c.imagem}>
            Capa
            <span
              className={c.previa}
              style={dados.capaUrl ? { backgroundImage: `url(${dados.capaUrl})` } : undefined}
            >
              {dados.capaUrl ? '' : enviandoImagem === 'capa' ? 'Enviando…' : 'Sem capa'}
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => enviarImagem('capa', e.target.files?.[0])}
            />
          </label>
          <label className={c.imagem}>
            Logo
            <span
              className={`${c.previa} ${c.previaLogo}`}
              style={dados.logoUrl ? { backgroundImage: `url(${dados.logoUrl})` } : undefined}
            >
              {dados.logoUrl ? '' : enviandoImagem === 'logo' ? 'Enviando…' : 'Sem logo'}
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => enviarImagem('logo', e.target.files?.[0])}
            />
          </label>
        </div>
      </Cartao>

      <Cartao>
        <div className={c.cartaoTitulo}>
          <div>
            <h2>Horário de funcionamento</h2>
            <p>O expediente de cada barbeiro fica dentro deste horário.</p>
          </div>
        </div>
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

      {estado ? <Mensagem tipo={estado.tipo}>{estado.texto}</Mensagem> : null}

      {mudou ? (
        <div className={c.barraSalvar} role="region" aria-label="Alterações não salvas">
          <span>Você tem alterações não salvas.</span>
          <div className={c.acoes}>
            <Botao
              variante="fantasma"
              onClick={() => {
                setDados(inicial)
                setGrade(horarios)
                setEstado(null)
              }}
              disabled={salvando}
              style={{ color: 'inherit' }}
            >
              Descartar
            </Botao>
            <Botao
              variante="secundario"
              onClick={salvar}
              disabled={salvando || gradeInvalida || dados.nome.trim().length < 2}
            >
              {salvando ? 'Salvando…' : 'Salvar alterações'}
            </Botao>
          </div>
        </div>
      ) : null}
    </>
  )
}
