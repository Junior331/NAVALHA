import { instanteLocal, partesLocais } from '@navalha/core'
import { Cartao, Etiqueta, type Tom } from '@/componentes/ui'
import t from '@/componentes/tabela.module.css'
import { dataCurta } from '@/lib/formato'
import { barbeariaDoPainel } from '@/lib/painel'
import { diasAntes } from '@/lib/status'
import s from '../painel.module.css'
import { AcoesDoBarbeiro, ConvidarBarbeiro } from './interativo'

// Figma Admin 03 · Barbeiros. Cortes e avaliação dos últimos 30 dias, por barbeiro.
export default async function Barbeiros() {
  const { supabase, barbearia, papel } = await barbeariaDoPainel()
  const agora = new Date()
  const hoje = partesLocais(agora, barbearia.fuso)
  const inicio30 = instanteLocal(diasAntes(hoje.data, 29), 0, barbearia.fuso)

  const [membros, perfisProfissionais, concluidos, avaliacoes, folgas, convites, servicos] =
    await Promise.all([
      supabase
        .from('membros')
        .select('id, papel, ativo, usuario_id')
        .eq('barbearia_id', barbearia.id),
      supabase
        .from('perfis_profissionais')
        .select('membro_id, nome_exibicao')
        .eq('barbearia_id', barbearia.id),
      supabase
        .from('agendamentos')
        .select('barbeiro_id')
        .eq('barbearia_id', barbearia.id)
        .eq('status', 'concluido')
        .gte('inicio', inicio30.toISOString()),
      supabase.from('avaliacoes').select('membro_id, nota').eq('barbearia_id', barbearia.id),
      supabase
        .from('bloqueios')
        .select('membro_id')
        .eq('barbearia_id', barbearia.id)
        .lte('inicio', agora.toISOString())
        .gt('fim', agora.toISOString()),
      supabase
        .from('convites')
        .select('id, nome, contato, expira_em')
        .eq('barbearia_id', barbearia.id)
        .is('usado_em', null)
        .gt('expira_em', agora.toISOString()),
      supabase
        .from('servicos')
        .select('id, nome')
        .eq('barbearia_id', barbearia.id)
        .eq('ativo', true)
        .order('ordem'),
    ])

  const nome = new Map((perfisProfissionais.data ?? []).map((p) => [p.membro_id, p.nome_exibicao]))
  const cortes = new Map<string, number>()
  for (const a of concluidos.data ?? [])
    cortes.set(a.barbeiro_id, (cortes.get(a.barbeiro_id) ?? 0) + 1)
  const notas = new Map<string, number[]>()
  for (const a of avaliacoes.data ?? [])
    notas.set(a.membro_id, [...(notas.get(a.membro_id) ?? []), a.nota])
  const deFolga = new Set((folgas.data ?? []).map((f) => f.membro_id))
  const ativos = (membros.data ?? []).filter((m) => m.ativo)

  const linhas = ativos
    .map((m) => {
      const lista = notas.get(m.id) ?? []
      const status: { rotulo: string; tom: Tom } = deFolga.has(m.id)
        ? { rotulo: 'De folga hoje', tom: 'alerta' }
        : { rotulo: 'Ativo', tom: 'sucesso' }
      return {
        id: m.id,
        nome: nome.get(m.id) ?? 'Barbeiro',
        papel: m.papel === 'dono' ? 'Dono' : 'Barbeiro',
        cortes: cortes.get(m.id) ?? 0,
        media: lista.length ? lista.reduce((x, y) => x + y, 0) / lista.length : null,
        avaliacoes: lista.length,
        status,
        dono: m.papel === 'dono',
      }
    })
    .sort((a, b) => b.cortes - a.cortes)

  const iniciais = (texto: string) =>
    texto
      .split(' ')
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()

  return (
    <>
      <div className={s.cabecalhoPagina}>
        <div>
          <h1>Barbeiros</h1>
          <p>
            {linhas.length} na equipe
            {convites.data?.length
              ? ` · ${convites.data.length} convite${convites.data.length > 1 ? 's' : ''} pendente${convites.data.length > 1 ? 's' : ''}`
              : ''}
          </p>
        </div>
        {papel === 'dono' ? (
          <ConvidarBarbeiro barbeariaId={barbearia.id} servicos={servicos.data ?? []} />
        ) : null}
      </div>

      <div className={t.envoltorio}>
        <table className={t.tabela}>
          <thead>
            <tr>
              <th scope="col">Barbeiro</th>
              <th scope="col">Função</th>
              <th scope="col">Cortes · 30 dias</th>
              <th scope="col">Avaliação</th>
              <th scope="col">Status</th>
              <th scope="col">
                <span className="so-leitor">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.id}>
                <td>
                  <span className={t.pessoa}>
                    <span className={t.avatar} aria-hidden>
                      {iniciais(l.nome)}
                    </span>
                    <strong>{l.nome}</strong>
                  </span>
                </td>
                <td>{l.papel}</td>
                <td className={t.numero}>{l.cortes}</td>
                <td className={t.numero}>
                  {l.media === null
                    ? '—'
                    : `★ ${l.media.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} (${l.avaliacoes})`}
                </td>
                <td>
                  <Etiqueta tom={l.status.tom}>{l.status.rotulo}</Etiqueta>
                </td>
                <td>
                  {papel === 'dono' && !l.dono ? (
                    <AcoesDoBarbeiro membroId={l.id} nome={l.nome} />
                  ) : null}
                </td>
              </tr>
            ))}
            {(convites.data ?? []).map((c) => (
              <tr key={c.id} className={t.inativo}>
                <td>
                  <span className={t.pessoa}>
                    <span className={t.avatar} aria-hidden>
                      {iniciais(c.nome)}
                    </span>
                    <span>
                      <strong>{c.nome}</strong>
                      {c.contato ? <span className={t.secundario}>{c.contato}</span> : null}
                    </span>
                  </span>
                </td>
                <td>Barbeiro</td>
                <td className={t.numero}>—</td>
                <td className={t.numero}>—</td>
                <td>
                  <Etiqueta tom="informativo">
                    Convite até {dataCurta(c.expira_em, barbearia.fuso)}
                  </Etiqueta>
                </td>
                <td />
              </tr>
            ))}
          </tbody>
        </table>
        <div className={t.rodape}>
          <span>
            Mostrando {linhas.length} de {linhas.length} barbeiros
          </span>
          <span>Cortes concluídos nos últimos 30 dias</span>
        </div>
      </div>
      {linhas.length === 0 ? (
        <Cartao>
          <p>Convide a equipe para aparecer na agenda e na página da barbearia.</p>
        </Cartao>
      ) : null}
    </>
  )
}
