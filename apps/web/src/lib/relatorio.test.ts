import { describe, expect, it } from 'vitest'
import {
  agruparParaOGrafico,
  paraCsv,
  periodoDoRelatorio,
  resumirProducao,
  type AtendimentoDoRelatorio,
} from './relatorio'

// Relatórios (backlog Admin 08): só a produção de cada barbeiro; a comissão é paga fora da
// Navalha e os valores líquidos ficam no Financeiro.
const linha = (servicoId: string, nome: string, precoCentavos: number) => ({
  servicoId,
  nome,
  precoCentavos,
})

const atendimentos: AtendimentoDoRelatorio[] = [
  {
    data: '2026-10-19',
    status: 'concluido',
    barbeiroId: 'rafael',
    pagamento: 'pix',
    servicos: [linha('corte', 'Corte', 4000), linha('barba', 'Barba', 3000)],
  },
  {
    data: '2026-10-19',
    status: 'concluido',
    barbeiroId: 'diego',
    pagamento: 'balcao',
    servicos: [linha('corte', 'Corte', 4000)],
  },
  {
    data: '2026-10-20',
    status: 'no_show',
    barbeiroId: 'rafael',
    pagamento: 'cartao',
    servicos: [linha('corte', 'Corte', 4000)],
  },
  {
    data: '2026-10-20',
    status: 'cancelado_pela_barbearia',
    barbeiroId: 'diego',
    pagamento: 'pix',
    servicos: [linha('barba', 'Barba', 3000)],
  },
]

describe('resumirProducao', () => {
  it('soma a produção dos atendimentos concluídos, por barbeiro, serviço e dia', () => {
    const r = resumirProducao(atendimentos, {})

    expect(r.totais).toEqual({
      atendimentos: 2,
      producaoCentavos: 11000,
      ticketMedioCentavos: 5500,
      noShows: 1,
      cancelados: 1,
    })
    expect(r.porBarbeiro).toEqual([
      {
        barbeiroId: 'rafael',
        atendimentos: 1,
        producaoCentavos: 7000,
        ticketMedioCentavos: 7000,
        noShows: 1,
      },
      {
        barbeiroId: 'diego',
        atendimentos: 1,
        producaoCentavos: 4000,
        ticketMedioCentavos: 4000,
        noShows: 0,
      },
    ])
    expect(r.porServico).toEqual([
      { servicoId: 'corte', nome: 'Corte', quantidade: 2, producaoCentavos: 8000 },
      { servicoId: 'barba', nome: 'Barba', quantidade: 1, producaoCentavos: 3000 },
    ])
    expect(r.porDia).toEqual([
      {
        data: '2026-10-19',
        atendimentos: 2,
        producaoCentavos: 11000,
        appCentavos: 7000,
        balcaoCentavos: 4000,
      },
      {
        data: '2026-10-20',
        atendimentos: 0,
        producaoCentavos: 0,
        appCentavos: 0,
        balcaoCentavos: 0,
      },
    ])
  })

  it('filtrando por serviço, conta só as linhas desse serviço', () => {
    const r = resumirProducao(atendimentos, { servicoIds: ['barba'] })
    expect(r.totais.atendimentos).toBe(1)
    expect(r.totais.producaoCentavos).toBe(3000)
    expect(r.porServico.map((s) => s.servicoId)).toEqual(['barba'])
  })

  it('filtrando por barbeiro, ignora os outros', () => {
    const r = resumirProducao(atendimentos, { barbeiroIds: ['diego'] })
    expect(r.porBarbeiro.map((b) => b.barbeiroId)).toEqual(['diego'])
    expect(r.totais).toMatchObject({
      atendimentos: 1,
      producaoCentavos: 4000,
      noShows: 0,
      cancelados: 1,
    })
  })

  it('filtrando por forma de pagamento, o balcão fica de fora quando só o Pix está marcado', () => {
    const r = resumirProducao(atendimentos, { pagamentos: ['pix'] })
    expect(r.totais.producaoCentavos).toBe(7000)
    expect(r.totais.atendimentos).toBe(1)
    // O cancelamento pago por Pix continua contando para o Diego, sem produção.
    expect(r.totais.cancelados).toBe(1)
  })
})

describe('período do relatório', () => {
  it('a semana são os 7 dias até hoje, comparada com os 7 anteriores', () => {
    expect(periodoDoRelatorio({ periodo: 'semana' }, '2026-10-07')).toEqual({
      chave: 'semana',
      de: '2026-10-01',
      ate: '2026-10-07',
      anterior: { de: '2026-09-24', ate: '2026-09-30' },
      comparacao: 'vs. semana anterior',
    })
  })

  it('datas escolhidas viram período personalizado, na ordem certa', () => {
    const p = periodoDoRelatorio({ de: '2026-10-10', ate: '2026-10-01' }, '2026-10-25')
    expect(p).toMatchObject({ chave: 'personalizado', de: '2026-10-01', ate: '2026-10-10' })
    expect(p.anterior).toEqual({ de: '2026-09-21', ate: '2026-09-30' })
  })

  it('agrupa por semana quando o período passa de um mês', () => {
    const grupos = agruparParaOGrafico([], '2026-07-10', '2026-10-07')
    expect(grupos).toHaveLength(13)
    expect(grupos[0]).toMatchObject({ inicio: '2026-07-10', fim: '2026-07-16' })
  })
})

describe('CSV', () => {
  it('põe aspas no que tem o separador escolhido', () => {
    expect(paraCsv([['a', '1,50']], ',')).toContain('a,"1,50"')
    expect(paraCsv([['a', '1,50']], ';')).toContain('a;1,50')
  })
})
