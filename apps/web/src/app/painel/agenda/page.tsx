import {
  instanteLocal,
  partesLocais,
  precoDoServico,
  type Desconto,
  type StatusAgendamento,
} from '@navalha/core'
import { diaDaSemana, semanaDe, somarDias } from '@/lib/agenda'
import { barbeariaDoPainel } from '@/lib/painel'
import { GradeDaAgenda } from './grade'
import { NovoAgendamento } from './novo'
import type { EventoDaAgenda } from './tipos'

// Figma Admin 02 (semana) e 02c (dia).
// ?data=YYYY-MM-DD&visao=dia|semana&status=grupos&barbeiro=ids&evento=id&novo=1
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
  const visao = parametros.visao === 'dia' ? 'dia' : 'semana'
  const lista = (valor: string | string[] | undefined) =>
    typeof valor === 'string' && valor ? valor.split(',') : null
  const semana = visao === 'semana' ? semanaDe(pedida) : [pedida]
  const primeiro = semana[0] ?? pedida
  const ultimo = semana[semana.length - 1] ?? pedida

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
        'id, codigo, inicio, fim, status, barbeiro_id, valor_pago_centavos, pago_no_balcao, retencao_pct, tolerancia_ate, observacoes, clientes(nome, celular, usuario_id), agendamento_servicos(nome, preco_centavos), pagamentos(meio, status, cartao_final, capturar_em)',
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
      valorCentavos: a.agendamento_servicos.reduce((t, x) => t + x.preco_centavos, 0),
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

  // Na semana, só os dias em que a barbearia abre (ou que têm encaixe do balcão), como no Figma.
  const abertos = new Set((horarios.data ?? []).map((h) => h.dia_semana))
  const comEventos = new Set(eventos.map((e) => partesLocais(new Date(e.inicio), fuso).data))
  const dias =
    visao === 'dia'
      ? semana
      : semana.filter((d) => abertos.has(diaDaSemana(d)) || comEventos.has(d) || d === pedida)
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

  const contexto = {
    barbeariaId: barbearia.id,
    barbeariaNome: barbearia.nome,
    fuso,
    hoje,
    agora: agora.toISOString(),
    barbeiros,
  }

  return (
    <GradeDaAgenda
      contexto={contexto}
      visao={visao}
      data={pedida}
      dias={dias}
      gruposVisiveis={lista(parametros.status)}
      barbeirosVisiveis={lista(parametros.barbeiro)}
      eventoInicial={typeof parametros.evento === 'string' ? parametros.evento : null}
      eventos={eventos}
      expediente={expediente}
      verPagamento={papel === 'dono'}
      novo={
        <NovoAgendamento
          contexto={contexto}
          servicos={doBalcao}
          dataInicial={pedida < hoje ? hoje : pedida}
          abrirAoCarregar={parametros.novo === '1'}
        />
      }
    />
  )
}
