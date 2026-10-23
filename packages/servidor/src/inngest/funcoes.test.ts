import { describe, expect, it } from 'vitest'
import type { Contexto } from '../contexto'
import { criarFuncoes } from './funcoes'
import { cobrarNoCartao, lembrarUmaHoraAntes, vigiarNoShow, type Passos } from './orquestracao'

// Orquestração das funções agendadas, com passos de mentira: cada passo devolve o resultado
// combinado no teste, e as chamadas ficam registradas. Os serviços têm testes de integração.
// cartao-pre-autorizado §Fluxo do cartão.

const semContexto = (): Contexto => {
  throw new Error('os passos são simulados nestes testes; o contexto não deve ser usado')
}

function passosDeTeste(resultados: Record<string, unknown>, eventoEsperado: unknown = null) {
  const chamadas: [string, string, unknown?][] = []
  const passos: Passos = {
    async run<T>(id: string): Promise<T> {
      chamadas.push(['run', id])
      if (!(id in resultados)) throw new Error(`passo "${id}" sem resultado combinado`)
      return resultados[id] as T
    },
    async sleepUntil(id, quando) {
      chamadas.push(['sleepUntil', id, quando])
    },
    async waitForEvent(id, opcoes) {
      chamadas.push(['waitForEvent', id, opcoes])
      return eventoEsperado
    },
    async sendEvent(id, eventos) {
      chamadas.push(['sendEvent', id, eventos])
    },
  }
  return { passos, chamadas }
}

const cartao = (status: string) => ({
  meio: 'cartao',
  statusPagamento: status,
  preAutorizarEm: '2026-10-17T14:30:00.000Z',
  capturarEm: '2026-10-20T14:30:00.000Z',
})

describe('cobrarNoCartao', () => {
  it('tokenizado: espera a janela de 72h, pré-autoriza e captura no fim do prazo grátis', async () => {
    const { passos, chamadas } = passosDeTeste({
      carregar: cartao('tokenizado'),
      'pre-autorizar': { resultado: 'aprovada', eventos: [] },
      'carregar-de-novo': cartao('pre_autorizado'),
      capturar: { resultado: 'capturado', eventos: [] },
    })

    expect(await cobrarNoCartao(passos, semContexto, 'ag-1')).toBe('capturado')
    expect(chamadas).toEqual([
      ['run', 'carregar'],
      ['sleepUntil', 'aguardar-janela-de-72h', '2026-10-17T14:30:00.000Z'],
      ['run', 'pre-autorizar'],
      ['run', 'carregar-de-novo'],
      ['sleepUntil', 'aguardar-fim-do-prazo-gratis', '2026-10-20T14:30:00.000Z'],
      ['run', 'capturar'],
    ])
  })

  it('pré-autorizado no checkout (menos de 72h): vai direto esperar a captura', async () => {
    const { passos, chamadas } = passosDeTeste({
      carregar: cartao('pre_autorizado'),
      'carregar-de-novo': cartao('pre_autorizado'),
      capturar: { resultado: 'capturado', eventos: [] },
    })

    expect(await cobrarNoCartao(passos, semContexto, 'ag-1')).toBe('capturado')
    expect(chamadas.map(([tipo, id]) => `${tipo}:${id}`)).not.toContain(
      'sleepUntil:aguardar-janela-de-72h',
    )
  })

  it('recusado e sem regularização em 12h: libera o horário', async () => {
    const { passos, chamadas } = passosDeTeste(
      {
        carregar: cartao('tokenizado'),
        'pre-autorizar': { resultado: 'recusada', eventos: [] },
        'liberar-horario': { resultado: 'liberado', eventos: [] },
      },
      null,
    )

    expect(await cobrarNoCartao(passos, semContexto, 'ag-2')).toBe('liberado')
    expect(chamadas).toContainEqual([
      'waitForEvent',
      'aguardar-regularizacao',
      {
        event: 'pagamento/regularizado',
        timeout: '12h',
        if: 'async.data.agendamentoId == event.data.agendamentoId',
      },
    ])
  })

  it('recusado e regularizado com outro cartão: segue para a captura', async () => {
    const { passos } = passosDeTeste(
      {
        carregar: cartao('tokenizado'),
        'pre-autorizar': { resultado: 'recusada', eventos: [] },
        'carregar-de-novo': cartao('pre_autorizado'),
        capturar: { resultado: 'capturado', eventos: [] },
      },
      { name: 'pagamento/regularizado', data: { agendamentoId: 'ag-2' } },
    )

    expect(await cobrarNoCartao(passos, semContexto, 'ag-2')).toBe('capturado')
  })

  it('regularizado com Pix: não há o que capturar', async () => {
    const { passos } = passosDeTeste(
      {
        carregar: cartao('tokenizado'),
        'pre-autorizar': { resultado: 'recusada', eventos: [] },
        'carregar-de-novo': {
          meio: 'pix',
          statusPagamento: 'pix_pago',
          preAutorizarEm: null,
          capturarEm: null,
        },
      },
      { name: 'pagamento/regularizado', data: { agendamentoId: 'ag-2' } },
    )

    expect(await cobrarNoCartao(passos, semContexto, 'ag-2')).toBe('sem_captura')
  })

  it('Pix não passa pelo fluxo do cartão', async () => {
    const { passos } = passosDeTeste({ carregar: { meio: 'pix', statusPagamento: 'pix_pago' } })
    expect(await cobrarNoCartao(passos, semContexto, 'ag-3')).toBe('nao_e_cartao')
  })
})

describe('vigiarNoShow', () => {
  it('espera o fim da tolerância e pede a liquidação quando marca no-show', async () => {
    const finalizado = { name: 'agendamento/finalizado', data: { agendamentoId: 'ag-4' } }
    const { passos, chamadas } = passosDeTeste({
      carregar: { toleranciaAte: '2026-10-21T16:45:00.000Z' },
      'marcar-no-show': { resultado: 'no_show', eventos: [finalizado] },
    })

    expect(await vigiarNoShow(passos, semContexto, 'ag-4')).toBe('no_show')
    expect(chamadas).toEqual([
      ['run', 'carregar'],
      ['sleepUntil', 'aguardar-tolerancia', '2026-10-21T16:45:00.000Z'],
      ['run', 'marcar-no-show'],
      ['sendEvent', 'publicar', [finalizado]],
    ])
  })
})

describe('lembrarUmaHoraAntes', () => {
  it('não agenda lembrete quando o horário de lembrar já passou', async () => {
    const { passos, chamadas } = passosDeTeste({ carregar: { lembrarEm: null } })
    expect(await lembrarUmaHoraAntes(passos, semContexto, 'ag-5')).toBe('sem_lembrete')
    expect(chamadas).toEqual([['run', 'carregar']])
  })
})

describe('configuração das funções no Inngest', () => {
  const funcoes = criarFuncoes(semContexto)

  it('o fluxo do cartão, o lembrete e o no-show param quando o agendamento é cancelado', () => {
    for (const funcao of [funcoes.cobrancaNoCartao, funcoes.lembrete, funcoes.noShow]) {
      expect(funcao.opts.cancelOn).toEqual([
        expect.objectContaining({ if: 'async.data.agendamentoId == event.data.agendamentoId' }),
      ])
    }
  })

  it('liquida e processa cada webhook uma vez só (idempotência)', () => {
    expect(funcoes.liquidacao.opts.idempotency).toBe('event.data.agendamentoId')
    expect(funcoes.webhookDePagamento.opts.idempotency).toBe('event.data.eventoId')
  })

  it('o lote semanal roda toda segunda às 6h no horário de Brasília', () => {
    expect(funcoes.loteSemanal.opts.triggers).toEqual([{ cron: 'TZ=America/Sao_Paulo 0 6 * * 1' }])
  })
})
