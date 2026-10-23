'use client'

import Link from 'next/link'
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { SituacaoDoAgendamento } from '@navalha/servidor'
import { Botao, Mensagem } from '@/componentes/ui'
import { dataLonga, hora, reais } from '@/lib/formato'
import { api, ErroDaApi } from '@/lib/supabase'
import f from '../../agendar/fluxo.module.css'
import a from './acompanhar.module.css'

interface Pix {
  copiaECola: string
  qrCodeBase64: string
  qrCodeExpiraEm: string
  reservadoAte: string
  valorPagoCentavos: number
}

interface Barbearia {
  slug: string
  nome: string
  fuso: string
  endereco: string
  whatsapp: string | null
}

const semInscricao = () => () => {}

export function AcompanharAgendamento({
  id,
  barbearia,
  podeSimularPix,
  lojas,
}: {
  id: string
  barbearia: Barbearia
  podeSimularPix: boolean
  lojas: { appStore: string | null; playStore: string | null }
}) {
  const { fuso } = barbearia
  // O QR Code vem da tela de pagamento; o servidor não guarda a imagem.
  const pixGuardado = useSyncExternalStore(
    semInscricao,
    () => {
      try {
        return sessionStorage.getItem(`navalha:pix:${id}`)
      } catch {
        return null
      }
    },
    () => null,
  )
  const pix = pixGuardado ? (JSON.parse(pixGuardado) as Pix) : null
  const [situacao, setSituacao] = useState<SituacaoDoAgendamento | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [simulando, setSimulando] = useState(false)

  // Consulta a cada 3s enquanto o Pix não cai; para quando vira agendamento ou expira.
  useEffect(() => {
    let ativo = true
    const verificar = async () => {
      try {
        const r = await api<SituacaoDoAgendamento>(`/api/agendamentos/${id}`)
        if (!ativo) return
        setSituacao(r)
        if (r.tipo !== 'reserva') clearInterval(intervalo)
      } catch (e) {
        if (!ativo) return
        setErro(
          e instanceof ErroDaApi ? e.message : 'Não foi possível consultar o agendamento agora.',
        )
        clearInterval(intervalo)
      }
    }
    const intervalo = setInterval(verificar, 3000)
    void verificar()
    return () => {
      ativo = false
      clearInterval(intervalo)
    }
  }, [id])

  async function copiar() {
    if (!pix) return
    await navigator.clipboard.writeText(pix.copiaECola)
    setCopiado(true)
  }

  async function simularPagamento() {
    setSimulando(true)
    try {
      await api(`/api/dev/pix/${id}`, { metodo: 'POST', corpo: {} })
      setSituacao(await api<SituacaoDoAgendamento>(`/api/agendamentos/${id}`))
    } catch (e) {
      setErro(e instanceof ErroDaApi ? e.message : 'Não foi possível simular o pagamento.')
    } finally {
      setSimulando(false)
    }
  }

  const voltar = (
    <Link href={`/${barbearia.slug}`} className={f.voltarParaBarbearia}>
      ← {barbearia.nome}
    </Link>
  )

  if (erro && !situacao) {
    return (
      <Moldura topo={voltar}>
        <h1>Agendamento não encontrado</h1>
        <Mensagem tipo="erro">{erro}</Mensagem>
        <Link href={`/${barbearia.slug}/agendar`}>Fazer um novo agendamento</Link>
      </Moldura>
    )
  }

  if (!situacao) {
    return (
      <Moldura topo={voltar}>
        <p className={f.suave}>Carregando seu agendamento…</p>
      </Moldura>
    )
  }

  if (situacao.tipo === 'expirado') {
    return (
      <Moldura topo={voltar}>
        <h1>O Pix expirou</h1>
        <p>O horário foi liberado e nada foi cobrado.</p>
        <Link href={`/${barbearia.slug}/agendar`} className={a.botao}>
          Agendar de novo
        </Link>
      </Moldura>
    )
  }

  if (situacao.tipo === 'reserva') {
    return (
      <Moldura topo={voltar}>
        <h1>Pague com Pix para confirmar</h1>
        <p className={f.suave}>
          O horário fica reservado até {hora(situacao.reservadoAte, fuso)}. Assim que o pagamento
          cair, esta tela atualiza sozinha.
        </p>
        {pix ? (
          <div className={a.pix}>
            {/* eslint-disable-next-line @next/next/no-img-element -- QR Code em base64, sem otimização */}
            <img
              src={`data:image/png;base64,${pix.qrCodeBase64}`}
              alt="QR Code do Pix"
              width={220}
              height={220}
            />
            <strong className={a.valor}>{reais(pix.valorPagoCentavos)}</strong>
            <p className={f.suave}>O QR Code vale até {hora(pix.qrCodeExpiraEm, fuso)}.</p>
            <div className={a.copiaECola}>
              <code>{pix.copiaECola}</code>
              <Botao variante="secundario" onClick={copiar}>
                {copiado ? 'Copiado ✓' : 'Copiar código Pix'}
              </Botao>
            </div>
          </div>
        ) : (
          <Mensagem tipo="info">
            Abra o app do seu banco e pague o Pix que você copiou na tela anterior.
          </Mensagem>
        )}
        <p className={a.aguardando} role="status">
          <span className={a.pulso} aria-hidden="true" /> Aguardando o pagamento…
        </p>
        {podeSimularPix ? (
          <div className={a.dev}>
            <span>Ambiente de teste</span>
            <Botao variante="secundario" onClick={simularPagamento} disabled={simulando}>
              {simulando ? 'Pagando…' : 'Simular pagamento do Pix'}
            </Botao>
          </div>
        ) : null}
        {erro ? <Mensagem tipo="erro">{erro}</Mensagem> : null}
      </Moldura>
    )
  }

  const s = situacao
  const quando = `${dataLonga(s.inicio, fuso)}, ${hora(s.inicio, fuso)}`
  const titulo: Record<string, string> = {
    confirmado: 'Agendamento confirmado',
    reservado: 'Horário reservado',
    em_atendimento: 'Atendimento em andamento',
    concluido: 'Atendimento concluído',
    liberado: 'Horário liberado',
    no_show: 'Você não compareceu',
    cancelado_no_prazo: 'Agendamento cancelado',
    cancelado_fora_do_prazo: 'Agendamento cancelado',
    cancelado_pela_barbearia: 'Cancelado pela barbearia',
  }
  const cartao = `Cartão final ${s.cartaoFinal ?? '····'}`
  const pagamento =
    s.valorPagoCentavos === 0
      ? 'Sem cobrança'
      : s.meio === 'pix'
        ? `Pix de ${reais(s.valorPagoCentavos)} pago`
        : s.status === 'reservado' && s.preAutorizarEm && s.cobrancaEm
          ? `${cartao}: validado em ${dataLonga(s.preAutorizarEm, fuso)} e cobrado em ${dataLonga(s.cobrancaEm, fuso)}, ${hora(s.cobrancaEm, fuso)}`
          : s.cobrancaEm
            ? `${cartao} garantido: ${reais(s.valorPagoCentavos)} cobrados em ${dataLonga(s.cobrancaEm, fuso)}, ${hora(s.cobrancaEm, fuso)}`
            : cartao

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Navalha//Agendamento//PT',
    'BEGIN:VEVENT',
    `UID:${s.id}@navalha.app`,
    `DTSTAMP:${paraIcs(s.inicio)}`,
    `DTSTART:${paraIcs(s.inicio)}`,
    `DTEND:${paraIcs(s.fim)}`,
    `SUMMARY:${s.servicos.join(' + ')} · ${barbearia.nome}`,
    `LOCATION:${barbearia.endereco}`,
    `DESCRIPTION:Código ${s.codigo}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
  const ativo = s.status === 'confirmado' || s.status === 'reservado'

  return (
    <Moldura topo={voltar}>
      <p className={a.selo} data-status={s.status}>
        {s.status === 'confirmado' ? '✓ ' : ''}
        {titulo[s.status] ?? 'Agendamento'}
      </p>
      <h1>{quando}</h1>
      <dl className={f.revisao}>
        <div>
          <dt>Código</dt>
          <dd className="mono">{s.codigo}</dd>
        </div>
        <div>
          <dt>Serviços</dt>
          <dd>{s.servicos.join(' + ')}</dd>
        </div>
        <div>
          <dt>Profissional</dt>
          <dd>{s.barbeiro}</dd>
        </div>
        <div>
          <dt>Onde</dt>
          <dd>
            {barbearia.nome}
            {barbearia.endereco ? ` · ${barbearia.endereco}` : ''}
          </dd>
        </div>
        <div>
          <dt>Pagamento</dt>
          <dd>{pagamento}</dd>
        </div>
      </dl>
      {s.status === 'reservado' ? (
        <Mensagem tipo="info">
          Nada foi cobrado ainda. Se a validação do cartão falhar, avisamos e você tem 12 horas para
          trocar o cartão ou pagar com Pix.
        </Mensagem>
      ) : null}
      {s.regularizarAte ? (
        <Mensagem tipo="erro">
          Não conseguimos validar o seu cartão. Regularize até {hora(s.regularizarAte, fuso)} de{' '}
          {dataLonga(s.regularizarAte, fuso)} para manter o horário.
        </Mensagem>
      ) : null}
      {ativo ? (
        <p className={f.suave}>
          Cancelamento grátis até {dataLonga(s.prazoGratisAte, fuso)},{' '}
          {hora(s.prazoGratisAte, fuso)}.
        </p>
      ) : null}
      <div className={f.acoes} style={{ justifyContent: 'flex-start' }}>
        {ativo ? (
          <a
            className={a.botao}
            href={`data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`}
            download={`navalha-${s.codigo}.ics`}
          >
            Adicionar ao calendário
          </a>
        ) : null}
        {barbearia.whatsapp ? (
          <a
            className={a.botaoSecundario}
            href={barbearia.whatsapp}
            target="_blank"
            rel="noreferrer"
          >
            Falar com a barbearia
          </a>
        ) : null}
      </div>
      {/* Depois do primeiro agendamento pela web, sugere o app (Fluxo do dono até o cliente). */}
      {ativo ? (
        <div className={a.app}>
          <strong>Baixe o app Navalha</strong>
          <p>Para remarcar, cancelar e receber o lembrete 1 hora antes, sem precisar deste link.</p>
          {lojas.appStore || lojas.playStore ? (
            <div className={f.acoes} style={{ justifyContent: 'flex-start' }}>
              {lojas.appStore ? (
                <a className={a.botaoSecundario} href={lojas.appStore}>
                  App Store
                </a>
              ) : null}
              {lojas.playStore ? (
                <a className={a.botaoSecundario} href={lojas.playStore}>
                  Google Play
                </a>
              ) : null}
            </div>
          ) : (
            <p className={f.suave}>Em breve na App Store e no Google Play.</p>
          )}
        </div>
      ) : null}
    </Moldura>
  )
}

function paraIcs(iso: string): string {
  return iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function Moldura({ topo, children }: { topo: ReactNode; children: ReactNode }) {
  return (
    <div className={f.pagina}>
      <header className={f.topo}>{topo}</header>
      <main className={f.conteudo}>
        <section className={f.secao}>{children}</section>
      </main>
    </div>
  )
}
