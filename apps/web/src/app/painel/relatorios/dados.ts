import 'server-only'
import { instanteLocal, partesLocais, type StatusAgendamento } from '@navalha/core'
import { somarDias } from '@/lib/agenda'
import { barbeariaDoPainel } from '@/lib/painel'
import {
  periodoDoRelatorio,
  type AtendimentoDoRelatorio,
  type EstadoDoRelatorio,
  type FiltroDoRelatorio,
  type Pagamento,
} from '@/lib/relatorio'

// Dados do relatório (página e CSV usam a mesma consulta e os mesmos filtros).
// ?periodo=hoje|semana|mes|trimestre|ano  ou  ?de=YYYY-MM-DD&ate=YYYY-MM-DD
// &barbeiros=ids&servicos=ids&pagamentos=pix,cartao,balcao&comparar=0&visao=barbeiro|servico|dia

type Parametros = Record<string, string | string[] | undefined>

const STATUS_DO_RELATORIO: StatusAgendamento[] = [
  'concluido',
  'no_show',
  'cancelado_no_prazo',
  'cancelado_fora_do_prazo',
  'cancelado_pela_barbearia',
]

const PAGAMENTOS: Pagamento[] = ['pix', 'cartao', 'balcao']

export async function dadosDoRelatorio(parametros: Parametros) {
  const { supabase, barbearia, papel } = await barbeariaDoPainel()
  const fuso = barbearia.fuso
  const hoje = partesLocais(new Date(), fuso).data
  const texto = (chave: string) => {
    const valor = parametros[chave]
    return typeof valor === 'string' ? valor : undefined
  }
  const lista = (chave: string) => (texto(chave) ?? '').split(',').filter(Boolean)
  const periodo = periodoDoRelatorio(
    { periodo: texto('periodo'), de: texto('de'), ate: texto('ate') },
    hoje,
  )
  const filtro: Required<FiltroDoRelatorio> = {
    barbeiroIds: lista('barbeiros'),
    servicoIds: lista('servicos'),
    pagamentos: lista('pagamentos').filter((p): p is Pagamento =>
      PAGAMENTOS.includes(p as Pagamento),
    ),
  }
  const visao: EstadoDoRelatorio['visao'] =
    (['servico', 'dia'] as const).find((v) => v === texto('visao')) ?? 'barbeiro'

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
        'id, codigo, inicio, status, barbeiro_id, valor_pago_centavos, origem, pago_no_balcao, clientes(nome), agendamento_servicos(servico_id, nome, preco_centavos), pagamentos(meio)',
      )
      .eq('barbearia_id', barbearia.id)
      .gte('inicio', instanteLocal(periodo.anterior.de, 0, fuso).toISOString())
      .lt('inicio', instanteLocal(somarDias(periodo.ate, 1), 0, fuso).toISOString())
      .in('status', STATUS_DO_RELATORIO)
      .order('inicio'),
  ])

  const nomes = new Map((perfis.data ?? []).map((p) => [p.membro_id, p.nome_exibicao]))
  const barbeiros = (membros.data ?? []).map((m) => ({
    id: m.id,
    nome: nomes.get(m.id) ?? (m.papel === 'dono' ? 'Dono' : 'Barbeiro'),
    papel: m.papel === 'dono' ? 'Dono' : 'Barbeiro',
  }))
  const todos = (agendamentos.data ?? []).map((a) => {
    const pagamento = Array.isArray(a.pagamentos) ? a.pagamentos[0] : a.pagamentos
    return {
      id: a.id,
      codigo: a.codigo,
      inicio: a.inicio,
      data: partesLocais(new Date(a.inicio), fuso).data,
      status: a.status as StatusAgendamento,
      barbeiroId: a.barbeiro_id,
      origem: a.origem,
      pagamento: (a.pago_no_balcao ? 'balcao' : (pagamento?.meio ?? null)) as Pagamento | null,
      cliente: a.clientes?.nome ?? 'Cliente',
      servicos: a.agendamento_servicos.map((s) => ({
        servicoId: s.servico_id,
        nome: s.nome,
        precoCentavos: s.preco_centavos,
      })),
    }
  })
  const paraResumo = (de: string, ate: string): AtendimentoDoRelatorio[] =>
    todos
      .filter((a) => a.data >= de && a.data <= ate)
      .map((a) => ({
        data: a.data,
        status: a.status,
        barbeiroId: a.barbeiroId,
        pagamento: a.pagamento,
        servicos: a.servicos,
      }))

  return {
    barbearia,
    papel,
    hoje,
    periodo,
    filtro,
    visao,
    comparar: texto('comparar') !== '0',
    barbeiros,
    servicos: servicos.data ?? [],
    /** Atendimentos do período escolhido (para o CSV detalhado). */
    lista: todos.filter((a) => a.data >= periodo.de && a.data <= periodo.ate),
    atendimentos: paraResumo(periodo.de, periodo.ate),
    anteriores: paraResumo(periodo.anterior.de, periodo.anterior.ate),
  }
}
