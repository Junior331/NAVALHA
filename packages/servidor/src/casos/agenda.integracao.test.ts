import { afterAll, describe, expect, it } from 'vitest'
import {
  CARTAO_OK,
  TITULAR,
  abrirBanco,
  criarBarbeariaPronta,
  criarCliente,
  criarContexto,
} from '../../test/cenarios'
import { ErroDeNegocio } from '../erros'
import { enviarLembrete, marcarNoShowSeVencido } from '../servicos/rotina'
import { criarAgendamento, type EntradaAgendamento } from './agendar'
import { agendarNoBalcao, remarcarAgendamento } from './agenda'

// Admin 02i (remarcar) e 02d–02h (novo agendamento pelo balcão). Agora: terça 20/10, 09:00 SP.
const sql = abrirBanco()
afterAll(() => sql.end())

const AGORA = new Date('2026-10-20T12:00:00Z')
const QUARTA_14H = '2026-10-21T17:00:00.000Z'
const QUARTA_16H = '2026-10-21T19:00:00.000Z'

async function cenario() {
  const teste = criarContexto(sql, AGORA)
  const b = await criarBarbeariaPronta(sql, teste.pagamentos)
  const c = await criarCliente(sql)
  const cliente = { id: c.usuarioId, anonimo: false }
  const dono = { id: b.donoUsuarioId, anonimo: false }
  const entrada: EntradaAgendamento = {
    barbeariaId: b.barbeariaId,
    servicoIds: [b.servicoId],
    barbeiroId: 'qualquer',
    inicio: QUARTA_14H,
    meio: 'cartao',
    cartao: CARTAO_OK,
    titular: TITULAR,
    ipRemoto: '127.0.0.1',
    origem: 'app',
  }
  const agendar = async (parcial: Partial<EntradaAgendamento> = {}) => {
    const r = await criarAgendamento(teste.ctx, cliente, { ...entrada, ...parcial })
    return r.saida.tipo === 'agendado' ? r.saida.agendamentoId : ''
  }
  return { ...teste, b, c, cliente, dono, agendar }
}

async function erroDe(promessa: Promise<unknown>): Promise<ErroDeNegocio> {
  try {
    await promessa
  } catch (erro) {
    if (erro instanceof ErroDeNegocio) return erro
    throw erro
  }
  throw new Error('era esperado um ErroDeNegocio')
}

describe('remarcarAgendamento', () => {
  it('o cliente remarca dentro do prazo grátis: muda o horário, os prazos e a versão', async () => {
    const t = await cenario()
    const id = await t.agendar()

    const r = await remarcarAgendamento(t.ctx, t.cliente, { agendamentoId: id, inicio: QUARTA_16H })

    expect(r.eventos).toEqual([
      { name: 'agendamento/criado', data: { agendamentoId: id, versao: 2 } },
    ])
    const [ag] = await sql<{ inicio: Date; prazo_gratis_ate: Date; versao: number }[]>`
      select inicio, prazo_gratis_ate, versao from public.agendamentos where id = ${id}`
    expect(ag).toEqual({
      inicio: new Date(QUARTA_16H),
      prazo_gratis_ate: new Date('2026-10-21T17:00:00.000Z'),
      versao: 2,
    })
    const [pagamento] = await sql<{ capturar_em: Date }[]>`
      select capturar_em from public.pagamentos where agendamento_id = ${id}`
    expect(pagamento?.capturar_em).toEqual(new Date('2026-10-21T17:00:00.000Z'))
  })

  it('o cliente não remarca depois do prazo grátis; a equipe ainda pode', async () => {
    const t = await cenario()
    const id = await t.agendar()
    t.definirAgora(new Date('2026-10-21T16:00:00Z'))

    expect(
      (
        await erroDe(
          remarcarAgendamento(t.ctx, t.cliente, { agendamentoId: id, inicio: QUARTA_16H }),
        )
      ).codigo,
    ).toBe('estado_invalido')
    await remarcarAgendamento(t.ctx, t.dono, { agendamentoId: id, inicio: QUARTA_16H })
  })

  it('pode remarcar para um horário que encosta no atual (o próprio agendamento não conflita)', async () => {
    const t = await cenario()
    const id = await t.agendar()
    await remarcarAgendamento(t.ctx, t.cliente, {
      agendamentoId: id,
      inicio: '2026-10-21T17:30:00.000Z',
    })
  })

  it('não remarca para horário ocupado', async () => {
    const t = await cenario()
    const id = await t.agendar()
    const outro = await criarCliente(sql)
    await criarAgendamento(
      t.ctx,
      { id: outro.usuarioId, anonimo: false },
      {
        barbeariaId: t.b.barbeariaId,
        servicoIds: [t.b.servicoId],
        barbeiroId: 'qualquer',
        inicio: QUARTA_16H,
        meio: 'cartao',
        cartao: CARTAO_OK,
        titular: TITULAR,
        ipRemoto: '127.0.0.1',
        origem: 'app',
      },
    )

    const erro = await erroDe(
      remarcarAgendamento(t.ctx, t.cliente, { agendamentoId: id, inicio: QUARTA_16H }),
    )
    expect(erro.codigo).toBe('horario_indisponivel')
  })

  it('jobs agendados para a versão antiga se descartam ao acordar', async () => {
    const t = await cenario()
    const id = await t.agendar()
    await remarcarAgendamento(t.ctx, t.cliente, { agendamentoId: id, inicio: QUARTA_16H })
    t.definirAgora(new Date('2026-10-21T17:20:00Z'))

    expect((await marcarNoShowSeVencido(t.ctx, id, 1)).resultado).toBe('ignorado')
    expect((await enviarLembrete(t.ctx, id, 1)).resultado).toBe('ignorado')
    expect((await enviarLembrete(t.ctx, id, 2)).resultado).toBe('enviado')
  })
})

describe('agendarNoBalcao', () => {
  it('a equipe agenda um cliente novo, com pagamento combinado na barbearia', async () => {
    const t = await cenario()

    const r = await agendarNoBalcao(t.ctx, t.dono, {
      barbeariaId: t.b.barbeariaId,
      cliente: { nome: 'Cliente do Balcão', celular: '11999990000' },
      servicoIds: [t.b.servicoId],
      barbeiroId: t.b.barbeiroId,
      inicio: QUARTA_14H,
    })

    expect(r.codigo).toMatch(/^NV-/)
    const [ag] = await sql<
      { status: string; origem: string; pago_no_balcao: boolean; valor_pago_centavos: number }[]
    >`
      select status, origem, pago_no_balcao, valor_pago_centavos from public.agendamentos where id = ${r.agendamentoId}`
    expect(ag).toEqual({
      status: 'confirmado',
      origem: 'balcao',
      pago_no_balcao: true,
      valor_pago_centavos: 10000,
    })
  })

  it('quem não é da equipe não agenda pelo balcão', async () => {
    const t = await cenario()
    const erro = await erroDe(
      agendarNoBalcao(t.ctx, t.cliente, {
        barbeariaId: t.b.barbeariaId,
        cliente: { nome: 'X' },
        servicoIds: [t.b.servicoId],
        barbeiroId: t.b.barbeiroId,
        inicio: QUARTA_14H,
      }),
    )
    expect(erro.codigo).toBe('sem_permissao')
  })
})
