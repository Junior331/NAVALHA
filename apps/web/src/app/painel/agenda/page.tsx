import {
  instanteLocal,
  partesLocais,
  precoDoServico,
  type Desconto,
  type StatusAgendamento,
} from '@navalha/core'
import { diaDaSemana, semanaDe, somarDias } from '@/lib/agenda'
import { dataCurta, dataLonga } from '@/lib/formato'
import { barbeariaDoPainel } from '@/lib/painel'
import s from '../painel.module.css'
import { GradeDaAgenda } from './grade'
import { NovoAgendamento } from './novo'
import type { EventoDaAgenda } from './tipos'

// Figma Admin 02 (semana) e 02c (dia). ?data=YYYY-MM-DD&visao=dia|semana&barbeiro=id
export default async function Agenda({ searchParams }: PageProps<'/painel/agenda'>) {
  const parametros = await searchParams
  const { supabase, barbearia, papel } = await barbeariaDoPainel()
  const fuso = barbearia.fuso
  const agora = new Date()
  const hoje = partesLocais(agora, fuso).data
  const pedida =
    typeof parametros.data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parametros.data)
      ? parametros.data
      : hoje
  const visao = parametros.visao === 'semana' ? 'semana' : 'dia'
  const filtro = typeof parametros.barbeiro === 'string' ? parametros.barbeiro : null
  const dias = visao === 'semana' ? semanaDe(pedida) : [pedida]
  const primeiro = dias[0] ?? pedida
  const ultimo = dias[dias.length - 1] ?? pedida

  const [membros, perfis, horarios, agendamentos, servicos] = await Promise.all([
    supabase
      .from('membros')
      .select('id, papel')
      .eq('barbearia_id', barbearia.id)
      .eq('ativo', true)
      .order('papel', { ascending: false }),
    supabase
      .from('perfis_profissionais')
      .select('membro_id, nome_exibicao')
      .eq('barbearia_id', barbearia.id),
    supabase
      .from('horarios_barbearia')
      .select('dia_semana, abre, fecha')
      .eq('barbearia_id', barbearia.id),
    supabase
      .from('agendamentos')
      .select(
        'id, codigo, inicio, fim, status, barbeiro_id, valor_pago_centavos, pago_no_balcao, retencao_pct, tolerancia_ate, observacoes, clientes(nome, celular, usuario_id), agendamento_servicos(nome), pagamentos(meio, status, cartao_final, capturar_em)',
      )
      .eq('barbearia_id', barbearia.id)
      .gte('inicio', instanteLocal(primeiro, 0, fuso).toISOString())
      .lt('inicio', instanteLocal(somarDias(ultimo, 1), 0, fuso).toISOString())
      .neq('status', 'liberado')
      .order('inicio'),
    supabase
      .from('servicos')
      .select('id, nome, duracao_min, preco_centavos, desconto_tipo, desconto_valor')
      .eq('barbearia_id', barbearia.id)
      .eq('ativo', true)
      .order('ordem'),
  ])

  const nomes = new Map((perfis.data ?? []).map((p) => [p.membro_id, p.nome_exibicao]))
  const barbeiros = (membros.data ?? []).map((m) => ({
    id: m.id,
    nome: nomes.get(m.id) ?? (m.papel === 'dono' ? 'Dono' : 'Barbeiro'),
  }))

  const eventos: EventoDaAgenda[] = (agendamentos.data ?? []).map((a) => {
    const pagamento = Array.isArray(a.pagamentos) ? a.pagamentos[0] : a.pagamentos
    return {
      id: a.id,
      codigo: a.codigo,
      inicio: a.inicio,
      fim: a.fim,
      status: a.status as StatusAgendamento,
      barbeiroId: a.barbeiro_id,
      cliente: {
        nome: a.clientes?.nome ?? 'Cliente',
        celular: a.clientes?.celular ?? null,
        temApp: Boolean(a.clientes?.usuario_id),
      },
      servicos: a.agendamento_servicos.map((x) => x.nome),
      valorPagoCentavos: a.valor_pago_centavos,
      pagoNoBalcao: a.pago_no_balcao,
      retencaoPct: a.retencao_pct,
      toleranciaAte: a.tolerancia_ate,
      observacoes: a.observacoes,
      pagamento: pagamento
        ? {
            meio: pagamento.meio,
            status: pagamento.status,
            cartaoFinal: pagamento.cartao_final,
            capturarEm: pagamento.capturar_em,
          }
        : null,
    }
  })

  const diasDaSemana = new Set(dias.map(diaDaSemana))
  const expediente = (horarios.data ?? [])
    .filter((h) => diasDaSemana.has(h.dia_semana))
    .map((h) => ({ abre: h.abre.slice(0, 5), fecha: h.fecha.slice(0, 5) }))

  const doBalcao = (servicos.data ?? []).map((x) => {
    const desconto: Desconto | null =
      x.desconto_tipo === 'percentual'
        ? { tipo: 'percentual', pct: x.desconto_valor ?? 0 }
        : x.desconto_tipo === 'fixo'
          ? { tipo: 'fixo', valor: x.desconto_valor ?? 0 }
          : null
    return {
      id: x.id,
      nome: x.nome,
      duracaoMin: x.duracao_min,
      precoCentavos: precoDoServico(x.preco_centavos, desconto),
    }
  })

  const ativos = eventos.filter(
    (e) =>
      ['reservado', 'confirmado', 'em_atendimento', 'concluido'].includes(e.status) &&
      (!filtro || e.barbeiroId === filtro),
  ).length
  const meioDia = (data: string) => instanteLocal(data, 12 * 60, fuso)
  const contexto = {
    barbeariaId: barbearia.id,
    barbeariaNome: barbearia.nome,
    fuso,
    hoje,
    agora: agora.toISOString(),
    barbeiros,
  }

  return (
    <>
      <div className={s.cabecalhoPagina}>
        <div>
          <h1>Agenda</h1>
          <p>
            {visao === 'dia'
              ? dataLonga(meioDia(pedida), fuso)
              : `Semana de ${dataCurta(meioDia(primeiro), fuso)} a ${dataCurta(meioDia(ultimo), fuso)}`}
            {' · '}
            {ativos} agendamento{ativos === 1 ? '' : 's'}
          </p>
        </div>
        <NovoAgendamento
          contexto={contexto}
          servicos={doBalcao}
          dataInicial={pedida < hoje ? hoje : pedida}
        />
      </div>
      <GradeDaAgenda
        contexto={contexto}
        visao={visao}
        data={pedida}
        dias={dias}
        filtro={filtro}
        eventos={eventos}
        expediente={expediente}
        verPagamento={papel === 'dono'}
      />
    </>
  )
}
