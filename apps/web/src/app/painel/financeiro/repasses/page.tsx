import { consultarCarteira } from '@navalha/servidor'
import { BotaoLink, Cartao, Etiqueta, Mensagem, Vazio } from '@/componentes/ui'
import t from '@/componentes/tabela.module.css'
import { dataCurta, hora, reais } from '@/lib/formato'
import { barbeariaDoPainel } from '@/lib/painel'
import { contexto } from '@/server/contexto'
import c from '../../conta.module.css'
import s from '../../painel.module.css'
import { Sacar } from '../sacar'

// Repasses (menu Financeiro do Figma Admin): o que saiu da carteira. Saques por Pix para a chave
// da barbearia e o lote semanal com a taxa da Navalha (ajustes-taxas §Transferência).

const STATUS: Record<string, { rotulo: string; tom: 'sucesso' | 'alerta' | 'risco' }> = {
  pendente: { rotulo: 'Processando', tom: 'alerta' },
  concluida: { rotulo: 'Enviado', tom: 'sucesso' },
  falhou: { rotulo: 'Falhou', tom: 'risco' },
}

export default async function Repasses() {
  const { supabase, barbearia, papel, usuarioId } = await barbeariaDoPainel()
  const fuso = barbearia.fuso

  if (papel !== 'dono') {
    return (
      <div className={c.coluna}>
        <div className={s.cabecalhoPagina}>
          <h1>Repasses</h1>
        </div>
        <Mensagem tipo="info">Os repasses são vistos só pelo dono da barbearia.</Mensagem>
      </div>
    )
  }

  if (!barbearia.recebimentos_ativos_em) {
    return (
      <div className={c.coluna}>
        <div className={s.cabecalhoPagina}>
          <div>
            <h1>Repasses</h1>
            <p>Saques e taxas da Navalha.</p>
          </div>
        </div>
        <Vazio titulo="Os recebimentos ainda não estão ativos">
          <BotaoLink href="/painel/recebimentos">Ativar recebimentos</BotaoLink>
        </Vazio>
      </div>
    )
  }

  const [carteira, saques, lotes] = await Promise.all([
    consultarCarteira(contexto(), { id: usuarioId, anonimo: false }, barbearia.id),
    supabase
      .from('saques')
      .select('id, criado_em, valor_centavos, status')
      .eq('barbearia_id', barbearia.id)
      .order('criado_em', { ascending: false })
      .limit(50),
    supabase
      .from('lotes_semanais')
      .select('id, semana, valor_centavos, status')
      .eq('barbearia_id', barbearia.id)
      .order('semana', { ascending: false })
      .limit(26),
  ])
  const sacado = (saques.data ?? [])
    .filter((q) => q.status !== 'falhou')
    .reduce((total, q) => total + q.valor_centavos, 0)

  return (
    <>
      <div className={s.cabecalhoPagina}>
        <div>
          <h1>Repasses</h1>
          <p>Saques para a sua chave Pix e o lote semanal com a taxa da Navalha.</p>
        </div>
        <Sacar
          barbeariaId={barbearia.id}
          disponivel={carteira.disponivelCentavos}
          minimo={carteira.saqueMinimoCentavos}
          liberado={carteira.cadastroAprovado}
        />
      </div>

      <div className={c.blocos}>
        <Cartao className={`${c.bloco} ${c.destaque}`}>
          <span className={c.blocoRotulo}>Disponível para saque</span>
          <strong className={c.blocoValor}>{reais(carteira.disponivelCentavos)}</strong>
          <span className={c.blocoNota}>
            Saque mínimo de {reais(carteira.saqueMinimoCentavos)}.
          </span>
        </Cartao>
        <Cartao className={c.bloco}>
          <span className={c.blocoRotulo}>Já sacado</span>
          <strong className={c.blocoValor}>{reais(sacado)}</strong>
          <span className={c.blocoNota}>Soma dos últimos saques enviados ou em processamento.</span>
        </Cartao>
        <Cartao className={c.bloco}>
          <span className={c.blocoRotulo}>Taxas a transferir</span>
          <strong className={c.blocoValor}>{reais(carteira.taxasATransferirCentavos)}</strong>
          <span className={c.blocoNota}>
            Saem no próximo lote semanal, por Pix, para a Navalha.
          </span>
        </Cartao>
      </div>

      <section className={t.envoltorio} aria-labelledby="titulo-saques">
        <div className={t.ferramentas}>
          <h2 id="titulo-saques" style={{ fontSize: 16 }}>
            Saques
          </h2>
        </div>
        {saques.data && saques.data.length > 0 ? (
          <table className={t.tabela}>
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col" className={c.numero}>
                  Valor
                </th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {saques.data.map((q) => {
                const status = STATUS[q.status] ?? { rotulo: q.status, tom: 'alerta' as const }
                return (
                  <tr key={q.id}>
                    <td>
                      {dataCurta(q.criado_em, fuso)}, {hora(q.criado_em, fuso)}
                    </td>
                    <td className={c.numero}>{reais(q.valor_centavos)}</td>
                    <td>
                      <Etiqueta tom={status.tom}>{status.rotulo}</Etiqueta>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: 16 }}>
            <Vazio titulo="Nenhum saque ainda" />
          </div>
        )}
      </section>

      <section className={t.envoltorio} aria-labelledby="titulo-lotes">
        <div className={t.ferramentas}>
          <div>
            <h2 id="titulo-lotes" style={{ fontSize: 16 }}>
              Taxa da Navalha · lotes semanais
            </h2>
            <p style={{ color: 'var(--texto-suave)', fontSize: 14 }}>
              A taxa de cada agendamento acumula na semana e sai num Pix só.
            </p>
          </div>
        </div>
        {lotes.data && lotes.data.length > 0 ? (
          <table className={t.tabela}>
            <thead>
              <tr>
                <th scope="col">Semana de</th>
                <th scope="col" className={c.numero}>
                  Valor
                </th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {lotes.data.map((l) => {
                const status = STATUS[l.status] ?? { rotulo: l.status, tom: 'alerta' as const }
                return (
                  <tr key={l.id}>
                    <td>{dataCurta(`${l.semana}T12:00:00Z`, 'UTC')}</td>
                    <td className={c.numero}>{reais(l.valor_centavos)}</td>
                    <td>
                      <Etiqueta tom={status.tom}>{status.rotulo}</Etiqueta>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: 16 }}>
            <Vazio titulo="Nenhum lote fechado ainda" />
          </div>
        )}
      </section>
    </>
  )
}
