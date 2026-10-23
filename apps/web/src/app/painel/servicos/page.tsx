import { barbeariaDoPainel } from '@/lib/painel'
import s from '../painel.module.css'
import { TabelaDeServicos, type LinhaServico } from './tabela'

// Figma Admin 05 · Serviços (05b filtros, 05c novo, 05d desativar).
export default async function Servicos() {
  const { supabase, barbearia, papel } = await barbeariaDoPainel()
  const agora = new Date().toISOString()
  const [servicos, vinculos, equipe, futuros] = await Promise.all([
    supabase
      .from('servicos')
      .select(
        'id, nome, categoria, descricao, duracao_min, preco_centavos, desconto_tipo, desconto_valor, ativo, ordem',
      )
      .eq('barbearia_id', barbearia.id)
      .order('ordem')
      .order('nome'),
    supabase
      .from('servico_barbeiro')
      .select('servico_id, membro_id')
      .eq('barbearia_id', barbearia.id),
    supabase
      .from('perfis_profissionais')
      .select('membro_id, nome_exibicao')
      .eq('barbearia_id', barbearia.id),
    supabase
      .from('agendamento_servicos')
      .select('servico_id, agendamentos!inner(barbearia_id, inicio, status)')
      .eq('agendamentos.barbearia_id', barbearia.id)
      .gt('agendamentos.inicio', agora)
      .in('agendamentos.status', ['reservado', 'confirmado']),
  ])

  const futurosPorServico = new Map<string, number>()
  for (const f of futuros.data ?? [])
    futurosPorServico.set(f.servico_id, (futurosPorServico.get(f.servico_id) ?? 0) + 1)

  const linhas: LinhaServico[] = (servicos.data ?? []).map((sv) => ({
    ...sv,
    barbeiros: (vinculos.data ?? []).filter((v) => v.servico_id === sv.id).map((v) => v.membro_id),
    agendamentosFuturos: futurosPorServico.get(sv.id) ?? 0,
  }))

  return (
    <>
      <div className={s.cabecalhoPagina}>
        <div>
          <h1>Serviços</h1>
          <p>
            {linhas.length} serviços · {linhas.filter((l) => l.ativo).length} ativos ·{' '}
            {linhas.filter((l) => l.desconto_tipo).length} com desconto
          </p>
        </div>
      </div>
      <TabelaDeServicos
        barbeariaId={barbearia.id}
        podeEditar={papel === 'dono'}
        servicos={linhas}
        equipe={(equipe.data ?? []).map((e) => ({ id: e.membro_id, nome: e.nome_exibicao }))}
      />
    </>
  )
}
