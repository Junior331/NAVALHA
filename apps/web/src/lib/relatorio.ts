import type { StatusAgendamento } from '@navalha/core'

// Relatório de produção (Figma Admin 08): quanto cada barbeiro e cada serviço produziu no período,
// pelo preço dos serviços. Sem comissão (paga fora da Navalha, regras-de-negocio §Outras regras);
// líquido e taxas ficam no Financeiro.

/** Como o atendimento foi pago: Pix ou cartão pelo app, ou combinado na barbearia (balcão). */
export type Pagamento = 'pix' | 'cartao' | 'balcao'

export interface AtendimentoDoRelatorio {
  /** Dia local (YYYY-MM-DD) no fuso da barbearia. */
  data: string
  status: StatusAgendamento
  barbeiroId: string
  /** null: sem cobrança (prêmio da fidelidade). */
  pagamento: Pagamento | null
  servicos: { servicoId: string; nome: string; precoCentavos: number }[]
}

/** Filtros da tela. Lista vazia ou ausente = todos. */
export interface FiltroDoRelatorio {
  barbeiroIds?: string[]
  servicoIds?: string[]
  pagamentos?: Pagamento[]
}

export interface Producao {
  totais: {
    atendimentos: number
    producaoCentavos: number
    ticketMedioCentavos: number
    noShows: number
    cancelados: number
  }
  porBarbeiro: {
    barbeiroId: string
    atendimentos: number
    producaoCentavos: number
    ticketMedioCentavos: number
    noShows: number
  }[]
  porServico: { servicoId: string; nome: string; quantidade: number; producaoCentavos: number }[]
  /** Produção do dia, separando o que entrou pelo app (Pix e cartão) do que foi no balcão. */
  porDia: {
    data: string
    atendimentos: number
    producaoCentavos: number
    appCentavos: number
    balcaoCentavos: number
  }[]
}

const media = (total: number, quantidade: number) =>
  quantidade ? Math.round(total / quantidade) : 0

export function resumirProducao(
  atendimentos: AtendimentoDoRelatorio[],
  filtro: FiltroDoRelatorio,
): Producao {
  const inclui = <T>(lista: T[] | undefined, valor: T) => !lista?.length || lista.includes(valor)
  const doFiltro = atendimentos
    .filter((a) => inclui(filtro.barbeiroIds, a.barbeiroId))
    .filter(
      (a) => !filtro.pagamentos?.length || (a.pagamento && filtro.pagamentos.includes(a.pagamento)),
    )
    .map((a) => ({
      ...a,
      servicos: a.servicos.filter((s) => inclui(filtro.servicoIds, s.servicoId)),
    }))
    .filter((a) => a.servicos.length > 0)

  const barbeiros = new Map<string, Producao['porBarbeiro'][number]>()
  const servicos = new Map<string, Producao['porServico'][number]>()
  const dias = new Map<string, Producao['porDia'][number]>()
  let cancelados = 0

  for (const a of doFiltro) {
    const barbeiro = barbeiros.get(a.barbeiroId) ?? {
      barbeiroId: a.barbeiroId,
      atendimentos: 0,
      producaoCentavos: 0,
      ticketMedioCentavos: 0,
      noShows: 0,
    }
    barbeiros.set(a.barbeiroId, barbeiro)
    const dia = dias.get(a.data) ?? {
      data: a.data,
      atendimentos: 0,
      producaoCentavos: 0,
      appCentavos: 0,
      balcaoCentavos: 0,
    }
    dias.set(a.data, dia)
    if (a.status === 'no_show') barbeiro.noShows += 1
    if (a.status.startsWith('cancelado')) cancelados += 1
    if (a.status !== 'concluido') continue

    const valor = a.servicos.reduce((total, s) => total + s.precoCentavos, 0)
    barbeiro.atendimentos += 1
    barbeiro.producaoCentavos += valor
    dia.atendimentos += 1
    dia.producaoCentavos += valor
    if (a.pagamento === 'balcao') dia.balcaoCentavos += valor
    else dia.appCentavos += valor
    for (const s of a.servicos) {
      const servico = servicos.get(s.servicoId) ?? {
        servicoId: s.servicoId,
        nome: s.nome,
        quantidade: 0,
        producaoCentavos: 0,
      }
      servico.quantidade += 1
      servico.producaoCentavos += s.precoCentavos
      servicos.set(s.servicoId, servico)
    }
  }

  const porBarbeiro = [...barbeiros.values()]
    .map((b) => ({ ...b, ticketMedioCentavos: media(b.producaoCentavos, b.atendimentos) }))
    .sort((a, b) => b.producaoCentavos - a.producaoCentavos)
  const atendidos = porBarbeiro.reduce((total, b) => total + b.atendimentos, 0)
  const producao = porBarbeiro.reduce((total, b) => total + b.producaoCentavos, 0)

  return {
    totais: {
      atendimentos: atendidos,
      producaoCentavos: producao,
      ticketMedioCentavos: media(producao, atendidos),
      noShows: porBarbeiro.reduce((total, b) => total + b.noShows, 0),
      cancelados,
    },
    porBarbeiro,
    porServico: [...servicos.values()].sort((a, b) => b.producaoCentavos - a.producaoCentavos),
    porDia: [...dias.values()].sort((a, b) => a.data.localeCompare(b.data)),
  }
}

// Período --------------------------------------------------------------------------------------

export type ChaveDoPeriodo = 'hoje' | 'semana' | 'mes' | 'trimestre' | 'ano' | 'personalizado'

/** Dias de cada atalho, sempre terminando hoje (a "Semana" do Figma é 01–07 com hoje no dia 07). */
export const DIAS_DO_PERIODO: Record<Exclude<ChaveDoPeriodo, 'personalizado'>, number> = {
  hoje: 1,
  semana: 7,
  mes: 30,
  trimestre: 90,
  ano: 365,
}

const NOME_DO_ANTERIOR: Record<ChaveDoPeriodo, string> = {
  hoje: 'dia anterior',
  semana: 'semana anterior',
  mes: 'mês anterior',
  trimestre: 'trimestre anterior',
  ano: 'ano anterior',
  personalizado: 'período anterior',
}

function somar(data: string, dias: number): string {
  const [a, m, d] = data.split('-').map(Number)
  return new Date(Date.UTC(a ?? 1970, (m ?? 1) - 1, (d ?? 1) + dias)).toISOString().slice(0, 10)
}

export function diasEntre(de: string, ate: string): number {
  return (
    Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000) + 1
  )
}

export interface Periodo {
  chave: ChaveDoPeriodo
  de: string
  ate: string
  /** O mesmo número de dias, logo antes. */
  anterior: { de: string; ate: string }
  /** "vs. semana anterior" */
  comparacao: string
}

export function periodoDoRelatorio(
  pedido: { periodo?: string; de?: string; ate?: string },
  hoje: string,
): Periodo {
  const data = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined)
  let chave: ChaveDoPeriodo = 'semana'
  let de: string
  let ate: string
  if (pedido.periodo && pedido.periodo in DIAS_DO_PERIODO) {
    chave = pedido.periodo as ChaveDoPeriodo
  } else if (data(pedido.de) || data(pedido.ate)) {
    chave = 'personalizado'
  }
  if (chave === 'personalizado') {
    ate = data(pedido.ate) ?? hoje
    de = data(pedido.de) ?? somar(ate, -6)
    if (de > ate) [de, ate] = [ate, de]
  } else {
    ate = hoje
    de = somar(hoje, -(DIAS_DO_PERIODO[chave] - 1))
  }
  const dias = diasEntre(de, ate)
  return {
    chave,
    de,
    ate,
    anterior: { de: somar(de, -dias), ate: somar(de, -1) },
    comparacao: `vs. ${NOME_DO_ANTERIOR[chave]}`,
  }
}

/** Todos os dias do período, inclusive os sem atendimento (o gráfico mostra o zero). */
export function diasDoPeriodo(de: string, ate: string): string[] {
  return Array.from({ length: diasEntre(de, ate) }, (_, i) => somar(de, i))
}

/** Barras do gráfico: por dia até 31 dias, por semana até ~4 meses e por mês acima disso. */
export function agruparParaOGrafico(
  porDia: Producao['porDia'],
  de: string,
  ate: string,
): { chave: string; inicio: string; fim: string; appCentavos: number; balcaoCentavos: number }[] {
  const dias = diasDoPeriodo(de, ate)
  const doDia = new Map(porDia.map((d) => [d.data, d]))
  const tamanho = dias.length <= 31 ? 'dia' : dias.length <= 120 ? 'semana' : 'mes'
  const grupos = new Map<
    string,
    { chave: string; inicio: string; fim: string; appCentavos: number; balcaoCentavos: number }
  >()
  dias.forEach((dia, i) => {
    const chave =
      tamanho === 'dia' ? dia : tamanho === 'semana' ? `s${Math.floor(i / 7)}` : dia.slice(0, 7)
    const grupo = grupos.get(chave) ?? {
      chave,
      inicio: dia,
      fim: dia,
      appCentavos: 0,
      balcaoCentavos: 0,
    }
    grupo.fim = dia
    grupo.appCentavos += doDia.get(dia)?.appCentavos ?? 0
    grupo.balcaoCentavos += doDia.get(dia)?.balcaoCentavos ?? 0
    grupos.set(chave, grupo)
  })
  return [...grupos.values()]
}

/** Variação em % (null sem base de comparação). */
export function variacao(atual: number, anterior: number): number | null {
  return anterior ? ((atual - anterior) / anterior) * 100 : null
}

/** CSV para planilha em pt-BR: vírgula decimal e BOM para o Excel abrir certo. */
export function paraCsv(linhas: (string | number)[][], separador: ';' | ',' = ';'): string {
  const precisaDeAspas = new RegExp(`[${separador}"\\n]`)
  const celula = (valor: string | number) => {
    const texto = String(valor)
    return precisaDeAspas.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
  }
  return `${String.fromCharCode(0xfeff)}${linhas.map((l) => l.map(celula).join(separador)).join('\r\n')}\r\n`
}

/** "relatorio-01-07-out-2026.csv" */
export function nomeDoArquivo(de: string, ate: string): string {
  const mes = (d: string) =>
    new Date(`${d}T12:00:00Z`)
      .toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' })
      .replace('.', '')
  const inicio = de.slice(0, 7) === ate.slice(0, 7) ? de.slice(8) : `${de.slice(8)}-${mes(de)}`
  return `relatorio-${inicio}-${ate.slice(8)}-${mes(ate)}-${ate.slice(0, 4)}.csv`
}

// Estado da tela na URL ------------------------------------------------------------------------

/** O que a tela de relatórios guarda na URL (período, filtros, comparação e aba). */
export interface EstadoDoRelatorio {
  periodo: ChaveDoPeriodo
  de: string
  ate: string
  barbeiros: string[]
  servicos: string[]
  pagamentos: string[]
  comparar: boolean
  visao: 'barbeiro' | 'servico' | 'dia'
}

export function enderecoDoRelatorio(
  atual: EstadoDoRelatorio,
  mudar: Partial<EstadoDoRelatorio> = {},
): string {
  const e = { ...atual, ...mudar }
  const p = new URLSearchParams()
  if (e.periodo === 'personalizado') {
    p.set('de', e.de)
    p.set('ate', e.ate)
  } else if (e.periodo !== 'semana') {
    p.set('periodo', e.periodo)
  }
  if (e.barbeiros.length) p.set('barbeiros', e.barbeiros.join(','))
  if (e.servicos.length) p.set('servicos', e.servicos.join(','))
  if (e.pagamentos.length) p.set('pagamentos', e.pagamentos.join(','))
  if (!e.comparar) p.set('comparar', '0')
  if (e.visao !== 'barbeiro') p.set('visao', e.visao)
  return `/painel/relatorios${p.size ? `?${p.toString()}` : ''}`
}
