import { reais } from '@/lib/formato'
import r from './relatorios.module.css'

// Produção por dia (Figma Admin 08): colunas empilhadas em dois tons, com o total em cima e o dia
// embaixo. Embaixo, o que entrou pelo app (Pix e cartão); em cima, o que foi combinado no balcão.
// A tabela para leitor de tela traz os mesmos números.

export interface ColunaDoGrafico {
  chave: string
  /** "Qui 01", "06 out", "out" */
  rotulo: string
  /** "quinta, 01 de outubro" */
  detalhe: string
  appCentavos: number
  balcaoCentavos: number
}

export function GraficoDeProducao({
  titulo,
  colunas,
}: {
  titulo: string
  colunas: ColunaDoGrafico[]
}) {
  const maximo = Math.max(1, ...colunas.map((c) => c.appCentavos + c.balcaoCentavos))
  const comValores = colunas.length <= 16
  const aCada = colunas.length <= 16 ? 1 : Math.ceil(colunas.length / 12)
  const inteiro = (centavos: number) => Math.round(centavos / 100).toLocaleString('pt-BR')

  return (
    <figure className={r.grafico}>
      <div className={r.colunas} aria-hidden="true">
        {colunas.map((c, i) => {
          const total = c.appCentavos + c.balcaoCentavos
          return (
            <div
              key={c.chave}
              className={r.coluna}
              title={`${c.detalhe}: ${reais(total)} (${reais(c.appCentavos)} pelo app, ${reais(c.balcaoCentavos)} no balcão)`}
            >
              {comValores ? <span className={r.valor}>{inteiro(total)}</span> : null}
              <span className={r.pilha} style={{ height: `${(total / maximo) * 100}%` }}>
                {c.balcaoCentavos ? (
                  <span className={r.balcao} style={{ flexGrow: c.balcaoCentavos }} />
                ) : null}
                {c.appCentavos ? (
                  <span className={r.app} style={{ flexGrow: c.appCentavos }} />
                ) : null}
              </span>
              <span className={r.dia}>{i % aCada === 0 ? c.rotulo : ''}</span>
            </div>
          )
        })}
      </div>
      <table className="so-leitor">
        <caption>{titulo}</caption>
        <thead>
          <tr>
            <th scope="col">Período</th>
            <th scope="col">Pelo app</th>
            <th scope="col">No balcão</th>
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          {colunas.map((c) => (
            <tr key={c.chave}>
              <th scope="row">{c.detalhe}</th>
              <td>{reais(c.appCentavos)}</td>
              <td>{reais(c.balcaoCentavos)}</td>
              <td>{reais(c.appCentavos + c.balcaoCentavos)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
