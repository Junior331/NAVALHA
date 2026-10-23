import { describe, expect, it } from 'vitest'
import { resumirProducao, type AtendimentoDoRelatorio } from './relatorio'

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
    servicos: [linha('corte', 'Corte', 4000), linha('barba', 'Barba', 3000)],
  },
  {
    data: '2026-10-19',
    status: 'concluido',
    barbeiroId: 'diego',
    servicos: [linha('corte', 'Corte', 4000)],
  },
  {
    data: '2026-10-20',
    status: 'no_show',
    barbeiroId: 'rafael',
    servicos: [linha('corte', 'Corte', 4000)],
  },
  {
    data: '2026-10-20',
    status: 'cancelado_pela_barbearia',
    barbeiroId: 'diego',
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
      { data: '2026-10-19', producaoCentavos: 11000 },
      { data: '2026-10-20', producaoCentavos: 0 },
    ])
  })

  it('filtrando por serviço, conta só as linhas desse serviço', () => {
    const r = resumirProducao(atendimentos, { servicoIds: ['barba'] })
    expect(r.totais.atendimentos).toBe(1)
    expect(r.totais.producaoCentavos).toBe(3000)
    expect(r.porServico.map((s) => s.servicoId)).toEqual(['barba'])
  })

  it('filtrando por barbeiro, ignora os outros', () => {
    const r = resumirProducao(atendimentos, { barbeiroId: 'diego' })
    expect(r.porBarbeiro.map((b) => b.barbeiroId)).toEqual(['diego'])
    expect(r.totais).toMatchObject({
      atendimentos: 1,
      producaoCentavos: 4000,
      noShows: 0,
      cancelados: 1,
    })
  })
})
