import { randomUUID } from 'node:crypto'
import { FakePaymentProvider } from '@navalha/pagamentos'
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
import type { Usuario } from './acesso'
import { criarAgendamento, type EntradaAgendamento } from './agendar'
import {
  cancelarAgendamento,
  concluirAtendimento,
  iniciarAtendimento,
  marcarNoShow,
  previaDoCancelamento,
} from './atendimento'
import { aceitarConvite, cadastrarBarbearia, cadastrarCliente, criarConvite } from './cadastro'
import { consultarDisponibilidade } from './disponibilidade'

// Casos de uso da API (docs/roadmap.md, fase 5) contra o banco local e o gateway fake.
// Agora: terça 20/10/2026, 09:00 em São Paulo. Quarta 14:00 fica a menos de 72h do fim do
// prazo grátis (pré-autoriza na hora); a terça seguinte fica a mais de 72h (só tokeniza).
const sql = abrirBanco()
afterAll(() => sql.end())

const AGORA = new Date('2026-10-20T12:00:00Z')
const QUARTA_14H = '2026-10-21T17:00:00.000Z'
const TERCA_SEGUINTE_14H = '2026-10-27T17:00:00.000Z'

const comoUsuario = (id: string): Usuario => ({ id, anonimo: false })

async function cenario(opcoes: Parameters<typeof criarBarbeariaPronta>[2] = {}) {
  const teste = criarContexto(sql, AGORA)
  const b = await criarBarbeariaPronta(sql, teste.pagamentos, opcoes)
  const c = await criarCliente(sql)
  const entrada = (parcial: Partial<EntradaAgendamento> = {}): EntradaAgendamento => ({
    barbeariaId: b.barbeariaId,
    servicoIds: [b.servicoId],
    barbeiroId: 'qualquer',
    inicio: QUARTA_14H,
    meio: 'cartao',
    cartao: CARTAO_OK,
    titular: TITULAR,
    ipRemoto: '200.100.50.25',
    origem: 'app',
    ...parcial,
  })
  return {
    ...teste,
    b,
    c,
    cliente: comoUsuario(c.usuarioId),
    dono: comoUsuario(b.donoUsuarioId),
    entrada,
  }
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

describe('consultarDisponibilidade', () => {
  it('respeita o intervalo do barbeiro e devolve instantes no fuso certo', async () => {
    const { ctx, b } = await cenario()
    const d = await consultarDisponibilidade(ctx, {
      barbeariaId: b.barbeariaId,
      data: '2026-10-21',
      servicoIds: [b.servicoId],
    })
    const inicios = d.barbeiros[0]?.inicios ?? []
    expect(d.duracaoMin).toBe(60)
    expect(inicios).toContain('2026-10-21T12:00:00.000Z') // 09:00 em São Paulo
    expect(inicios).toContain(QUARTA_14H)
    expect(inicios).not.toContain('2026-10-21T15:00:00.000Z') // 12:00, intervalo
    expect(inicios).not.toContain('2026-10-21T21:30:00.000Z') // 18:30 terminaria depois das 19:00
  })

  it('domingo o barbeiro não atende', async () => {
    const { ctx, b } = await cenario()
    const d = await consultarDisponibilidade(ctx, {
      barbeariaId: b.barbeariaId,
      data: '2026-10-25',
      servicoIds: [b.servicoId],
    })
    expect(d.barbeiros[0]?.inicios).toEqual([])
  })
})

describe('criarAgendamento', () => {
  it('Pix: cria a reserva com QR Code e o horário some da agenda', async () => {
    const { ctx, b, cliente, entrada } = await cenario()

    const r = await criarAgendamento(ctx, cliente, entrada({ meio: 'pix' }))

    expect(r.saida).toMatchObject({
      tipo: 'pix',
      valorPagoCentavos: 10000,
      copiaECola: expect.any(String),
    })
    expect(r.eventos).toEqual([
      {
        name: 'reserva/criada',
        data: { reservaId: expect.any(String), expiraEm: '2026-10-20T12:20:00.000Z' },
      },
    ])
    const d = await consultarDisponibilidade(ctx, {
      barbeariaId: b.barbeariaId,
      data: '2026-10-21',
      servicoIds: [b.servicoId],
    })
    expect(d.barbeiros[0]?.inicios).not.toContain(QUARTA_14H)
  })

  it('outro cliente não consegue o mesmo horário enquanto a reserva está aberta', async () => {
    const { ctx, cliente, entrada } = await cenario()
    await criarAgendamento(ctx, cliente, entrada({ meio: 'pix' }))
    const outro = await criarCliente(sql)

    const erro = await erroDe(
      criarAgendamento(ctx, comoUsuario(outro.usuarioId), entrada({ meio: 'pix' })),
    )
    expect(erro.codigo).toBe('horario_indisponivel')
  })

  it('dois clientes ao mesmo tempo no mesmo horário: só um leva', async () => {
    const { ctx, cliente, entrada } = await cenario()
    const outro = await criarCliente(sql)

    const resultados = await Promise.allSettled([
      criarAgendamento(ctx, cliente, entrada({ meio: 'pix' })),
      criarAgendamento(ctx, comoUsuario(outro.usuarioId), entrada({ meio: 'pix' })),
    ])

    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const recusado = resultados.find((r) => r.status === 'rejected')
    expect(recusado?.status === 'rejected' && (recusado.reason as ErroDeNegocio).codigo).toBe(
      'horario_indisponivel',
    )
  })

  it('cartão a menos de 72h do fim do prazo grátis: pré-autoriza e já confirma', async () => {
    const { ctx, cliente, entrada } = await cenario()

    const r = await criarAgendamento(ctx, cliente, entrada())

    expect(r.saida).toMatchObject({
      tipo: 'agendado',
      status: 'confirmado',
      codigo: expect.stringMatching(/^NV-/),
      cobrancaEm: '2026-10-21T15:00:00.000Z',
    })
    expect(r.eventos).toEqual([
      { name: 'agendamento/criado', data: { agendamentoId: expect.any(String) } },
    ])
  })

  it('cartão recusado no checkout: devolve o erro e não deixa agendamento para trás', async () => {
    const { ctx, c, cliente, entrada } = await cenario()

    const erro = await erroDe(
      criarAgendamento(
        ctx,
        cliente,
        entrada({ cartao: { ...CARTAO_OK, numero: FakePaymentProvider.CARTAO_RECUSADO } }),
      ),
    )

    expect(erro.codigo).toBe('cartao_recusado')
    expect(erro.status).toBe(402)
    const restos = await sql`select 1 from public.agendamentos where cliente_id = ${c.clienteId}`
    expect(restos).toHaveLength(0)
  })

  it('cartão a mais de 72h: fica Reservado só com o cartão tokenizado', async () => {
    const { ctx, cliente, entrada } = await cenario()

    const r = await criarAgendamento(ctx, cliente, entrada({ inicio: TERCA_SEGUINTE_14H }))

    expect(r.saida).toMatchObject({ tipo: 'agendado', status: 'reservado' })
    const id = r.saida.tipo === 'agendado' ? r.saida.agendamentoId : ''
    const [pagamento] = await sql<{ status: string; pre_autorizar_em: Date }[]>`
      select status, pre_autorizar_em from public.pagamentos where agendamento_id = ${id}`
    expect(pagamento).toEqual({
      status: 'tokenizado',
      pre_autorizar_em: new Date('2026-10-24T15:00:00.000Z'),
    })
  })

  it('cupom da barbearia aplica o desconto e conta o uso', async () => {
    const { ctx, b, cliente, entrada } = await cenario()
    await sql`
      insert into public.promocoes (barbearia_id, nome, tipo, codigo, desconto_tipo, desconto_valor, inicio, fim)
      values (${b.barbeariaId}, 'Dez por cento', 'cupom', 'ZE10', 'percentual', 10, '2026-10-01', '2026-11-30')`

    const r = await criarAgendamento(ctx, cliente, entrada({ cupom: 'ze10' }))

    expect(r.saida).toMatchObject({ valorPagoCentavos: 9000 })
    const id = r.saida.tipo === 'agendado' ? r.saida.agendamentoId : ''
    const usos = await sql`select 1 from public.cupom_usos where agendamento_id = ${id}`
    expect(usos).toHaveLength(1)
  })

  it('oferta automática vale sem código e conta o uso; só nos dias marcados', async () => {
    const { ctx, b, cliente, entrada } = await cenario()
    // Quarta-feira (3) sim, terça não: a mesma oferta não vale na terça seguinte.
    await sql`
      insert into public.promocoes (barbearia_id, nome, tipo, desconto_tipo, desconto_valor,
        dias_semana, inicio, fim)
      values (${b.barbeariaId}, 'Quarta do corte', 'automatica', 'fixo', 1500, '{3}',
        '2026-10-01', '2026-11-30')`

    const quarta = await criarAgendamento(ctx, cliente, entrada())
    expect(quarta.saida).toMatchObject({ valorPagoCentavos: 8500 })
    const id = quarta.saida.tipo === 'agendado' ? quarta.saida.agendamentoId : ''
    expect(await sql`select 1 from public.cupom_usos where agendamento_id = ${id}`).toHaveLength(1)

    const outro = await criarCliente(sql)
    const terca = await criarAgendamento(
      ctx,
      comoUsuario(outro.usuarioId),
      entrada({ inicio: TERCA_SEGUINTE_14H }),
    )
    expect(terca.saida).toMatchObject({ valorPagoCentavos: 10000 })
  })

  it('com cupom, a oferta automática não soma', async () => {
    const { ctx, b, cliente, entrada } = await cenario()
    await sql`
      insert into public.promocoes (barbearia_id, nome, tipo, codigo, desconto_tipo, desconto_valor, inicio, fim)
      values
        (${b.barbeariaId}, 'Cupom', 'cupom', 'ZE10', 'percentual', 10, '2026-10-01', '2026-11-30')`
    await sql`
      insert into public.promocoes (barbearia_id, nome, tipo, desconto_tipo, desconto_valor, inicio, fim)
      values (${b.barbeariaId}, 'Oferta', 'automatica', 'fixo', 500, '2026-10-01', '2026-11-30')`

    const r = await criarAgendamento(ctx, cliente, entrada({ cupom: 'ZE10' }))
    expect(r.saida).toMatchObject({ valorPagoCentavos: 9000 })
  })

  it('cupom de outra barbearia não vale', async () => {
    const { ctx, cliente, entrada } = await cenario()
    const erro = await erroDe(criarAgendamento(ctx, cliente, entrada({ cupom: 'NAOEXISTE' })))
    expect(erro.codigo).toBe('dados_invalidos')
  })

  it('prêmio da fidelidade que cobre tudo: confirma sem cobrança', async () => {
    const teste = await cenario()
    await sql`
      insert into public.fidelidade_config (barbearia_id, ativa, cortes_necessarios, servico_gratis_id)
      values (${teste.b.barbeariaId}, true, 5, ${teste.b.servicoId})`
    await sql`
      insert into public.fidelidade_progresso (barbearia_id, cliente_id, cortes)
      values (${teste.b.barbeariaId}, ${teste.c.clienteId}, 5)`

    const r = await criarAgendamento(teste.ctx, teste.cliente, teste.entrada({ usarPremio: true }))

    expect(r.saida).toMatchObject({ tipo: 'agendado', status: 'confirmado', valorPagoCentavos: 0 })
  })

  it('barbearia que não ativou os recebimentos não aceita agendamento', async () => {
    const { ctx, cliente, entrada } = await cenario({ recebimentosAtivos: false })
    const erro = await erroDe(criarAgendamento(ctx, cliente, entrada()))
    expect(erro.codigo).toBe('recebimentos_inativos')
  })
})

describe('cancelar', () => {
  it('cliente no prazo: cancelado no prazo, e pede a liquidação', async () => {
    const { ctx, cliente, entrada } = await cenario()
    const r = await criarAgendamento(ctx, cliente, entrada())
    const id = r.saida.tipo === 'agendado' ? r.saida.agendamentoId : ''

    const cancelado = await cancelarAgendamento(ctx, cliente, { agendamentoId: id })

    expect(cancelado.status).toBe('cancelado_no_prazo')
    expect(cancelado.eventos.map((e) => e.name)).toEqual([
      'agendamento/cancelado',
      'agendamento/finalizado',
    ])
  })

  it('cliente depois do prazo grátis: cancelado fora do prazo, e a prévia mostra a retenção', async () => {
    const { ctx, cliente, entrada, definirAgora } = await cenario()
    const r = await criarAgendamento(ctx, cliente, entrada())
    const id = r.saida.tipo === 'agendado' ? r.saida.agendamentoId : ''
    definirAgora(new Date('2026-10-21T16:00:00Z'))

    const previa = await previaDoCancelamento(ctx, cliente, id)
    expect(previa.evento).toBe('cancelado_fora_do_prazo')
    expect(previa.opcoes[0]).toMatchObject({ devolvidoAoCliente: 5000, barbearia: 4000 })

    expect((await cancelarAgendamento(ctx, cliente, { agendamentoId: id })).status).toBe(
      'cancelado_fora_do_prazo',
    )
  })

  it('Pix no prazo exige escolher entre crédito e reembolso', async () => {
    const teste = await cenario()
    const id = randomUUID()
    await sql`
      insert into public.agendamentos (id, barbearia_id, cliente_id, barbeiro_id, inicio, fim, status,
        valor_bruto_centavos, valor_pago_centavos, prazo_gratis_ate, tolerancia_ate, retencao_pct, plano)
      values (${id}, ${teste.b.barbeariaId}, ${teste.c.clienteId}, ${teste.b.barbeiroId}, ${QUARTA_14H},
        '2026-10-21T18:00:00Z', 'confirmado', 10000, 10000, '2026-10-21T15:00:00Z', '2026-10-21T17:15:00Z', 50, 'free')`
    await sql`
      insert into public.pagamentos (agendamento_id, barbearia_id, meio, status, valor_centavos)
      values (${id}, ${teste.b.barbeariaId}, 'pix', 'pix_pago', 10000)`

    expect(
      (await erroDe(cancelarAgendamento(teste.ctx, teste.cliente, { agendamentoId: id }))).codigo,
    ).toBe('dados_invalidos')
    const previa = await previaDoCancelamento(teste.ctx, teste.cliente, id)
    expect(previa.opcoes.map((o) => o.escolhaPix)).toEqual(['credito', 'reembolso'])
  })

  it('quem não é o cliente nem da equipe não cancela', async () => {
    const { ctx, cliente, entrada } = await cenario()
    const r = await criarAgendamento(ctx, cliente, entrada())
    const id = r.saida.tipo === 'agendado' ? r.saida.agendamentoId : ''
    const estranho = await criarCliente(sql)

    const erro = await erroDe(
      cancelarAgendamento(ctx, comoUsuario(estranho.usuarioId), { agendamentoId: id }),
    )
    expect(erro.codigo).toBe('sem_permissao')
  })

  it('a barbearia cancela: cancelado pela barbearia', async () => {
    const { ctx, cliente, dono, entrada } = await cenario()
    const r = await criarAgendamento(ctx, cliente, entrada())
    const id = r.saida.tipo === 'agendado' ? r.saida.agendamentoId : ''

    expect((await cancelarAgendamento(ctx, dono, { agendamentoId: id })).status).toBe(
      'cancelado_pela_barbearia',
    )
  })
})

describe('atendimento', () => {
  it('a equipe inicia e conclui; concluir pede a liquidação', async () => {
    const { ctx, cliente, dono, entrada } = await cenario()
    const r = await criarAgendamento(ctx, cliente, entrada())
    const id = r.saida.tipo === 'agendado' ? r.saida.agendamentoId : ''

    expect((await iniciarAtendimento(ctx, dono, id)).status).toBe('em_atendimento')
    const concluido = await concluirAtendimento(ctx, dono, id)
    expect(concluido.status).toBe('concluido')
    expect(concluido.eventos).toEqual([
      { name: 'agendamento/finalizado', data: { agendamentoId: id } },
    ])
  })

  it('o cliente não inicia o próprio atendimento', async () => {
    const { ctx, cliente, entrada } = await cenario()
    const r = await criarAgendamento(ctx, cliente, entrada())
    const id = r.saida.tipo === 'agendado' ? r.saida.agendamentoId : ''
    expect((await erroDe(iniciarAtendimento(ctx, cliente, id))).codigo).toBe('sem_permissao')
  })

  it('no-show manual só depois da tolerância de atraso', async () => {
    const { ctx, cliente, dono, entrada, definirAgora } = await cenario()
    const r = await criarAgendamento(ctx, cliente, entrada())
    const id = r.saida.tipo === 'agendado' ? r.saida.agendamentoId : ''

    definirAgora(new Date('2026-10-21T17:10:00Z'))
    expect((await erroDe(marcarNoShow(ctx, dono, id))).codigo).toBe('estado_invalido')

    definirAgora(new Date('2026-10-21T17:16:00Z'))
    expect((await marcarNoShow(ctx, dono, id)).status).toBe('no_show')
  })
})

describe('cadastros', () => {
  it('cadastra a barbearia com dono, plano em trial, política e horário inicial', async () => {
    const { ctx } = criarContexto(sql, AGORA)
    const dono = await criarCliente(sql)
    const slug = `ze-${randomUUID().slice(0, 8)}`

    const r = await cadastrarBarbearia(ctx, comoUsuario(dono.usuarioId), {
      nome: `Cadastro ${slug}`,
      slug,
      nomeDoDono: 'Zé Barbosa',
      plano: 'basic',
      ciclo: 'mensal',
    })
    // Fora da busca do app: o banco local é o mesmo da demonstração.
    await sql`update public.barbearias set aparecer_nas_buscas = false where id = ${r.barbeariaId}`

    const [assinatura] = await sql<{ status: string; trial_ate: Date }[]>`
      select status, trial_ate from public.assinaturas where barbearia_id = ${r.barbeariaId}`
    expect(assinatura).toEqual({ status: 'trial', trial_ate: new Date('2026-11-03T12:00:00Z') })
    const horarios =
      await sql`select 1 from public.horarios_barbearia where barbearia_id = ${r.barbeariaId}`
    expect(horarios).toHaveLength(6)

    const repetido = await erroDe(
      cadastrarBarbearia(ctx, comoUsuario(dono.usuarioId), {
        nome: 'Outra',
        slug,
        nomeDoDono: 'Zé',
        plano: 'free',
      }),
    )
    expect(repetido.codigo).toBe('dados_invalidos')
  })

  it('convite: o dono gera, o barbeiro aceita uma vez e entra na equipe com os serviços', async () => {
    const { ctx, b, dono } = await cenario()
    const { token } = await criarConvite(ctx, dono, {
      barbeariaId: b.barbeariaId,
      nome: 'Matheus Rocha',
      servicoIds: [b.servicoId],
    })
    const novo = await criarCliente(sql)

    const r = await aceitarConvite(ctx, comoUsuario(novo.usuarioId), { token })

    const servicos =
      await sql`select 1 from public.servico_barbeiro where membro_id = ${r.membroId}`
    expect(servicos).toHaveLength(1)
    const outro = await criarCliente(sql)
    expect(
      (await erroDe(aceitarConvite(ctx, comoUsuario(outro.usuarioId), { token }))).codigo,
    ).toBe('estado_invalido')
  })

  it('só o dono gera convite', async () => {
    const { ctx, b, cliente } = await cenario()
    const erro = await erroDe(
      criarConvite(ctx, cliente, { barbeariaId: b.barbeariaId, nome: 'X', servicoIds: [] }),
    )
    expect(erro.codigo).toBe('sem_permissao')
  })

  it('cadastro do cliente atualiza em vez de duplicar', async () => {
    const { ctx } = criarContexto(sql, AGORA)
    const usuarioId = randomUUID()
    await sql`insert into auth.users (id, is_anonymous) values (${usuarioId}, true)`
    const primeiro = await cadastrarCliente(
      ctx,
      { id: usuarioId, anonimo: true },
      { nome: 'Lucas', celular: '11987654321' },
    )
    const segundo = await cadastrarCliente(
      ctx,
      { id: usuarioId, anonimo: true },
      { nome: 'Lucas Andrade', email: 'lucas@exemplo.com' },
    )
    expect(segundo.clienteId).toBe(primeiro.clienteId)
  })
})
