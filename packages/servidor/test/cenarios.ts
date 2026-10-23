import { randomUUID } from 'node:crypto'
import type { Plano, StatusAgendamento } from '@navalha/core'
import { conectar, type Sql } from '@navalha/db'
import { FakePaymentProvider } from '@navalha/pagamentos'
import type { Contexto } from '../src/contexto'
import { NotificadorEmMemoria } from '../src/notificacoes'

// Cenários de teste no Postgres local. Cada teste cria a própria barbearia, com ids aleatórios,
// para os arquivos rodarem em paralelo sem um pisar no outro.

export const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:55322/postgres'

export function abrirBanco(): Sql {
  return conectar(DATABASE_URL, { max: 3 })
}

export function criarContexto(sql: Sql, agora = new Date('2026-10-20T12:00:00Z')) {
  const pagamentos = new FakePaymentProvider()
  const notificador = new NotificadorEmMemoria()
  const relogio = { agora }
  const ctx: Contexto = {
    sql,
    pagamentos,
    notificador,
    agora: () => relogio.agora,
    config: { chavePixNavalha: 'financeiro@navalha.app', custoEstornoPix: 0 },
  }
  return {
    ctx,
    pagamentos,
    notificador,
    definirAgora(data: Date) {
      relogio.agora = data
    },
  }
}

export interface BarbeariaDeTeste {
  barbeariaId: string
  subcontaId: string
  barbeiroId: string
  donoUsuarioId: string
}

export async function criarBarbearia(
  sql: Sql,
  pagamentos: FakePaymentProvider,
  opcoes: {
    plano?: Plano
    retencaoPct?: number
    prazoGratisHoras?: number
    toleranciaMin?: number
    fidelidade?: { cortes: number; servicoGratisId?: string }
    recebimentosAtivos?: boolean
  } = {},
): Promise<BarbeariaDeTeste> {
  const sufixo = randomUUID().slice(0, 8)
  const donoUsuarioId = randomUUID()
  const barbeariaId = randomUUID()
  const barbeiroId = randomUUID()
  const subcontaId = `acc_teste_${sufixo}`
  const ativos = opcoes.recebimentosAtivos ?? true

  await sql`insert into auth.users (id, email) values (${donoUsuarioId}, ${`dono-${sufixo}@teste.local`})`
  await sql`
    insert into public.barbearias (id, nome, slug, recebimentos_ativos_em, aceitar_agendamentos_online)
    values (${barbeariaId}, ${`Barbearia ${sufixo}`}, ${`teste-${sufixo}`}, ${ativos ? new Date() : null}, ${ativos})
  `
  const plano = opcoes.plano ?? 'free'
  await sql`
    insert into public.assinaturas (barbearia_id, plano, ciclo, status)
    values (${barbeariaId}, ${plano}, ${plano === 'free' ? null : 'mensal'}, 'ativa')
  `
  await sql`
    insert into public.politicas_cancelamento (barbearia_id, prazo_gratis_horas, retencao_pct, tolerancia_min)
    values (${barbeariaId}, ${opcoes.prazoGratisHoras ?? 2}, ${opcoes.retencaoPct ?? 50}, ${opcoes.toleranciaMin ?? 15})
  `
  if (ativos) {
    pagamentos.registrarSubconta(subcontaId)
    await sql`
      insert into public.subcontas_asaas (barbearia_id, asaas_conta_id, wallet_id, chave_api_secret_id, escrow_habilitado)
      values (${barbeariaId}, ${subcontaId}, ${`wal_${sufixo}`},
        vault.create_secret(${`chave-${sufixo}`}, ${`asaas-subconta-${sufixo}`}), true)
    `
  }
  await sql`
    insert into public.membros (id, barbearia_id, usuario_id, papel)
    values (${barbeiroId}, ${barbeariaId}, ${donoUsuarioId}, 'dono')
  `
  if (opcoes.fidelidade) {
    await sql`
      insert into public.fidelidade_config (barbearia_id, ativa, cortes_necessarios, servico_gratis_id)
      values (${barbeariaId}, true, ${opcoes.fidelidade.cortes}, ${opcoes.fidelidade.servicoGratisId ?? null})
    `
  }
  return { barbeariaId, subcontaId, barbeiroId, donoUsuarioId }
}

export async function criarCliente(sql: Sql): Promise<{ clienteId: string; usuarioId: string }> {
  const usuarioId = randomUUID()
  const clienteId = randomUUID()
  await sql`insert into auth.users (id, email) values (${usuarioId}, ${`cliente-${usuarioId.slice(0, 8)}@teste.local`})`
  await sql`insert into public.clientes (id, usuario_id, nome) values (${clienteId}, ${usuarioId}, 'Cliente Teste')`
  return { clienteId, usuarioId }
}

export const CARTAO_OK = {
  numero: '4111111111111111',
  nomeImpresso: 'CLIENTE',
  validade: '12/30',
  cvv: '123',
}
export const TITULAR = {
  nome: 'Cliente Teste',
  email: 'cliente@teste.local',
  cpfCnpj: '24971563792',
  cep: '05413000',
  numeroEndereco: '120',
  celular: '11987654321',
}

export async function criarAgendamento(
  sql: Sql,
  pagamentos: FakePaymentProvider,
  b: BarbeariaDeTeste,
  cliente: { clienteId: string },
  opcoes: {
    meio: 'pix' | 'cartao' | 'nenhum'
    status?: StatusAgendamento
    valor?: number
    inicio?: Date
    plano?: Plano
    retencaoPct?: number
    /** Cartão: tokenizado (só token), pre_autorizado ou capturado. */
    etapaCartao?: 'tokenizado' | 'pre_autorizado' | 'capturado'
    usouPremio?: boolean
    cartao?: typeof CARTAO_OK
  },
): Promise<{ agendamentoId: string; cobrancaId: string | null }> {
  const agendamentoId = randomUUID()
  const valor = opcoes.valor ?? 10000
  const inicio = opcoes.inicio ?? new Date('2026-10-21T16:30:00Z')
  const plano = opcoes.plano ?? 'free'

  await sql`
    insert into public.agendamentos (id, barbearia_id, cliente_id, barbeiro_id, inicio, fim, status,
      valor_bruto_centavos, valor_pago_centavos, prazo_gratis_ate, tolerancia_ate, retencao_pct, plano,
      usou_premio_fidelidade)
    values (${agendamentoId}, ${b.barbeariaId}, ${cliente.clienteId}, ${b.barbeiroId}, ${inicio},
      ${new Date(inicio.getTime() + 60 * 60_000)}, ${opcoes.status ?? 'confirmado'}, ${valor}, ${valor},
      ${new Date(inicio.getTime() - 2 * 3_600_000)}, ${new Date(inicio.getTime() + 15 * 60_000)},
      ${opcoes.retencaoPct ?? 50}, ${plano}, ${opcoes.usouPremio ?? false})
  `

  if (opcoes.meio === 'nenhum') return { agendamentoId, cobrancaId: null }

  if (opcoes.meio === 'pix') {
    const { clienteId } = await pagamentos.garantirCliente({
      subcontaId: b.subcontaId,
      cliente: { referencia: cliente.clienteId, nome: 'Cliente Teste' },
    })
    const pix = await pagamentos.criarCobrancaPix({
      subcontaId: b.subcontaId,
      clienteId,
      valor,
      expiraEm: new Date(inicio.getTime()),
      referencia: agendamentoId,
    })
    pagamentos.simularPixPago(pix.cobrancaId)
    await sql`
      insert into public.pagamentos (agendamento_id, barbearia_id, meio, status, valor_centavos, asaas_cobranca_id)
      values (${agendamentoId}, ${b.barbeariaId}, 'pix', 'pix_pago', ${valor}, ${pix.cobrancaId})
    `
    return { agendamentoId, cobrancaId: pix.cobrancaId }
  }

  const { clienteId } = await pagamentos.garantirCliente({
    subcontaId: b.subcontaId,
    cliente: { referencia: cliente.clienteId, nome: 'Cliente Teste' },
  })
  await sql`
    insert into public.clientes_gateway (cliente_id, barbearia_id, gateway_cliente_id)
    values (${cliente.clienteId}, ${b.barbeariaId}, ${clienteId})
    on conflict do nothing
  `
  const { token, final } = await pagamentos.tokenizarCartao({
    subcontaId: b.subcontaId,
    clienteId,
    cartao: opcoes.cartao ?? CARTAO_OK,
    titular: TITULAR,
    ipRemoto: '127.0.0.1',
  })
  const etapa = opcoes.etapaCartao ?? 'capturado'
  let cobrancaId: string | null = null
  let taxa = 0
  if (etapa !== 'tokenizado') {
    const pre = await pagamentos.preAutorizar({
      subcontaId: b.subcontaId,
      clienteId,
      token,
      valor,
      referencia: agendamentoId,
      ipRemoto: '127.0.0.1',
    })
    cobrancaId = pre.cobrancaId
    if (etapa === 'capturado') {
      taxa = (await pagamentos.capturar({ subcontaId: b.subcontaId, cobrancaId })).taxaGateway
    }
  }
  const prazo = new Date(inicio.getTime() - 2 * 3_600_000)
  await sql`
    insert into public.pagamentos (agendamento_id, barbearia_id, meio, status, valor_centavos,
      taxa_gateway_centavos, asaas_cobranca_id, cartao_token, cartao_final, ip_remoto, pre_autorizar_em, capturar_em)
    values (${agendamentoId}, ${b.barbeariaId}, 'cartao', ${etapa}, ${valor}, ${taxa}, ${cobrancaId},
      ${token}, ${final}, '127.0.0.1', ${new Date(prazo.getTime() - 72 * 3_600_000)}, ${prazo})
  `
  return { agendamentoId, cobrancaId }
}

export async function criarServico(
  sql: Sql,
  b: BarbeariaDeTeste,
  opcoes: { nome?: string; duracaoMin?: number; precoCentavos?: number } = {},
): Promise<string> {
  const id = randomUUID()
  await sql`
    insert into public.servicos (id, barbearia_id, nome, duracao_min, preco_centavos)
    values (${id}, ${b.barbeariaId}, ${opcoes.nome ?? 'Corte'}, ${opcoes.duracaoMin ?? 60}, ${opcoes.precoCentavos ?? 10000})
  `
  await sql`
    insert into public.servico_barbeiro (servico_id, membro_id, barbearia_id)
    values (${id}, ${b.barbeiroId}, ${b.barbeariaId})
  `
  return id
}

export async function criarReservaPix(
  sql: Sql,
  pagamentos: FakePaymentProvider,
  b: BarbeariaDeTeste,
  cliente: { clienteId: string },
  opcoes: { servicoId: string; inicio?: Date; expiraEm?: Date; valor?: number },
): Promise<{ reservaId: string; cobrancaId: string }> {
  const reservaId = randomUUID()
  const valor = opcoes.valor ?? 10000
  const inicio = opcoes.inicio ?? new Date('2026-10-22T13:00:00Z')
  const fim = new Date(inicio.getTime() + 60 * 60_000)
  const { clienteId } = await pagamentos.garantirCliente({
    subcontaId: b.subcontaId,
    cliente: { referencia: cliente.clienteId, nome: 'Cliente Teste' },
  })
  const pix = await pagamentos.criarCobrancaPix({
    subcontaId: b.subcontaId,
    clienteId,
    valor,
    expiraEm: opcoes.expiraEm ?? new Date('2026-10-20T12:20:00Z'),
    referencia: reservaId,
  })
  const dados = {
    cobrancaId: pix.cobrancaId,
    servicos: [
      { servicoId: opcoes.servicoId, nome: 'Corte', duracaoMin: 60, precoCentavos: valor },
    ],
    valorBrutoCentavos: valor,
    descontoCentavos: 0,
    valorPagoCentavos: valor,
    promocaoId: null,
    usouPremioFidelidade: false,
    plano: 'free',
    retencaoPct: 50,
    prazoGratisAte: new Date(inicio.getTime() - 2 * 3_600_000).toISOString(),
    toleranciaAte: new Date(inicio.getTime() + 15 * 60_000).toISOString(),
    origem: 'app',
  }
  await sql`
    insert into public.reservas_horario (id, barbearia_id, barbeiro_id, cliente_id, inicio, fim, expira_em, dados)
    values (${reservaId}, ${b.barbeariaId}, ${b.barbeiroId}, ${cliente.clienteId}, ${inicio}, ${fim},
      ${opcoes.expiraEm ?? new Date('2026-10-20T12:20:00Z')}, ${sql.json(dados)})
  `
  return { reservaId, cobrancaId: pix.cobrancaId }
}
