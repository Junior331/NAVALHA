import { consultarCarteira } from '@navalha/servidor'
import { redirect } from 'next/navigation'
import { Paginacao, paginaDaUrl } from '@/componentes/paginacao'
import { BotaoLink, Cartao, Mensagem, Vazio } from '@/componentes/ui'
import t from '@/componentes/tabela.module.css'
import { dataCurta, hora, reais } from '@/lib/formato'
import { barbeariaDoPainel } from '@/lib/painel'
import { contexto } from '@/server/contexto'
import c from '../conta.module.css'
import s from '../painel.module.css'
import { Sacar } from './sacar'

// Financeiro · Receitas (tela nova, regras-de-negocio §Telas que mudam): retido, a receber
// (cartão), disponível e saque, e o extrato por agendamento com as taxas. Valores sempre
// líquidos. Os saques ficam em Repasses.

const EVENTO: Record<string, string> = {
  concluido: 'Atendido',
  cancelado_no_prazo: 'Cancelado no prazo',
  cancelado_fora_do_prazo: 'Cancelado fora do prazo',
  no_show: 'No-show',
  cancelado_pela_barbearia: 'Cancelado pela barbearia',
}

const POR_PAGINA = 20

export default async function Financeiro({ searchParams }: PageProps<'/painel/financeiro'>) {
  const pagina = paginaDaUrl((await searchParams).pagina)
  const { supabase, barbearia, papel, usuarioId } = await barbeariaDoPainel()
  const fuso = barbearia.fuso

  if (papel !== 'dono') {
    return (
      <div className={c.coluna}>
        <div className={s.cabecalhoPagina}>
          <h1>Financeiro</h1>
        </div>
        <Mensagem tipo="info">O Financeiro é visto só pelo dono da barbearia.</Mensagem>
      </div>
    )
  }

  if (!barbearia.recebimentos_ativos_em) {
    return (
      <div className={c.coluna}>
        <div className={s.cabecalhoPagina}>
          <div>
            <h1>Financeiro</h1>
            <p>Carteira e extrato da barbearia.</p>
          </div>
        </div>
        <Vazio titulo="Os recebimentos ainda não estão ativos">
          <p>
            Ative para receber Pix e cartão dos agendamentos online. Até lá, a barbearia configura
            tudo, mas não recebe agendamentos pagos.
          </p>
          <BotaoLink href="/painel/recebimentos">Ativar recebimentos</BotaoLink>
        </Vazio>
      </div>
    )
  }

  const [carteira, lancamentos] = await Promise.all([
    consultarCarteira(contexto(), { id: usuarioId, anonimo: false }, barbearia.id),
    supabase
      .from('lancamentos')
      .select(
        'id, criado_em, evento_final, valor_pago_centavos, cliente_centavos, credito_cliente_centavos, barbearia_centavos, navalha_centavos, taxa_gateway_centavos, quem_paga_gateway, agendamentos(codigo, inicio, clientes(nome))',
        { count: 'exact' },
      )
      .eq('barbearia_id', barbearia.id)
      .eq('tipo', 'liquidacao')
      .order('criado_em', { ascending: false })
      .order('id')
      .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1),
  ])
  // Página além do fim (link antigo, extrato que diminuiu): vai para a última. Fora do intervalo o
  // banco responde sem o total, então ele é contado à parte.
  if (pagina > 1 && !lancamentos.data?.length) {
    const { count } = await supabase
      .from('lancamentos')
      .select('id', { count: 'exact', head: true })
      .eq('barbearia_id', barbearia.id)
      .eq('tipo', 'liquidacao')
    const ultima = Math.max(1, Math.ceil((count ?? 0) / POR_PAGINA))
    redirect(
      ultima === 1 ? '/painel/financeiro#extrato' : `/painel/financeiro?pagina=${ultima}#extrato`,
    )
  }

  return (
    <>
      <div className={s.cabecalhoPagina}>
        <div>
          <h1>Receitas</h1>
          <p>Valores já sem as taxas do gateway e da Navalha.</p>
        </div>
        <Sacar
          barbeariaId={barbearia.id}
          disponivel={carteira.disponivelCentavos}
          minimo={carteira.saqueMinimoCentavos}
          liberado={carteira.cadastroAprovado}
        />
      </div>

      {!carteira.cadastroAprovado ? (
        <Mensagem tipo="info">
          O cadastro da conta está em análise no Asaas. Os agendamentos já podem ser pagos; os
          saques liberam depois da aprovação.
        </Mensagem>
      ) : null}

      <div className={c.blocos}>
        <Cartao className={c.bloco}>
          <span className={c.blocoRotulo}>Retido até o atendimento</span>
          <strong className={c.blocoValor}>{reais(carteira.retidoCentavos)}</strong>
          <span className={c.blocoNota}>
            Pix pagos e cartões cobrados. O valor é liberado quando o atendimento termina.
            {carteira.preAutorizadoCentavos > 0
              ? ` Mais ${reais(carteira.preAutorizadoCentavos)} garantidos no cartão, cobrados no fim do prazo grátis.`
              : ''}
          </span>
        </Cartao>
        <Cartao className={c.bloco}>
          <span className={c.blocoRotulo}>A receber · cartão</span>
          <strong className={c.blocoValor}>{reais(carteira.aReceberCentavos)}</strong>
          <span className={c.blocoNota}>
            Já é seu: o Asaas libera o cartão em até 32 dias depois da cobrança.
          </span>
        </Cartao>
        <Cartao className={`${c.bloco} ${c.destaque}`}>
          <span className={c.blocoRotulo}>Disponível para saque</span>
          <strong className={c.blocoValor}>{reais(carteira.disponivelCentavos)}</strong>
          <span className={c.blocoNota}>
            Saldo de {reais(carteira.saldoCentavos)}
            {carteira.taxasATransferirCentavos > 0
              ? `, menos ${reais(carteira.taxasATransferirCentavos)} de taxas da Navalha que saem no lote semanal`
              : ''}
            . Saque mínimo de {reais(carteira.saqueMinimoCentavos)}.
          </span>
        </Cartao>
      </div>

      <section id="extrato" className={t.envoltorio} aria-labelledby="titulo-extrato" tabIndex={0}>
        <div className={t.ferramentas}>
          <div>
            <h2 id="titulo-extrato" style={{ fontSize: 16 }}>
              Extrato por agendamento
            </h2>
            <p style={{ color: 'var(--texto-suave)', fontSize: 14 }}>
              Cada atendimento, cancelamento e no-show, com as taxas de cada um.
            </p>
          </div>
        </div>
        {lancamentos.data && lancamentos.data.length > 0 ? (
          <table className={t.tabela}>
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col">Agendamento</th>
                <th scope="col">Evento</th>
                <th scope="col" className={c.numero}>
                  Pago pelo cliente
                </th>
                <th scope="col" className={c.numero}>
                  Devolvido
                </th>
                <th scope="col" className={c.numero}>
                  Taxa do gateway
                </th>
                <th scope="col" className={c.numero}>
                  Taxa Navalha
                </th>
                <th scope="col" className={c.numero}>
                  Você recebe
                </th>
              </tr>
            </thead>
            <tbody>
              {lancamentos.data.map((l) => {
                const devolvido = l.cliente_centavos + l.credito_cliente_centavos
                return (
                  <tr key={l.id}>
                    <td>
                      {dataCurta(l.criado_em, fuso)}, {hora(l.criado_em, fuso)}
                    </td>
                    <td>
                      {l.agendamentos?.codigo ?? '—'}
                      <br />
                      <span style={{ color: 'var(--texto-suave)', fontSize: 13 }}>
                        {l.agendamentos?.clientes?.nome ?? 'Cliente'}
                      </span>
                    </td>
                    <td>{l.evento_final ? (EVENTO[l.evento_final] ?? l.evento_final) : '—'}</td>
                    <td className={c.numero}>{reais(l.valor_pago_centavos)}</td>
                    <td className={c.numero}>
                      {devolvido > 0
                        ? `${reais(devolvido)}${l.credito_cliente_centavos > 0 ? ' (crédito)' : ''}`
                        : '—'}
                    </td>
                    <td className={c.numero}>
                      {l.taxa_gateway_centavos > 0
                        ? `${reais(l.taxa_gateway_centavos)}${l.quem_paga_gateway === 'navalha' ? ' (Navalha)' : ''}`
                        : '—'}
                    </td>
                    <td className={`${c.numero} ${l.navalha_centavos < 0 ? c.negativo : ''}`}>
                      {l.navalha_centavos !== 0 ? reais(l.navalha_centavos) : '—'}
                    </td>
                    <td className={`${c.numero} ${l.barbearia_centavos < 0 ? c.negativo : ''}`}>
                      <strong>{reais(l.barbearia_centavos)}</strong>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : null}
        {lancamentos.count ? (
          <Paginacao
            pagina={pagina}
            porPagina={POR_PAGINA}
            total={lancamentos.count}
            endereco={(p) =>
              p === 1 ? '/painel/financeiro#extrato' : `/painel/financeiro?pagina=${p}#extrato`
            }
            rotulo="extrato"
          />
        ) : (
          <div style={{ padding: 16 }}>
            <Vazio titulo="Nada no extrato ainda">
              <p>Os valores entram aqui quando cada agendamento termina.</p>
            </Vazio>
          </div>
        )}
      </section>
    </>
  )
}
