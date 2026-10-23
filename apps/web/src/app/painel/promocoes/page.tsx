import { Etiqueta, Vazio, type Tom } from '@/componentes/ui'
import t from '@/componentes/tabela.module.css'
import { dataCurta } from '@/lib/formato'
import { barbeariaDoPainel } from '@/lib/painel'
import { statusDaPromocao, textoDoDesconto, type StatusDaPromocao } from '@/lib/promocao'
import s from '../painel.module.css'
import { AlternarPromocao, EditorDePromocao, type PromocaoDoPainel } from './editor'

// Figma Admin 07 (nova promoção) e 07b (lista). regras-de-negocio §Outras regras: o cupom vale
// só nesta barbearia e o desconto sai do valor dela.

const STATUS: Record<StatusDaPromocao, { rotulo: string; tom: Tom }> = {
  ativa: { rotulo: 'Ativa', tom: 'sucesso' },
  agendada: { rotulo: 'Agendada', tom: 'informativo' },
  pausada: { rotulo: 'Pausada', tom: 'alerta' },
  encerrada: { rotulo: 'Encerrada', tom: 'neutro' },
}

export default async function Promocoes() {
  const { supabase, barbearia, papel } = await barbeariaDoPainel()
  const fuso = barbearia.fuso
  const [promocoes, servicos, usos] = await Promise.all([
    supabase
      .from('promocoes')
      .select(
        'id, nome, descricao, tipo, codigo, desconto_tipo, desconto_valor, servico_ids, dias_semana, inicio, fim, limite_usos, um_uso_por_cliente, ativa',
      )
      .eq('barbearia_id', barbearia.id)
      .order('criada_em', { ascending: false }),
    supabase
      .from('servicos')
      .select('id, nome')
      .eq('barbearia_id', barbearia.id)
      .eq('ativo', true)
      .order('ordem'),
    supabase.from('cupom_usos').select('promocao_id'),
  ])

  const contagem = new Map<string, number>()
  for (const u of usos.data ?? [])
    contagem.set(u.promocao_id, (contagem.get(u.promocao_id) ?? 0) + 1)
  const agora = new Date()
  const lista: PromocaoDoPainel[] = (promocoes.data ?? []).map((p) => ({
    id: p.id,
    nome: p.nome,
    descricao: p.descricao,
    tipo: p.tipo,
    codigo: p.codigo,
    desconto:
      p.desconto_tipo === 'percentual'
        ? { tipo: 'percentual', pct: p.desconto_valor }
        : { tipo: 'fixo', valor: p.desconto_valor },
    servicoIds: p.servico_ids,
    diasSemana: p.dias_semana,
    inicio: p.inicio,
    fim: p.fim,
    limiteUsos: p.limite_usos,
    umUsoPorCliente: p.um_uso_por_cliente,
    ativa: p.ativa,
  }))
  const dono = papel === 'dono'
  const ativas = lista.filter(
    (p) =>
      statusDaPromocao({ ...p, inicio: new Date(p.inicio), fim: new Date(p.fim) }, agora) ===
      'ativa',
  ).length

  return (
    <>
      <div className={s.cabecalhoPagina}>
        <div>
          <h1>Promoções</h1>
          <p>
            {ativas} ativa{ativas === 1 ? '' : 's'} · cupons e ofertas valem só nesta barbearia, e o
            desconto sai do valor dela.
          </p>
        </div>
        {dono ? (
          <EditorDePromocao barbeariaId={barbearia.id} fuso={fuso} servicos={servicos.data ?? []} />
        ) : null}
      </div>

      {lista.length === 0 ? (
        <Vazio titulo="Nenhuma promoção ainda">
          <p>Crie um cupom para divulgar ou uma oferta automática para os dias mais vazios.</p>
        </Vazio>
      ) : (
        <div className={t.envoltorio}>
          <table className={t.tabela}>
            <thead>
              <tr>
                <th scope="col">Promoção</th>
                <th scope="col">Como usar</th>
                <th scope="col">Desconto</th>
                <th scope="col">Usos</th>
                <th scope="col">Período</th>
                <th scope="col">Status</th>
                {dono ? (
                  <th scope="col">
                    <span className="so-leitor">Ações</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => {
                const status = statusDaPromocao(
                  { ativa: p.ativa, inicio: new Date(p.inicio), fim: new Date(p.fim) },
                  agora,
                )
                const usados = contagem.get(p.id) ?? 0
                return (
                  <tr key={p.id} className={status === 'encerrada' ? t.inativo : undefined}>
                    <td>
                      <strong>{p.nome}</strong>
                      {p.descricao ? (
                        <>
                          <br />
                          <span style={{ color: 'var(--texto-suave)', fontSize: 13 }}>
                            {p.descricao}
                          </span>
                        </>
                      ) : null}
                    </td>
                    <td>
                      {p.tipo === 'cupom' ? <span className="mono">{p.codigo}</span> : 'Automática'}
                    </td>
                    <td>{textoDoDesconto(p.desconto).replace(' de desconto', '')}</td>
                    <td>
                      {usados}
                      {p.limiteUsos ? ` de ${p.limiteUsos}` : ''}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {dataCurta(p.inicio, fuso)} a {dataCurta(p.fim, fuso)}
                    </td>
                    <td>
                      <Etiqueta tom={STATUS[status].tom}>{STATUS[status].rotulo}</Etiqueta>
                      {status === 'agendada' ? (
                        <span
                          style={{
                            display: 'block',
                            fontSize: 12,
                            color: 'var(--texto-suave)',
                            marginTop: 4,
                          }}
                        >
                          Começa em {dataCurta(p.inicio, fuso)}
                        </span>
                      ) : null}
                    </td>
                    {dono ? (
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {status === 'encerrada' ? null : (
                          <>
                            <EditorDePromocao
                              barbeariaId={barbearia.id}
                              fuso={fuso}
                              servicos={servicos.data ?? []}
                              promocao={p}
                            />{' '}
                            <AlternarPromocao id={p.id} ativa={p.ativa} nome={p.nome} />
                          </>
                        )}
                      </td>
                    ) : null}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
