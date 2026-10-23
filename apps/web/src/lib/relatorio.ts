import type { StatusAgendamento } from '@navalha/core'

// Relatório de produção (Figma Admin 08): quanto cada barbeiro e cada serviço produziu no período,
// pelo preço dos serviços. Sem comissão (paga fora da Navalha, regras-de-negocio §Outras regras);
// líquido e taxas ficam no Financeiro.

export interface AtendimentoDoRelatorio {
  /** Dia local (YYYY-MM-DD) no fuso da barbearia. */
  data: string
  status: StatusAgendamento
  barbeiroId: string
  servicos: { servicoId: string; nome: string; precoCentavos: number }[]
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
  porDia: { data: string; producaoCentavos: number }[]
}

const media = (total: number, quantidade: number) =>
  quantidade ? Math.round(total / quantidade) : 0

export function resumirProducao(
  atendimentos: AtendimentoDoRelatorio[],
  filtro: { barbeiroId?: string; servicoIds?: string[] },
): Producao {
  const servicoValido = (id: string) => !filtro.servicoIds?.length || filtro.servicoIds.includes(id)
  const doFiltro = atendimentos
    .filter((a) => !filtro.barbeiroId || a.barbeiroId === filtro.barbeiroId)
    .map((a) => ({ ...a, servicos: a.servicos.filter((s) => servicoValido(s.servicoId)) }))
    .filter((a) => a.servicos.length > 0)

  const barbeiros = new Map<string, Producao['porBarbeiro'][number]>()
  const servicos = new Map<string, Producao['porServico'][number]>()
  const dias = new Map<string, number>()
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
    dias.set(a.data, dias.get(a.data) ?? 0)
    if (a.status === 'no_show') barbeiro.noShows += 1
    if (a.status.startsWith('cancelado')) cancelados += 1
    if (a.status !== 'concluido') continue

    const valor = a.servicos.reduce((total, s) => total + s.precoCentavos, 0)
    barbeiro.atendimentos += 1
    barbeiro.producaoCentavos += valor
    dias.set(a.data, (dias.get(a.data) ?? 0) + valor)
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
    porDia: [...dias.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, producaoCentavos]) => ({ data, producaoCentavos })),
  }
}

/** CSV para planilha em pt-BR: ponto e vírgula, vírgula decimal e BOM para o Excel abrir certo. */
export function paraCsv(linhas: (string | number)[][]): string {
  const celula = (valor: string | number) => {
    const texto = String(valor)
    return /[;"\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
  }
  return `${String.fromCharCode(0xfeff)}${linhas.map((l) => l.map(celula).join(';')).join('\r\n')}\r\n`
}
