import { instanteLocal, minutos, partesLocais, type StatusAgendamento } from '@navalha/core'
import Link from 'next/link'
import { BarrasHorizontais, GraficoDeColunas } from '@/componentes/graficos'
import { BotaoLink, Cartao, Etiqueta, Vazio } from '@/componentes/ui'
import { hora, reais, variacao } from '@/lib/formato'
import { barbeariaDoPainel } from '@/lib/painel'
import { ATIVOS, diasAntes, STATUS } from '@/lib/status'
import d from './dashboard.module.css'
import s from './painel.module.css'

// Figma Admin 01 · Dashboard. Leitura com o RLS do dono. "Próximas 3h" parte do relógio real
// (backlog Admin · Todas as telas: status batendo com o relógio).

export default async function Dashboard() {
  const { supabase, barbearia } = await barbeariaDoPainel()
  const fuso = barbearia.fuso
  const agora = new Date()
  const hoje = partesLocais(agora, fuso)
  const inicio30 = instanteLocal(diasAntes(hoje.data, 29), 0, fuso)
  const inicio60 = instanteLocal(diasAntes(hoje.data, 59), 0, fuso)
  const fimDeHoje = instanteLocal(hoje.data, 24 * 60, fuso)

  const [{ data: agendamentos }, { data: avaliacoes }, { data: equipe }, { data: turnos }] =
    await Promise.all([
      supabase
        .from('agendamentos')
        .select('id, inicio, fim, status, valor_pago_centavos, barbeiro_id')
        .eq('barbearia_id', barbearia.id)
        .gte('inicio', inicio60.toISOString())
        .lt('inicio', fimDeHoje.toISOString()),
      supabase.from('avaliacoes').select('nota').eq('barbearia_id', barbearia.id),
      supabase
        .from('perfis_profissionais')
        .select('membro_id, nome_exibicao')
        .eq('barbearia_id', barbearia.id),
      supabase
        .from('horarios_atendimento')
        .select('membro_id, inicio, fim, pausa_inicio, pausa_fim')
        .eq('barbearia_id', barbearia.id)
        .eq('dia_semana', hoje.diaSemana),
    ])

  const lista = agendamentos ?? []
  const noPeriodo = (inicio: Date, fim: Date) =>
    lista.filter((a) => new Date(a.inicio) >= inicio && new Date(a.inicio) < fim)
  const atual = noPeriodo(inicio30, fimDeHoje)
  const anterior = noPeriodo(inicio60, inicio30)
  const receita = (itens: typeof lista) =>
    itens.filter((a) => a.status === 'concluido').reduce((t, a) => t + a.valor_pago_centavos, 0)
  const validos = (itens: typeof lista) => itens.filter((a) => a.status !== 'liberado').length

  const receitaAtual = receita(atual)
  const receitaAnterior = receita(anterior)
  const notas = (avaliacoes ?? []).map((a) => a.nota)
  const mediaNotas = notas.length ? notas.reduce((t, n) => t + n, 0) / notas.length : null

  // Receita por dia (concluídos), nos últimos 30 dias, no fuso da barbearia.
  const porDia = new Map<string, number>()
  for (let i = 29; i >= 0; i--) porDia.set(diasAntes(hoje.data, i), 0)
  for (const a of atual) {
    if (a.status !== 'concluido') continue
    const dia = partesLocais(new Date(a.inicio), fuso).data
    porDia.set(dia, (porDia.get(dia) ?? 0) + a.valor_pago_centavos)
  }

  // Ocupação de hoje por barbeiro: minutos agendados / minutos de expediente.
  const nomeDe = new Map((equipe ?? []).map((p) => [p.membro_id, p.nome_exibicao]))
  const ocupacao = (turnos ?? []).map((t) => {
    const disponivel =
      minutos(t.fim.slice(0, 5)) -
      minutos(t.inicio.slice(0, 5)) -
      (t.pausa_inicio && t.pausa_fim
        ? minutos(t.pausa_fim.slice(0, 5)) - minutos(t.pausa_inicio.slice(0, 5))
        : 0)
    const ocupado = lista
      .filter(
        (a) =>
          a.barbeiro_id === t.membro_id &&
          partesLocais(new Date(a.inicio), fuso).data === hoje.data &&
          ![
            'cancelado_no_prazo',
            'cancelado_fora_do_prazo',
            'cancelado_pela_barbearia',
            'liberado',
          ].includes(a.status),
      )
      .reduce(
        (total, a) => total + (new Date(a.fim).getTime() - new Date(a.inicio).getTime()) / 60_000,
        0,
      )
    return {
      rotulo: nomeDe.get(t.membro_id) ?? 'Barbeiro',
      valor: disponivel > 0 ? Math.round((ocupado / disponivel) * 100) : 0,
      ocupado,
      disponivel,
    }
  })
  const ocupacaoTotal = ocupacao.reduce((t, o) => t + o.disponivel, 0)
  const ocupacaoHoje = ocupacaoTotal
    ? Math.round((ocupacao.reduce((t, o) => t + o.ocupado, 0) / ocupacaoTotal) * 100)
    : null

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
          .select(
            'id, codigo, inicio, status, barbeiro_id, clientes(nome), agendamento_servicos(nome)',
          )
          .in('id', proximosIds)
          .order('inicio')
      : Promise.resolve({ data: [] }),
    concluidosIds.length
      ? supabase.from('agendamento_servicos').select('nome').in('agendamento_id', concluidosIds)
      : Promise.resolve({ data: [] as { nome: string }[] }),
  ])
  const contagem = new Map<string, number>()
  for (const s of servicosFeitos ?? []) contagem.set(s.nome, (contagem.get(s.nome) ?? 0) + 1)
  const maisPedidos = [...contagem.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([rotulo, valor]) => ({ rotulo, valor }))

  const indicadores = [
    {
      rotulo: 'Receita',
      valor: reais(receitaAtual),
      delta: variacao(receitaAtual, receitaAnterior),
    },
    {
      rotulo: 'Agendamentos',
      valor: String(validos(atual)),
      delta: variacao(validos(atual), validos(anterior)),
    },
    {
      rotulo: 'Ocupação de hoje',
      valor: ocupacaoHoje === null ? '—' : `${ocupacaoHoje}%`,
      delta: null,
    },
    {
      rotulo: 'Avaliação média',
      valor:
        mediaNotas === null
          ? '—'
          : mediaNotas.toLocaleString('pt-BR', {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            }),
      delta: notas.length
        ? `${notas.length} ${notas.length === 1 ? 'avaliação' : 'avaliações'}`
        : null,
    },
  ]

  return (
    <>
      <div className={s.cabecalhoPagina}>
        <div>
          <h1>Dashboard</h1>
          <p>Visão geral dos últimos 30 dias, comparada aos 30 dias anteriores.</p>
        </div>
        <div className={s.acoes}>
          <BotaoLink href="/painel/agenda?novo=1">Novo agendamento</BotaoLink>
        </div>
      </div>

      {!barbearia.recebimentos_ativos_em ? (
        <Cartao className={d.aviso}>
          <strong>Ative os recebimentos para receber agendamentos online.</strong>
          <span>Sem isso a página da barbearia não aceita agendamentos pagos.</span>
          <BotaoLink href="/painel/configuracoes" variante="secundario">
            Ativar recebimentos
          </BotaoLink>
        </Cartao>
      ) : null}

      <div className={d.indicadores}>
        {indicadores.map((i) => (
          <Cartao key={i.rotulo}>
            <p className={d.indicadorRotulo}>{i.rotulo}</p>
            <p className={d.indicadorValor}>{i.valor}</p>
            {i.delta ? (
              <p className={d.indicadorDelta}>
                {i.delta} {i.rotulo === 'Avaliação média' ? '' : 'vs. período anterior'}
              </p>
            ) : null}
          </Cartao>
        ))}
      </div>

      <div className={d.grade}>
        <Cartao>
          <div className={d.cartaoTopo}>
            <div>
              <h2>Receita</h2>
              <p>Atendimentos concluídos, por dia</p>
            </div>
            <strong className="mono">{reais(receitaAtual)}</strong>
          </div>
          <GraficoDeColunas
            titulo="Receita por dia nos últimos 30 dias"
            pontos={[...porDia.entries()].map(([dia, valor]) => ({
              rotulo: `${dia.slice(8, 10)}/${dia.slice(5, 7)}`,
              valor,
              detalhe: new Date(`${dia}T12:00:00Z`).toLocaleDateString('pt-BR', {
                weekday: 'short',
                day: '2-digit',
                month: 'short',
              }),
            }))}
            formato="reais"
          />
        </Cartao>

        <Cartao>
          <div className={d.cartaoTopo}>
            <div>
              <h2>Próximas 3h</h2>
              <p>
                {hora(agora, fuso)} – {hora(em3h, fuso)} · hoje
              </p>
            </div>
            <Etiqueta>{(proximos ?? []).length} atendimentos</Etiqueta>
          </div>
          {(proximos ?? []).length === 0 ? (
            <Vazio titulo="Nada nas próximas 3 horas">
              <Link href="/painel/agenda">Ver a agenda</Link>
            </Vazio>
          ) : (
            <ul className={d.proximos}>
              {(proximos ?? []).map((p) => {
                const status = STATUS[p.status as StatusAgendamento]
                return (
                  <li key={p.id}>
                    <span className="mono">{hora(p.inicio, fuso)}</span>
                    <span>
                      <strong>{p.clientes?.nome ?? 'Cliente'}</strong>
                      <span>
                        {p.agendamento_servicos.map((x) => x.nome).join(', ')} ·{' '}
                        {nomeDe.get(p.barbeiro_id) ?? 'Barbeiro'}
                      </span>
                    </span>
                    <Etiqueta tom={status.tom}>{status.rotulo}</Etiqueta>
                  </li>
                )
              })}
            </ul>
          )}
        </Cartao>

        <Cartao>
          <div className={d.cartaoTopo}>
            <div>
              <h2>Ocupação por barbeiro</h2>
              <p>Hoje · horários preenchidos</p>
            </div>
          </div>
          {ocupacao.length ? (
            <BarrasHorizontais itens={ocupacao} maximo={100} formato="percentual" />
          ) : (
            <Vazio titulo="Ninguém atende hoje" />
          )}
        </Cartao>

        <Cartao>
          <div className={d.cartaoTopo}>
            <div>
              <h2>Serviços mais pedidos</h2>
              <p>Últimos 30 dias</p>
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
