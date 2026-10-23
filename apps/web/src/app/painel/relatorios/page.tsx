import { BarrasHorizontais, GraficoDeColunas } from '@/componentes/graficos'
import { Cartao, Mensagem, Vazio } from '@/componentes/ui'
import t from '@/componentes/tabela.module.css'
import { reais } from '@/lib/formato'
import { resumirProducao } from '@/lib/relatorio'
import c from '../conta.module.css'
import d from '../dashboard.module.css'
import s from '../painel.module.css'
import { dadosDoRelatorio } from './dados'
import { FiltrosDoRelatorio } from './filtros'
import r from './relatorios.module.css'

// Figma Admin 08 (relatórios) e 08b (filtros). Backlog 08: sem "Comissão dos barbeiros" nem
// líquido calculado a partir dela; os valores financeiros ficam no Financeiro.
export default async function Relatorios({ searchParams }: PageProps<'/painel/relatorios'>) {
  const parametros = await searchParams
  const { barbeiros, servicos, filtros, atendimentos, papel } = await dadosDoRelatorio(parametros)
  const producao = resumirProducao(atendimentos, {
    ...(filtros.barbeiroId ? { barbeiroId: filtros.barbeiroId } : {}),
    servicoIds: filtros.servicoIds,
  })
  const nome = new Map(barbeiros.map((b) => [b.id, b.nome]))
  const consulta = new URLSearchParams({
    de: filtros.de,
    ate: filtros.ate,
    ...(filtros.barbeiroId ? { barbeiro: filtros.barbeiroId } : {}),
    ...(filtros.servicoIds.length ? { servicos: filtros.servicoIds.join(',') } : {}),
  })

  if (papel !== 'dono') {
    return (
      <div className={c.coluna}>
        <div className={s.cabecalhoPagina}>
          <h1>Relatórios</h1>
        </div>
        <Mensagem tipo="info">Os relatórios são vistos só pelo dono da barbearia.</Mensagem>
      </div>
    )
  }

  return (
    <>
      <div className={s.cabecalhoPagina}>
        <div>
          <h1>Relatórios</h1>
          <p>Produção da equipe no período, pelo preço dos serviços atendidos.</p>
        </div>
        <a className={r.exportar} href={`/painel/relatorios/csv?${consulta.toString()}`} download>
          Exportar CSV
        </a>
      </div>

      <FiltrosDoRelatorio
        filtros={filtros}
        barbeiros={barbeiros}
        servicos={servicos.map((x) => ({ id: x.id, nome: x.nome, ativo: x.ativo }))}
      />

      <div className={d.indicadores}>
        <Cartao>
          <p className={d.indicadorRotulo}>Atendimentos</p>
          <p className={d.indicadorValor}>{producao.totais.atendimentos}</p>
        </Cartao>
        <Cartao>
          <p className={d.indicadorRotulo}>Produção</p>
          <p className={d.indicadorValor}>{reais(producao.totais.producaoCentavos)}</p>
        </Cartao>
        <Cartao>
          <p className={d.indicadorRotulo}>Ticket médio</p>
          <p className={d.indicadorValor}>{reais(producao.totais.ticketMedioCentavos)}</p>
        </Cartao>
        <Cartao>
          <p className={d.indicadorRotulo}>No-shows e cancelamentos</p>
          <p className={d.indicadorValor}>{producao.totais.noShows + producao.totais.cancelados}</p>
          <p className={d.indicadorDelta}>
            {producao.totais.noShows} no-show{producao.totais.noShows === 1 ? '' : 's'} ·{' '}
            {producao.totais.cancelados} cancelado{producao.totais.cancelados === 1 ? '' : 's'}
          </p>
        </Cartao>
      </div>

      {producao.totais.atendimentos === 0 ? (
        <Vazio titulo="Nenhum atendimento concluído no período">
          <p>Mude o período ou os filtros.</p>
        </Vazio>
      ) : (
        <>
          <Cartao>
            <div className={d.cartaoTopo}>
              <div>
                <h2>Produção por dia</h2>
                <p>Serviços atendidos, pelo preço de tabela</p>
              </div>
            </div>
            <GraficoDeColunas
              titulo="Produção por dia no período"
              pontos={producao.porDia.map((dia) => ({
                rotulo: `${dia.data.slice(8, 10)}/${dia.data.slice(5, 7)}`,
                valor: dia.producaoCentavos,
                detalhe: new Date(`${dia.data}T12:00:00Z`).toLocaleDateString('pt-BR', {
                  weekday: 'short',
                  day: '2-digit',
                  month: 'short',
                  timeZone: 'UTC',
                }),
              }))}
              formato="reais"
            />
          </Cartao>

          <div className={d.grade}>
            <section className={t.envoltorio} aria-labelledby="titulo-barbeiros">
              <div className={t.ferramentas}>
                <div>
                  <h2 id="titulo-barbeiros" style={{ fontSize: 16 }}>
                    Produção por barbeiro
                  </h2>
                  <p style={{ color: 'var(--texto-suave)', fontSize: 13 }}>
                    A comissão é combinada e paga pela barbearia, fora da Navalha. Líquido e taxas
                    ficam no Financeiro.
                  </p>
                </div>
              </div>
              <table className={t.tabela}>
                <thead>
                  <tr>
                    <th scope="col">Barbeiro</th>
                    <th scope="col" className={c.numero}>
                      Atendimentos
                    </th>
                    <th scope="col" className={c.numero}>
                      Produção
                    </th>
                    <th scope="col" className={c.numero}>
                      Ticket médio
                    </th>
                    <th scope="col" className={c.numero}>
                      No-shows
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {producao.porBarbeiro.map((b) => (
                    <tr key={b.barbeiroId}>
                      <td>{nome.get(b.barbeiroId) ?? 'Barbeiro'}</td>
                      <td className={c.numero}>{b.atendimentos}</td>
                      <td className={c.numero}>
                        <strong>{reais(b.producaoCentavos)}</strong>
                      </td>
                      <td className={c.numero}>{reais(b.ticketMedioCentavos)}</td>
                      <td className={c.numero}>{b.noShows}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <Cartao>
              <div className={d.cartaoTopo}>
                <div>
                  <h2>Por serviço</h2>
                  <p>Quantidade atendida no período</p>
                </div>
              </div>
              <BarrasHorizontais
                itens={producao.porServico.map((x) => ({
                  rotulo: x.nome,
                  valor: x.quantidade,
                  detalhe: reais(x.producaoCentavos),
                }))}
                formato="numero"
              />
            </Cartao>
          </div>
        </>
      )}
    </>
  )
}
