import { partesLocais } from '@navalha/core'
import { nomeDoArquivo, paraCsv, resumirProducao } from '@/lib/relatorio'
import { STATUS } from '@/lib/status'
import { dadosDoRelatorio } from '../dados'

// Exportar CSV (Figma Admin 08): resumo por barbeiro ou um atendimento por linha, com os mesmos
// filtros da tela. ?conteudo=resumo|detalhado&separador=virgula|ponto-e-virgula

const PAGAMENTO: Record<string, string> = {
  pix: 'Pix',
  cartao: 'Cartão',
  balcao: 'Dinheiro (balcão)',
}

export async function GET(requisicao: Request) {
  const url = new URL(requisicao.url)
  const { barbearia, papel, barbeiros, lista, atendimentos, filtro, periodo } =
    await dadosDoRelatorio(Object.fromEntries(url.searchParams))
  if (papel !== 'dono') return new Response('Só o dono exporta relatórios', { status: 403 })

  const separador = url.searchParams.get('separador') === 'virgula' ? ',' : ';'
  const detalhado = url.searchParams.get('conteudo') === 'detalhado'
  const reais = (centavos: number) => (centavos / 100).toFixed(2).replace('.', ',')
  const nome = new Map(barbeiros.map((b) => [b.id, b]))

  let linhas: (string | number)[][]
  if (detalhado) {
    const inclui = <T>(lista: T[], valor: T) => !lista.length || lista.includes(valor)
    linhas = [
      [
        'Data',
        'Hora',
        'Código',
        'Barbeiro',
        'Cliente',
        'Serviços',
        'Status',
        'Pagamento',
        'Produção (R$)',
        'Origem',
      ],
      ...lista
        .filter((a) => inclui(filtro.barbeiroIds, a.barbeiroId))
        .filter(
          (a) =>
            !filtro.pagamentos.length || (a.pagamento && filtro.pagamentos.includes(a.pagamento)),
        )
        .filter((a) => a.servicos.some((x) => inclui(filtro.servicoIds, x.servicoId)))
        .map((a) => {
          const local = partesLocais(new Date(a.inicio), barbearia.fuso)
          const servicos = a.servicos.filter((x) => inclui(filtro.servicoIds, x.servicoId))
          return [
            local.data.split('-').reverse().join('/'),
            `${String(Math.floor(local.minutos / 60)).padStart(2, '0')}:${String(local.minutos % 60).padStart(2, '0')}`,
            a.codigo,
            nome.get(a.barbeiroId)?.nome ?? 'Barbeiro',
            a.cliente,
            servicos.map((x) => x.nome).join(' + '),
            STATUS[a.status].rotulo,
            a.pagamento ? (PAGAMENTO[a.pagamento] ?? a.pagamento) : 'Sem cobrança',
            a.status === 'concluido'
              ? reais(servicos.reduce((t, x) => t + x.precoCentavos, 0))
              : '0,00',
            a.origem === 'balcao' ? 'Balcão' : a.origem === 'web' ? 'Página web' : 'App',
          ]
        }),
    ]
  } else {
    const producao = resumirProducao(atendimentos, filtro)
    const total = producao.totais.producaoCentavos
    linhas = [
      [
        'Barbeiro',
        'Função',
        'Atendimentos',
        'Produção (R$)',
        'Ticket médio (R$)',
        'No-shows',
        'Participação (%)',
      ],
      ...producao.porBarbeiro.map((b) => [
        nome.get(b.barbeiroId)?.nome ?? 'Barbeiro',
        nome.get(b.barbeiroId)?.papel ?? 'Barbeiro',
        b.atendimentos,
        reais(b.producaoCentavos),
        reais(b.ticketMedioCentavos),
        b.noShows,
        total ? Math.round((b.producaoCentavos / total) * 100) : 0,
      ]),
      [
        'Total',
        '',
        producao.totais.atendimentos,
        reais(total),
        reais(producao.totais.ticketMedioCentavos),
        producao.totais.noShows,
        total ? 100 : 0,
      ],
    ]
  }

  return new Response(paraCsv(linhas, separador), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nomeDoArquivo(periodo.de, periodo.ate)}"`,
    },
  })
}
