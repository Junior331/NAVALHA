import { afterAll, describe, expect, it, vi } from 'vitest'
import type { Sql } from '@navalha/db'
import {
  abrirBanco,
  criarAgendamento,
  criarBarbearia,
  criarCliente,
  criarContexto,
  type BarbeariaDeTeste,
} from '../../test/cenarios'
import { chaveDaSubcontaNoVault } from '../configuracao'
import { ErroDeNegocio } from '../erros'
import {
  ativarRecebimentos,
  consultarCarteira,
  definirAgendamentosOnline,
  solicitarSaque,
  type DadosAtivacao,
} from './financeiro'

// Admin · Ativar recebimentos e Financeiro (ajustes-taxas §Subconta; cartao-pre-autorizado
// §Transferência; regras-de-negocio §Decisões: saque mínimo de R$ 50 sobre o disponível).
const sql = abrirBanco()
afterAll(() => sql.end())

async function erroDe(promessa: Promise<unknown>): Promise<ErroDeNegocio> {
  try {
    await promessa
  } catch (erro) {
    if (erro instanceof ErroDeNegocio) return erro
    throw erro
  }
  throw new Error('era esperado um ErroDeNegocio')
}

const dadosDe = (barbeariaId: string): DadosAtivacao => ({
  barbeariaId,
  titular: {
    nome: 'José Barbosa',
    email: 'ze@barbeariadoze.com',
    cpfCnpj: '24971563792',
    celular: '11987654321',
    faturamentoMensalCentavos: 1_000_000,
    endereco: { logradouro: 'Rua Augusta', numero: '120', bairro: 'Pinheiros', cep: '05413000' },
  },
  chavePix: 'ze@barbeariadoze.com',
})

describe('ativarRecebimentos', () => {
  it('cria a subconta com Escrow, guarda a chave no Vault e liga os agendamentos online', async () => {
    const t = criarContexto(sql)
    const b = await criarBarbearia(sql, t.pagamentos, { recebimentosAtivos: false })
    const dono = { id: b.donoUsuarioId, anonimo: false }

    expect(await ativarRecebimentos(t.ctx, dono, dadosDe(b.barbeariaId))).toEqual({
      situacao: 'aprovada',
    })

    const [barbearia] = await sql<{ ativa: boolean; online: boolean }[]>`
      select recebimentos_ativos_em is not null as ativa, aceitar_agendamentos_online as online
      from public.barbearias where id = ${b.barbeariaId}`
    expect(barbearia).toEqual({ ativa: true, online: true })
    const [subconta] = await sql<
      { asaas_conta_id: string; escrow_habilitado: boolean; chave_pix_saque: string }[]
    >`
      select asaas_conta_id, escrow_habilitado, chave_pix_saque from public.subcontas_asaas
      where barbearia_id = ${b.barbeariaId}`
    expect(subconta?.escrow_habilitado).toBe(true)
    expect(subconta?.chave_pix_saque).toBe('ze@barbeariadoze.com')
    expect(await chaveDaSubcontaNoVault(sql, subconta?.asaas_conta_id ?? '')).toMatch(/^chave_/)

    const erro = await erroDe(ativarRecebimentos(t.ctx, dono, dadosDe(b.barbeariaId)))
    expect(erro.codigo).toBe('estado_invalido')
  })

  it('se o Escrow falhar, tentar de novo não cria outra subconta', async () => {
    const t = criarContexto(sql)
    const b = await criarBarbearia(sql, t.pagamentos, { recebimentosAtivos: false })
    const dono = { id: b.donoUsuarioId, anonimo: false }
    const criar = vi.spyOn(t.pagamentos, 'criarSubconta')
    const escrow = vi
      .spyOn(t.pagamentos, 'habilitarEscrow')
      .mockRejectedValueOnce(new Error('gateway fora do ar'))

    await expect(ativarRecebimentos(t.ctx, dono, dadosDe(b.barbeariaId))).rejects.toThrow(
      'gateway fora do ar',
    )
    await ativarRecebimentos(t.ctx, dono, dadosDe(b.barbeariaId))

    expect(criar).toHaveBeenCalledTimes(1)
    expect(escrow).toHaveBeenCalledTimes(2)
  })

  it('só o dono ativa os recebimentos', async () => {
    const t = criarContexto(sql)
    const b = await criarBarbearia(sql, t.pagamentos, { recebimentosAtivos: false })
    const c = await criarCliente(sql)
    const erro = await erroDe(
      ativarRecebimentos(t.ctx, { id: c.usuarioId, anonimo: false }, dadosDe(b.barbeariaId)),
    )
    expect(erro.codigo).toBe('sem_permissao')
  })
})

async function liquidacao(
  b: BarbeariaDeTeste,
  agendamentoId: string,
  valores: { barbearia: number; navalha: number; criadoEm?: Date },
) {
  await sql`
    insert into public.lancamentos (barbearia_id, agendamento_id, tipo, evento_final, valor_pago_centavos,
      barbearia_centavos, navalha_centavos, criado_em)
    values (${b.barbeariaId}, ${agendamentoId}, 'liquidacao', 'concluido', 10000,
      ${valores.barbearia}, ${valores.navalha}, ${valores.criadoEm ?? new Date()})`
  if (valores.navalha !== 0) {
    await sql`
      insert into public.taxas_a_transferir (barbearia_id, agendamento_id, valor_centavos)
      values (${b.barbeariaId}, ${agendamentoId}, ${valores.navalha})`
  }
}

async function cenarioDaCarteira(banco: Sql) {
  const t = criarContexto(banco)
  const b = await criarBarbearia(banco, t.pagamentos)
  const dono = { id: b.donoUsuarioId, anonimo: false }
  const cliente = await criarCliente(banco)
  await banco`
    update public.subcontas_asaas set status_kyc = 'aprovado', chave_pix_saque = 'ze@barbeariadoze.com'
    where barbearia_id = ${b.barbeariaId}`

  // A: Pix pago, ainda não atendido (retido no Escrow).
  await criarAgendamento(banco, t.pagamentos, b, cliente, {
    meio: 'pix',
    inicio: new Date('2026-10-21T16:30:00Z'),
  })
  // B: cartão pré-autorizado, cobrado no fim do prazo grátis.
  await criarAgendamento(banco, t.pagamentos, b, cliente, {
    meio: 'cartao',
    etapaCartao: 'pre_autorizado',
    inicio: new Date('2026-10-21T18:00:00Z'),
  })
  // C: Pix já liquidado: parte da barbearia e taxa da Navalha ainda na subconta.
  const c = await criarAgendamento(banco, t.pagamentos, b, cliente, {
    meio: 'pix',
    status: 'concluido',
    inicio: new Date('2026-10-19T13:00:00Z'),
  })
  await liquidacao(b, c.agendamentoId, { barbearia: 9200, navalha: 800 })
  // D: cartão liquidado há pouco: o Asaas ainda não liberou (a receber).
  const d = await criarAgendamento(banco, t.pagamentos, b, cliente, {
    meio: 'cartao',
    status: 'concluido',
    inicio: new Date('2026-10-19T15:00:00Z'),
  })
  await liquidacao(b, d.agendamentoId, { barbearia: 9300, navalha: 200 })
  await banco`
    insert into public.saques (barbearia_id, valor_centavos, status)
    values (${b.barbeariaId}, 2000 + 3000, 'concluida')`
  return { ...t, b, dono }
}

describe('consultarCarteira', () => {
  it('separa retido, pré-autorizado, a receber e disponível (saldo menos as taxas a transferir)', async () => {
    const t = await cenarioDaCarteira(sql)

    expect(await consultarCarteira(t.ctx, t.dono, t.b.barbeariaId)).toEqual({
      ativa: true,
      cadastroAprovado: true,
      retidoCentavos: 10000,
      preAutorizadoCentavos: 10000,
      aReceberCentavos: 9300,
      saldoCentavos: 5000,
      taxasATransferirCentavos: 1000,
      disponivelCentavos: 4000,
      saqueMinimoCentavos: 5000,
    })
  })

  it('o cartão liquidado há mais de 32 dias já entra no saldo', async () => {
    const t = criarContexto(sql)
    const b = await criarBarbearia(sql, t.pagamentos)
    const cliente = await criarCliente(sql)
    const d = await criarAgendamento(sql, t.pagamentos, b, cliente, {
      meio: 'cartao',
      status: 'concluido',
      inicio: new Date('2026-09-01T15:00:00Z'),
    })
    await liquidacao(b, d.agendamentoId, {
      barbearia: 9300,
      navalha: 0,
      criadoEm: new Date('2026-09-01T17:00:00Z'),
    })

    const carteira = await consultarCarteira(
      t.ctx,
      { id: b.donoUsuarioId, anonimo: false },
      b.barbeariaId,
    )
    expect(carteira.aReceberCentavos).toBe(0)
    expect(carteira.disponivelCentavos).toBe(9300)
  })

  it('a carteira é só do dono', async () => {
    const t = await cenarioDaCarteira(sql)
    const c = await criarCliente(sql)
    const erro = await erroDe(
      consultarCarteira(t.ctx, { id: c.usuarioId, anonimo: false }, t.b.barbeariaId),
    )
    expect(erro.codigo).toBe('sem_permissao')
  })
})

describe('solicitarSaque', () => {
  it('saca do disponível por Pix para a chave da barbearia', async () => {
    const t = await cenarioDaCarteira(sql)
    await sql`delete from public.saques where barbearia_id = ${t.b.barbeariaId}`

    const { saqueId } = await solicitarSaque(t.ctx, t.dono, {
      barbeariaId: t.b.barbeariaId,
      valorCentavos: 5000,
    })

    expect(t.pagamentos.transferencias.at(-1)).toMatchObject({
      chavePix: 'ze@barbeariadoze.com',
      valor: 5000,
      referencia: `saque:${saqueId}`,
    })
    const [saque] = await sql<
      { status: string }[]
    >`select status from public.saques where id = ${saqueId}`
    expect(saque?.status).toBe('concluida')
    expect((await consultarCarteira(t.ctx, t.dono, t.b.barbeariaId)).disponivelCentavos).toBe(4000)
  })

  it('recusa abaixo de R$ 50 e acima do disponível', async () => {
    const t = await cenarioDaCarteira(sql)
    const pouco = await erroDe(
      solicitarSaque(t.ctx, t.dono, { barbeariaId: t.b.barbeariaId, valorCentavos: 4999 }),
    )
    expect(pouco.message).toBe('O saque mínimo é de R$ 50,00')
    // Disponível de R$ 40: mesmo o mínimo passa do que dá para sacar.
    const muito = await erroDe(
      solicitarSaque(t.ctx, t.dono, { barbeariaId: t.b.barbeariaId, valorCentavos: 5000 }),
    )
    expect(muito.message).toBe('Você pode sacar até R$ 40,00')
  })

  it('não saca com o cadastro em análise', async () => {
    const t = await cenarioDaCarteira(sql)
    await sql`update public.subcontas_asaas set status_kyc = 'pendente' where barbearia_id = ${t.b.barbeariaId}`
    const erro = await erroDe(
      solicitarSaque(t.ctx, t.dono, { barbeariaId: t.b.barbeariaId, valorCentavos: 5000 }),
    )
    expect(erro.codigo).toBe('estado_invalido')
  })

  it('se o banco recusar, o saque falha e o disponível volta', async () => {
    const t = await cenarioDaCarteira(sql)
    await sql`delete from public.saques where barbearia_id = ${t.b.barbeariaId}`
    vi.spyOn(t.pagamentos, 'transferirPix').mockRejectedValueOnce(new Error('saldo insuficiente'))
    vi.spyOn(console, 'error').mockImplementationOnce(() => undefined)

    const erro = await erroDe(
      solicitarSaque(t.ctx, t.dono, { barbeariaId: t.b.barbeariaId, valorCentavos: 6000 }),
    )

    expect(erro.codigo).toBe('estado_invalido')
    const [saque] = await sql<{ status: string }[]>`
      select status from public.saques where barbearia_id = ${t.b.barbeariaId}`
    expect(saque?.status).toBe('falhou')
    expect((await consultarCarteira(t.ctx, t.dono, t.b.barbeariaId)).disponivelCentavos).toBe(9000)
  })
})

describe('definirAgendamentosOnline', () => {
  it('só liga depois de ativar os recebimentos', async () => {
    const t = criarContexto(sql)
    const inativa = await criarBarbearia(sql, t.pagamentos, { recebimentosAtivos: false })
    const erro = await erroDe(
      definirAgendamentosOnline(
        t.ctx,
        { id: inativa.donoUsuarioId, anonimo: false },
        {
          barbeariaId: inativa.barbeariaId,
          aceitar: true,
        },
      ),
    )
    expect(erro.codigo).toBe('recebimentos_inativos')

    const ativa = await criarBarbearia(sql, t.pagamentos)
    const dono = { id: ativa.donoUsuarioId, anonimo: false }
    await definirAgendamentosOnline(t.ctx, dono, { barbeariaId: ativa.barbeariaId, aceitar: false })
    const [b] = await sql<{ online: boolean }[]>`
      select aceitar_agendamentos_online as online from public.barbearias where id = ${ativa.barbeariaId}`
    expect(b?.online).toBe(false)
  })
})
