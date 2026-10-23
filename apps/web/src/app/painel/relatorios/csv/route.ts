import { partesLocais } from '@navalha/core'
import { paraCsv } from '@/lib/relatorio'
import { STATUS } from '@/lib/status'
import { dadosDoRelatorio } from '../dados'

// Exportar CSV (Figma Admin 08): um atendimento por linha, com os mesmos filtros da tela.
export async function GET(requisicao: Request) {
  const url = new URL(requisicao.url)
  const { barbearia, papel, barbeiros, lista, filtros } = await dadosDoRelatorio(
    Object.fromEntries(url.searchParams),
  )
  if (papel !== 'dono') return new Response('Só o dono exporta relatórios', { status: 403 })

  const nome = new Map(barbeiros.map((b) => [b.id, b.nome]))
  const doFiltro = (id: string) => !filtros.servicoIds.length || filtros.servicoIds.includes(id)
  const reais = (centavos: number) => (centavos / 100).toFixed(2).replace('.', ',')
  const linhas = lista
    .filter((a) => !filtros.barbeiroId || a.barbeiroId === filtros.barbeiroId)
    .filter((a) => a.servicos.some((x) => doFiltro(x.servicoId)))
    .map((a) => {
      const local = partesLocais(new Date(a.inicio), barbearia.fuso)
      const servicos = a.servicos.filter((x) => doFiltro(x.servicoId))
      return [
        local.data.split('-').reverse().join('/'),
        `${String(Math.floor(local.minutos / 60)).padStart(2, '0')}:${String(local.minutos % 60).padStart(2, '0')}`,
        a.codigo,
        nome.get(a.barbeiroId) ?? 'Barbeiro',
        a.cliente,
        servicos.map((x) => x.nome).join(' + '),
        STATUS[a.status].rotulo,
        a.status === 'concluido'
          ? reais(servicos.reduce((t, x) => t + x.precoCentavos, 0))
          : '0,00',
        a.origem === 'balcao' ? 'Balcão' : a.origem === 'web' ? 'Página web' : 'App',
      ]
    })

  const csv = paraCsv([
    [
      'Data',
      'Hora',
      'Código',
      'Barbeiro',
      'Cliente',
      'Serviços',
      'Status',
      'Produção (R$)',
      'Origem',
    ],
    ...linhas,
  ])
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="producao-${filtros.de}-a-${filtros.ate}.csv"`,
    },
  })
}
