import { instanteLocal, minutos, partesLocais, type StatusAgendamento } from '@navalha/core'
import { ArrowDown, ArrowUp, CalendarCheck, Gauge, Plus, Star, Wallet } from 'lucide-react'
import Link from 'next/link'
import { BarrasHorizontais, GraficoDeColunas } from '@/componentes/graficos'
import { Avatar, BotaoLink, Cartao, Etiqueta, Vazio } from '@/componentes/ui'
import { diaDaSemana } from '@/lib/agenda'
import { diaPorExtenso, hora, variacaoPct } from '@/lib/formato'
import { barbeariaDoPainel } from '@/lib/painel'
import { ATIVOS, diasAntes, STATUS } from '@/lib/status'
import d from './dashboard.module.css'
import s from './painel.module.css'
import { SeletorDePeriodo } from './periodo'

// Figma Admin 01 · Dashboard. Leitura com o RLS do dono. "Próximas 3h" parte do relógio real
// (backlog Admin · Todas as telas: status batendo com o relógio). ?periodo=7|30|90

const FORA_DA_AGENDA = [
  'cancelado_no_prazo',
  'cancelado_fora_do_prazo',
  'cancelado_pela_barbearia',
  'liberado',
]

export default async function Dashboard({ searchParams }: PageProps<'/painel'>) {
  const { periodo } = await searchParams
  const dias = periodo === '7' ? 7 : periodo === '90' ? 90 : 30
  const { supabase, barbearia } = await barbeariaDoPainel()
  const fuso = barbearia.fuso
  const agora = new Date()
  const hoje = partesLocais(agora, fuso)
  const inicioAtual = instanteLocal(diasAntes(hoje.data, dias - 1), 0, fuso)
  const inicioAnterior = instanteLocal(diasAntes(hoje.data, 2 * dias - 1), 0, fuso)
  const fimDeHoje = instanteLocal(hoje.data, 24 * 60, fuso)

  const [{ data: agendamentos }, { data: avaliacoes }, { data: equipe }, { data: turnos }] =
    await Promise.all([
      supabase
        .from('agendamentos')
        .select('id, inicio, fim, status, valor_pago_centavos, barbeiro_id')
        .eq('barbearia_id', barbearia.id)
        .gte('inicio', inicioAnterior.toISOString())
        .lt('inicio', fimDeHoje.toISOString()),
      supabase.from('avaliacoes').select('nota, criada_em').eq('barbearia_id', barbearia.id),
      supabase
        .from('perfis_profissionais')
        .select('membro_id, nome_exibicao')
        .eq('barbearia_id', barbearia.id),
      supabase
        .from('horarios_atendimento')
        .select('membro_id, dia_semana, inicio, fim, pausa_inicio, pausa_fim')
        .eq('barbearia_id', barbearia.id),
    ])

  const lista = agendamentos ?? []
  const noPeriodo = (inicio: Date, fim: Date) =>
    lista.filter((a) => new Date(a.inicio) >= inicio && new Date(a.inicio) < fim)
  const atual = noPeriodo(inicioAtual, fimDeHoje)
  const anterior = noPeriodo(inicioAnterior, inicioAtual)
  const receita = (itens: typeof lista) =>
    itens.filter((a) => a.status === 'concluido').reduce((t, a) => t + a.valor_pago_centavos, 0)
  const validos = (itens: typeof lista) => itens.filter((a) => a.status !== 'liberado').length
  const duracao = (a: { inicio: string; fim: string }) =>
    (new Date(a.fim).getTime() - new Date(a.inicio).getTime()) / 60_000

  // Ocupação: minutos agendados / minutos de expediente da equipe nos dias do período.
  const expedienteDoTurno = (t: NonNullable<typeof turnos>[number]) =>
    minutos(t.fim.slice(0, 5)) -
    minutos(t.inicio.slice(0, 5)) -
    (t.pausa_inicio && t.pausa_fim
      ? minutos(t.pausa_fim.slice(0, 5)) - minutos(t.pausa_inicio.slice(0, 5))
      : 0)
  const porDiaDaSemana = new Map<number, number>()
  for (const t of turnos ?? [])
    porDiaDaSemana.set(t.dia_semana, (porDiaDaSemana.get(t.dia_semana) ?? 0) + expedienteDoTurno(t))
  const ocupacaoDe = (itens: typeof lista, ultimoDia: string) => {
    let disponivel = 0
    for (let i = 0; i < dias; i++)
      disponivel += porDiaDaSemana.get(diaDaSemana(diasAntes(ultimoDia, i))) ?? 0
    const ocupado = itens
      .filter((a) => !FORA_DA_AGENDA.includes(a.status))
      .reduce((t, a) => t + duracao(a), 0)
    return disponivel ? Math.round((ocupado / disponivel) * 100) : null
  }
  const ocupacaoAtual = ocupacaoDe(atual, hoje.data)
  const ocupacaoAnterior = ocupacaoDe(anterior, diasAntes(hoje.data, dias))

  // Avaliação: a média geral (a que o cliente vê) hoje e no fim do período anterior.
  const media = (notas: number[]) =>
    notas.length ? notas.reduce((t, n) => t + n, 0) / notas.length : null
  const todas = avaliacoes ?? []
  const mediaAtual = media(todas.map((a) => a.nota))
  const mediaAnterior = media(
    todas.filter((a) => new Date(a.criada_em) < inicioAtual).map((a) => a.nota),
  )

  // Receita por dia (concluídos), no fuso da barbearia. Sábado em destaque; hoje ainda parcial.
  const porDia = new Map<string, number>()
  for (let i = dias - 1; i >= 0; i--) porDia.set(diasAntes(hoje.data, i), 0)
  for (const a of atual) {
    if (a.status !== 'concluido') continue
    const dia = partesLocais(new Date(a.inicio), fuso).data
    porDia.set(dia, (porDia.get(dia) ?? 0) + a.valor_pago_centavos)
  }
  const receitaAtual = receita(atual)

  // Ocupação de hoje por barbeiro.
  const nomeDe = new Map((equipe ?? []).map((p) => [p.membro_id, p.nome_exibicao]))
  const ocupacao = (turnos ?? [])
    .filter((t) => t.dia_semana === hoje.diaSemana)
    .map((t) => {
      const disponivel = expedienteDoTurno(t)
      const ocupado = lista
        .filter(
          (a) =>
            a.barbeiro_id === t.membro_id &&
            partesLocais(new Date(a.inicio), fuso).data === hoje.data &&
            !FORA_DA_AGENDA.includes(a.status),
        )
        .reduce((total, a) => total + duracao(a), 0)
      return {
        rotulo: nomeDe.get(t.membro_id) ?? 'Barbeiro',
        valor: disponivel > 0 ? Math.round((ocupado / disponivel) * 100) : 0,
      }
    })
    .sort((a, b) => b.valor - a.valor)

  // Próximas 3 horas e serviços mais pedidos.
  const em3h = new Date(agora.getTime() + 3 * 3_600_000)
  const proximosIds = lista
    .filter(
      (a) =>
        ATIVOS.includes(a.status as StatusAgendamento) &&
        new Date(a.inicio) >= agora &&
        new Date(a.inicio) <= em3h,
    )
    .map((a) => a.id)
  const concluidosIds = atual.filter((a) => a.status === 'concluido').map((a) => a.id)
  const [{ data: proximos }, { data: servicosFeitos }] = await Promise.all([
    proximosIds.length
      ? supabase
          .from('agendamentos')
          .select('id, inicio, status, barbeiro_id, clientes(nome), agendamento_servicos(nome)')
          .in('id', proximosIds)
          .order('inicio')
      : Promise.resolve({ data: [] }),
    concluidosIds.length
      ? supabase.from('agendamento_servicos').select('nome').in('agendamento_id', concluidosIds)
      : Promise.resolve({ data: [] as { nome: string }[] }),
  ])
  const contagem = new Map<string, number>()
  for (const x of servicosFeitos ?? []) contagem.set(x.nome, (contagem.get(x.nome) ?? 0) + 1)
  const maisPedidos = [...contagem.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([rotulo, valor]) => ({ rotulo, valor }))

  const indicadores: {
    rotulo: string
    icone: typeof Wallet
    valor: string
    delta: { valor: number; texto: string } | null
  }[] = [
    {
      rotulo: 'Receita',
      icone: Wallet,
      valor: reaisInteiros(receitaAtual),
      delta: percentual(variacaoPct(receitaAtual, receita(anterior))),
    },
    {
      rotulo: 'Agendamentos',
      icone: CalendarCheck,
      valor: validos(atual).toLocaleString('pt-BR'),
      delta: percentual(variacaoPct(validos(atual), validos(anterior))),
    },
    {
      rotulo: 'Ocupação da agenda',
      icone: Gauge,
      valor: ocupacaoAtual === null ? '—' : `${ocupacaoAtual}%`,
      delta:
        ocupacaoAtual === null || ocupacaoAnterior === null
          ? null
          : {
              valor: ocupacaoAtual - ocupacaoAnterior,
              texto: `${Math.abs(ocupacaoAtual - ocupacaoAnterior)} pp`,
            },
    },
    {
      rotulo: 'Avaliação média',
      icone: Star,
      valor: mediaAtual === null ? '—' : umaCasa(mediaAtual),
      delta:
        mediaAtual === null || mediaAnterior === null
          ? null
          : {
              valor: Math.round((mediaAtual - mediaAnterior) * 10) / 10,
              texto: umaCasa(Math.abs(Math.round((mediaAtual - mediaAnterior) * 10) / 10)),
            },
    },
  ]

  return (
    <>
      <div className={s.cabecalhoPagina}>
        <div>
          <h1>Dashboard</h1>
          <p>{diaPorExtenso(agora, fuso)} · visão geral da barbearia</p>
        </div>
        <div className={s.acoes}>
          <SeletorDePeriodo dias={dias} />
          <BotaoLink href="/painel/agenda?novo=1" variante="secundario">
            Novo agendamento
            <Plus size={18} strokeWidth={1.75} aria-hidden />
          </BotaoLink>
        </div>
      </div>

      <div className={d.indicadores}>
        {indicadores.map((i) => {
          const Icone = i.icone
          return (
            <Cartao key={i.rotulo} className={d.indicador}>
              <p className={d.indicadorRotulo}>
                {i.rotulo}
                <Icone size={18} strokeWidth={1.5} aria-hidden />
              </p>
              <p className={d.indicadorValor}>{i.valor}</p>
              {i.delta ? (
                <p className={d.indicadorDelta}>
                  <span
                    className={d.delta}
                    data-sentido={
                      i.delta.valor > 0 ? 'alta' : i.delta.valor < 0 ? 'baixa' : undefined
                    }
                  >
                    {i.delta.valor > 0 ? (
                      <ArrowUp size={12} strokeWidth={2} aria-label="alta de" />
                    ) : i.delta.valor < 0 ? (
                      <ArrowDown size={12} strokeWidth={2} aria-label="queda de" />
                    ) : null}
                    {i.delta.texto}
                  </span>
                  vs. período anterior
                </p>
              ) : (
                <p className={d.indicadorDelta}>Sem base para comparar</p>
              )}
            </Cartao>
          )
        })}
      </div>

      <div className={d.grade}>
        <Cartao className={d.cartao}>
          <div className={d.cartaoTopo}>
            <div>
              <h2>Receita</h2>
              <p>
                Últimos {dias} dias · média {reaisInteiros(Math.round(receitaAtual / dias))}/dia
              </p>
            </div>
            <strong className={d.total}>{reaisInteiros(receitaAtual)}</strong>
          </div>
          <GraficoDeColunas
            titulo={`Receita por dia nos últimos ${dias} dias`}
            pontos={[...porDia.entries()].map(([dia, valor]) => {
              const meioDia = new Date(`${dia}T12:00:00Z`)
              return {
                rotulo: meioDia
                  .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' })
                  .replace(' de ', ' ')
                  .replace('.', ''),
                valor,
                detalhe: meioDia.toLocaleDateString('pt-BR', {
                  weekday: 'short',
                  day: '2-digit',
                  month: 'short',
                  timeZone: 'UTC',
                }),
                tom: dia === hoje.data ? 'atual' : diaDaSemana(dia) === 6 ? 'destaque' : 'base',
              }
            })}
            formato="reais"
            rotuloACada={dias === 7 ? 1 : 7}
            legenda={[
              { tom: 'base', rotulo: 'Dias de semana' },
              { tom: 'destaque', rotulo: 'Sábados' },
              { tom: 'atual', rotulo: 'Hoje (parcial)' },
            ]}
          />
        </Cartao>

        <Cartao className={d.cartao}>
          <div className={d.cartaoTopo}>
            <div>
              <h2>Próximas 3h</h2>
              <p>
                {hora(agora, fuso)} – {hora(em3h, fuso)} · hoje
              </p>
            </div>
            <Etiqueta>
              {(proximos ?? []).length}{' '}
              {(proximos ?? []).length === 1 ? 'atendimento' : 'atendimentos'}
            </Etiqueta>
          </div>
          {(proximos ?? []).length === 0 ? (
            <Vazio titulo="Nada nas próximas 3 horas">
              <Link href="/painel/agenda">Ver a agenda</Link>
            </Vazio>
          ) : (
            <ul className={d.proximos}>
              {(proximos ?? []).map((p) => {
                const status = STATUS[p.status as StatusAgendamento]
                const cliente = p.clientes?.nome ?? 'Cliente'
                const barbeiro = nomeDe.get(p.barbeiro_id) ?? 'Barbeiro'
                return (
                  <li key={p.id}>
                    <span className={d.proximoHora}>{hora(p.inicio, fuso)}</span>
                    <Avatar nome={cliente} tamanho={32} />
                    <span className={d.proximoCliente}>
                      <strong>{cliente}</strong>
                      <span>
                        {p.agendamento_servicos.map((x) => x.nome).join(' + ')} ·{' '}
                        {barbeiro.split(' ')[0]}
                      </span>
                    </span>
                    <Etiqueta tom={status.tom}>{status.rotulo}</Etiqueta>
                  </li>
                )
              })}
            </ul>
          )}
        </Cartao>
      </div>

      <div className={d.gradeDupla}>
        <Cartao className={d.cartao}>
          <div className={d.cartaoTopo}>
            <div>
              <h2>Ocupação por barbeiro</h2>
              <p>Hoje · horários preenchidos</p>
            </div>
          </div>
          {ocupacao.length ? (
            <BarrasHorizontais itens={ocupacao} maximo={100} formato="percentual" comAvatar />
          ) : (
            <Vazio titulo="Ninguém atende hoje" />
          )}
        </Cartao>

        <Cartao className={d.cartao}>
          <div className={d.cartaoTopo}>
            <div>
              <h2>Serviços mais pedidos</h2>
              <p>Últimos {dias} dias</p>
            </div>
          </div>
          {maisPedidos.length ? (
            <BarrasHorizontais itens={maisPedidos} formato="numero" />
          ) : (
            <Vazio titulo="Ainda sem atendimentos concluídos" />
          )}
        </Cartao>
      </div>
    </>
  )
}

/** "R$ 16.443": os indicadores do Figma arredondam para reais. */
function reaisInteiros(centavos: number): string {
  return `R$ ${Math.round(centavos / 100).toLocaleString('pt-BR')}`
}

function umaCasa(valor: number): string {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function percentual(pct: number | null): { valor: number; texto: string } | null {
  if (pct === null) return null
  return {
    valor: Math.round(pct * 10) / 10,
    texto: `${umaCasa(Math.abs(Math.round(pct * 10) / 10))}%`,
  }
}
