import 'server-only'
import { instanteLocal, partesLocais, type StatusAgendamento } from '@navalha/core'
import { somarDias } from '@/lib/agenda'
import { barbeariaDoPainel } from '@/lib/painel'
import type { AtendimentoDoRelatorio } from '@/lib/relatorio'

// Dados do relatório (página e CSV usam a mesma consulta e os mesmos filtros).
// ?de=YYYY-MM-DD&ate=YYYY-MM-DD&barbeiro=id&servicos=id1,id2

type Parametros = Record<string, string | string[] | undefined>

const STATUS_DO_RELATORIO: StatusAgendamento[] = [
  'concluido',
  'no_show',
  'cancelado_no_prazo',
  'cancelado_fora_do_prazo',
  'cancelado_pela_barbearia',
]

export async function dadosDoRelatorio(parametros: Parametros) {
  const { supabase, barbearia, papel } = await barbeariaDoPainel()
  const fuso = barbearia.fuso
  const hoje = partesLocais(new Date(), fuso).data
  const texto = (chave: string) => {
    const valor = parametros[chave]
    return typeof valor === 'string' ? valor : undefined
  }
  const data = (valor?: string) => (valor && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : undefined)
  const ate = data(texto('ate')) ?? hoje
  const de = data(texto('de')) ?? somarDias(ate, -29)
  const barbeiroId = texto('barbeiro') || undefined
  const servicoIds = (texto('servicos') ?? '').split(',').filter(Boolean)

  const [membros, perfis, servicos, agendamentos] = await Promise.all([
    supabase.from('membros').select('id, papel').eq('barbearia_id', barbearia.id),
    supabase
      .from('perfis_profissionais')
      .select('membro_id, nome_exibicao')
      .eq('barbearia_id', barbearia.id),
    supabase
      .from('servicos')
      .select('id, nome, ativo')
      .eq('barbearia_id', barbearia.id)
      .order('ordem'),
    supabase
      .from('agendamentos')
      .select(
        'id, codigo, inicio, status, barbeiro_id, valor_pago_centavos, origem, clientes(nome), agendamento_servicos(servico_id, nome, preco_centavos)',
      )
      .eq('barbearia_id', barbearia.id)
      .gte('inicio', instanteLocal(de, 0, fuso).toISOString())
      .lt('inicio', instanteLocal(somarDias(ate, 1), 0, fuso).toISOString())
      .in('status', STATUS_DO_RELATORIO)
      .order('inicio'),
  ])

  const nomes = new Map((perfis.data ?? []).map((p) => [p.membro_id, p.nome_exibicao]))
  const barbeiros = (membros.data ?? []).map((m) => ({
    id: m.id,
    nome: nomes.get(m.id) ?? (m.papel === 'dono' ? 'Dono' : 'Barbeiro'),
  }))
  const lista = (agendamentos.data ?? []).map((a) => ({
    id: a.id,
    codigo: a.codigo,
    inicio: a.inicio,
    status: a.status as StatusAgendamento,
    barbeiroId: a.barbeiro_id,
    valorPagoCentavos: a.valor_pago_centavos,
    origem: a.origem,
    cliente: a.clientes?.nome ?? 'Cliente',
    servicos: a.agendamento_servicos.map((s) => ({
      servicoId: s.servico_id,
      nome: s.nome,
      precoCentavos: s.preco_centavos,
    })),
  }))
  const atendimentos: AtendimentoDoRelatorio[] = lista.map((a) => ({
    data: partesLocais(new Date(a.inicio), fuso).data,
    status: a.status,
    barbeiroId: a.barbeiroId,
    servicos: a.servicos,
  }))

  return {
    barbearia,
    papel,
    hoje,
    filtros: { de, ate, ...(barbeiroId ? { barbeiroId } : {}), servicoIds },
    barbeiros,
    servicos: servicos.data ?? [],
    lista,
    atendimentos,
  }
}
