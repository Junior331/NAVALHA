import {
  CalendarCheck,
  ReceiptText,
  TrendingDown,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { Avatar, Cartao, Mensagem, Vazio } from '@/componentes/ui'
import { intervaloDeDias, reais } from '@/lib/formato'
import {
  agruparParaOGrafico,
  enderecoDoRelatorio,
  resumirProducao,
  variacao,
  type EstadoDoRelatorio,
  type Producao,
} from '@/lib/relatorio'
import s from '../painel.module.css'
import {
  CompararComAnterior,
  ExportarCsv,
  FiltrosDoRelatorio,
  PeriodoDoRelatorio,
} from './controles'
import { dadosDoRelatorio } from './dados'
import { GraficoDeProducao } from './grafico'
import r from './relatorios.module.css'

// Figma Admin 08 (relatórios, filtros e exportar). Backlog 08: sem "Comissão dos barbeiros" nem
// líquido calculado a partir dela (a comissão é paga fora da Navalha); os valores financeiros
// ficam no Financeiro. No lugar de comissão/líquido, o gráfico separa o que entrou pelo app do
// que foi combinado no balcão.

export default async function Relatorios({ searchParams }: PageProps<'/painel/relatorios'>) {
  const dados = await dadosDoRelatorio(await searchParams)
  const { periodo, filtro, visao, comparar, barbeiros, servicos, papel } = dados

  if (papel !== 'dono') {
    return (
      <>
        <div className={s.cabecalhoPagina}>
          <h1>Relatórios</h1>
        </div>
        <Mensagem tipo="info">Os relatórios são vistos só pelo dono da barbearia.</Mensagem>
      </>
    )
  }

  const producao = resumirProducao(dados.atendimentos, filtro)
  const anterior = resumirProducao(dados.anteriores, filtro)
  const estado: EstadoDoRelatorio = {
    periodo: periodo.chave,
    de: periodo.de,
    ate: periodo.ate,
    barbeiros: filtro.barbeiroIds,
    servicos: filtro.servicoIds,
    pagamentos: filtro.pagamentos,
    comparar,
    visao,
  }
  const atendimentos = producao.totais.atendimentos
  const resumo = `${porExtenso(periodo.de, periodo.ate)} · ${atendimentos} ${atendimentos === 1 ? 'atendimento' : 'atendimentos'}`
  const nome = new Map(barbeiros.map((b) => [b.id, b]))
  const linhasDetalhadas = dados.lista.filter(
    (a) =>
      (!filtro.barbeiroIds.length || filtro.barbeiroIds.includes(a.barbeiroId)) &&
      (!filtro.pagamentos.length || (a.pagamento && filtro.pagamentos.includes(a.pagamento))) &&
      a.servicos.some((x) => !filtro.servicoIds.length || filtro.servicoIds.includes(x.servicoId)),
  ).length

  const indicadores: {
    rotulo: string
    icone: LucideIcon
    valor: string
    variacao: number | null
  }[] = [
    {
      rotulo: 'Produção',
      icone: Wallet,
      valor: reais(producao.totais.producaoCentavos),
      variacao: variacao(producao.totais.producaoCentavos, anterior.totais.producaoCentavos),
    },
    {
      rotulo: 'Atendimentos',
      icone: CalendarCheck,
      valor: atendimentos.toLocaleString('pt-BR'),
      variacao: variacao(atendimentos, anterior.totais.atendimentos),
    },
    {
      rotulo: 'Ticket médio',
      icone: ReceiptText,
      valor: reais(producao.totais.ticketMedioCentavos),
      variacao: variacao(producao.totais.ticketMedioCentavos, anterior.totais.ticketMedioCentavos),
    },
  ]

  const grupos = agruparParaOGrafico(producao.porDia, periodo.de, periodo.ate)
  const porSemana = grupos.length && grupos[0]?.inicio !== grupos[0]?.fim
  const porMes = grupos.length && (grupos[0]?.chave.length ?? 0) === 7
  const tituloDoGrafico = porMes
    ? 'Produção por mês'
    : porSemana
      ? 'Produção por semana'
      : 'Produção por dia'

  return (
    <>
      <div className={s.cabecalhoPagina}>
        <div>
          <h1>Relatórios</h1>
          <p>{resumo}</p>
        </div>
        <div className={s.acoes}>
          <FiltrosDoRelatorio
            estado={estado}
            barbeiros={barbeiros.map((b) => ({ id: b.id, nome: b.nome }))}
            servicos={servicos.filter((x) => x.ativo).map((x) => ({ id: x.id, nome: x.nome }))}
          />
          <ExportarCsv
            estado={estado}
            resumo={resumo}
            linhas={{ resumo: producao.porBarbeiro.length, detalhado: linhasDetalhadas }}
          />
        </div>
      </div>

      <div className={r.barraPeriodo}>
        <PeriodoDoRelatorio estado={estado} rotulo={rotuloDasDatas(periodo.de, periodo.ate)} />
        <CompararComAnterior estado={estado} />
      </div>

      <div className={r.indicadores}>
        {indicadores.map((i) => {
          const Icone = i.icone
          const alta = (i.variacao ?? 0) >= 0
          const Seta = alta ? TrendingUp : TrendingDown
          return (
            <Cartao key={i.rotulo} className={r.indicador}>
              <p className={r.indicadorTopo}>
                <span className="rotulo">{i.rotulo}</span>
                <span className={r.iconeIndicador}>
                  <Icone size={15} strokeWidth={1.75} aria-hidden />
                </span>
              </p>
              <p className={r.indicadorValor}>{i.valor}</p>
              {comparar ? (
                <p className={r.indicadorVariacao}>
                  {i.variacao === null ? (
                    <span>Sem dados no período anterior</span>
                  ) : (
                    <>
                      <span className={r.delta} data-sentido={alta ? 'alta' : 'baixa'}>
                        <Seta size={14} strokeWidth={2} aria-hidden />
                        {alta ? '+' : '−'}
                        {Math.abs(i.variacao).toLocaleString('pt-BR', {
                          maximumFractionDigits: 1,
                        })}
                        %
                      </span>
                      <span>{periodo.comparacao}</span>
                    </>
                  )}
                </p>
              ) : null}
            </Cartao>
          )
        })}
      </div>

      <Cartao className={r.cartaoGrafico}>
        <div className={r.topoGrafico}>
          <h2>{tituloDoGrafico}</h2>
          <ul className={r.legenda}>
            <li>
              <span className={r.amostraBalcao} aria-hidden="true" />
              No balcão
            </li>
            <li>
              <span className={r.amostraApp} aria-hidden="true" />
              Pelo app
            </li>
          </ul>
        </div>
        {atendimentos === 0 ? (
          <Vazio titulo="Nenhum atendimento concluído no período">
            <p>Mude o período ou os filtros.</p>
          </Vazio>
        ) : (
          <GraficoDeProducao
            titulo={tituloDoGrafico}
            colunas={grupos.map((g) => ({
              chave: g.chave,
              rotulo: rotuloDaColuna(g.inicio, porSemana ? 'semana' : porMes ? 'mes' : 'dia'),
              detalhe:
                g.inicio === g.fim
                  ? diaLongo(g.inicio)
                  : `${diaLongo(g.inicio)} a ${diaLongo(g.fim)}`,
              appCentavos: g.appCentavos,
              balcaoCentavos: g.balcaoCentavos,
            }))}
          />
        )}
      </Cartao>

      <section className={r.tabelaCartao} aria-labelledby="titulo-detalhe">
        <h2 id="titulo-detalhe" className="so-leitor">
          Detalhe da produção
        </h2>
        <div className={r.topoTabela}>
          <div className={r.abas} role="group" aria-label="Agrupar por">
            {(
              [
                ['barbeiro', 'Por barbeiro'],
                ['servico', 'Por serviço'],
                ['dia', 'Por dia'],
              ] as const
            ).map(([chave, rotulo]) => (
              <Link
                key={chave}
                href={enderecoDoRelatorio(estado, { visao: chave })}
                aria-current={visao === chave ? 'page' : undefined}
                scroll={false}
              >
                {rotulo}
              </Link>
            ))}
          </div>
          <span className={r.resumoTabela}>{resumoDaTabela(visao, producao)}</span>
        </div>
        <div className={r.rolagemTabela}>
          {visao === 'barbeiro' ? (
            <table className={r.tabela}>
              <thead>
                <tr>
                  <th scope="col">Barbeiro</th>
                  <th scope="col">Atendimentos</th>
                  <th scope="col">Produção</th>
                  <th scope="col">Ticket médio</th>
                  <th scope="col">No-shows</th>
                  <th scope="col">Participação</th>
                </tr>
              </thead>
              <tbody>
                {producao.porBarbeiro.map((b) => {
                  const barbeiro = nome.get(b.barbeiroId)
                  return (
                    <tr key={b.barbeiroId}>
                      <td>
                        <span className={r.pessoa}>
                          <Avatar nome={barbeiro?.nome ?? 'Barbeiro'} tamanho={36} escuro />
                          <span>
                            <strong>{barbeiro?.nome ?? 'Barbeiro'}</strong>
                            <span>{barbeiro?.papel ?? 'Barbeiro'}</span>
                          </span>
                        </span>
                      </td>
                      <td>{b.atendimentos}</td>
                      <td>{reais(b.producaoCentavos)}</td>
                      <td>{reais(b.ticketMedioCentavos)}</td>
                      <td>{b.noShows}</td>
                      <td>
                        <span className={r.pilula}>
                          {participacao(b.producaoCentavos, producao.totais.producaoCentavos)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Total</th>
                  <td>{producao.totais.atendimentos}</td>
                  <td>{reais(producao.totais.producaoCentavos)}</td>
                  <td>{reais(producao.totais.ticketMedioCentavos)}</td>
                  <td>{producao.totais.noShows}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          ) : visao === 'servico' ? (
            <table className={r.tabela}>
              <thead>
                <tr>
                  <th scope="col">Serviço</th>
                  <th scope="col">Quantidade</th>
                  <th scope="col">Produção</th>
                  <th scope="col">Preço médio</th>
                  <th scope="col">Participação</th>
                </tr>
              </thead>
              <tbody>
                {producao.porServico.map((x) => (
                  <tr key={x.servicoId}>
                    <td>
                      <strong>{x.nome}</strong>
                    </td>
                    <td>{x.quantidade}</td>
                    <td>{reais(x.producaoCentavos)}</td>
                    <td>
                      {reais(x.quantidade ? Math.round(x.producaoCentavos / x.quantidade) : 0)}
                    </td>
                    <td>
                      <span className={r.pilula}>
                        {participacao(x.producaoCentavos, producao.totais.producaoCentavos)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Total</th>
                  <td>{producao.porServico.reduce((t, x) => t + x.quantidade, 0)}</td>
                  <td>{reais(producao.totais.producaoCentavos)}</td>
                  <td />
                  <td />
                </tr>
              </tfoot>
            </table>
          ) : (
            <table className={r.tabela}>
              <thead>
                <tr>
                  <th scope="col">Dia</th>
                  <th scope="col">Atendimentos</th>
                  <th scope="col">Produção</th>
                  <th scope="col">Pelo app</th>
                  <th scope="col">No balcão</th>
                </tr>
              </thead>
              <tbody>
                {producao.porDia
                  .filter((d) => d.atendimentos > 0)
                  .map((d) => (
                    <tr key={d.data}>
                      <td>
                        <strong>{diaLongo(d.data)}</strong>
                      </td>
                      <td>{d.atendimentos}</td>
                      <td>{reais(d.producaoCentavos)}</td>
                      <td>{reais(d.appCentavos)}</td>
                      <td>{reais(d.balcaoCentavos)}</td>
                    </tr>
                  ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Total</th>
                  <td>{producao.totais.atendimentos}</td>
                  <td>{reais(producao.totais.producaoCentavos)}</td>
                  <td>{reais(producao.porDia.reduce((t, d) => t + d.appCentavos, 0))}</td>
                  <td>{reais(producao.porDia.reduce((t, d) => t + d.balcaoCentavos, 0))}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </section>
    </>
  )
}

function participacao(parte: number, total: number): string {
  return `${total ? Math.round((parte / total) * 100) : 0}%`
}

function resumoDaTabela(visao: EstadoDoRelatorio['visao'], producao: Producao): string {
  if (visao === 'servico') {
    const n = producao.porServico.length
    return `${n} ${n === 1 ? 'serviço' : 'serviços'} · produção pelo preço de tabela`
  }
  if (visao === 'dia') {
    const n = producao.porDia.filter((d) => d.atendimentos > 0).length
    return `${n} ${n === 1 ? 'dia com atendimento' : 'dias com atendimento'}`
  }
  const n = producao.porBarbeiro.length
  return `${n} ${n === 1 ? 'barbeiro' : 'barbeiros'} · comissão paga fora da Navalha`
}

const meioDia = (data: string) => new Date(`${data}T12:00:00Z`)

/** "quinta, 01 de outubro" */
function diaLongo(data: string): string {
  return meioDia(data).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    timeZone: 'UTC',
  })
}

/** "Qui 01" (dia), "06 out" (semana), "out" (mês) */
function rotuloDaColuna(data: string, tamanho: 'dia' | 'semana' | 'mes'): string {
  const d = meioDia(data)
  if (tamanho === 'mes')
    return d.toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' }).replace('.', '')
  if (tamanho === 'semana') return intervaloDeDias(data, data)
  const semana = d
    .toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'UTC' })
    .replace('.', '')
  return `${semana.charAt(0).toUpperCase()}${semana.slice(1)} ${data.slice(8)}`
}

/** "01 a 07 de outubro" */
function porExtenso(de: string, ate: string): string {
  const mes = (d: string) =>
    meioDia(d).toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' })
  if (de === ate) return `${de.slice(8)} de ${mes(de)}`
  return mes(de) === mes(ate) && de.slice(0, 4) === ate.slice(0, 4)
    ? `${de.slice(8)} a ${ate.slice(8)} de ${mes(ate)}`
    : `${de.slice(8)} de ${mes(de)} a ${ate.slice(8)} de ${mes(ate)}`
}

/** "01 – 07 out 2026" */
function rotuloDasDatas(de: string, ate: string): string {
  return `${intervaloDeDias(de, ate)} ${ate.slice(0, 4)}`
}
