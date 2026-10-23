import { randomUUID } from 'node:crypto'
import {
  aplicarCupom,
  aplicarPremio,
  fimDaTolerancia,
  fimDoPrazoGratis,
  partesLocais,
  planejarCobrancaNoCartao,
  temPremio,
  validarCupom,
  type ItemDoPedido,
  type MotivoCupomInvalido,
  type Plano,
  type ValorComDesconto,
} from '@navalha/core'
import type { Sql, Transacao } from '@navalha/db'
import type { DadosCartao, TitularCartao } from '@navalha/pagamentos'
import type { Contexto, EventoInterno } from '../contexto'
import { ErroDeNegocio } from '../erros'
import type { DadosReserva } from '../servicos/pix'
import { clienteDoUsuario, type Usuario } from './acesso'
import {
  carregarServicos,
  consultarDisponibilidade,
  type ServicoEscolhido,
} from './disponibilidade'

// Criação do agendamento (Figma Cliente 07–12). Pagamento 100% antecipado (regras-de-negocio
// §Fluxo do dinheiro): Pix vira reserva até ser pago; cartão é tokenizado e pré-autorizado na
// janela de 72h antes do fim do prazo grátis (cartao-pre-autorizado §Cartão).

const RESERVA_PIX_MIN = 20
const QR_CODE_MIN = 10

export interface EntradaAgendamento {
  barbeariaId: string
  servicoIds: string[]
  /** Id do membro, ou "qualquer" (primeiro barbeiro livre no horário). */
  barbeiroId: string
  inicio: string
  meio: 'pix' | 'cartao'
  cupom?: string
  usarPremio?: boolean
  cartao?: DadosCartao
  titular?: TitularCartao
  ipRemoto: string
  origem: 'app' | 'web'
}

export type SaidaAgendamento =
  | {
      tipo: 'pix'
      reservaId: string
      valorPagoCentavos: number
      copiaECola: string
      qrCodeBase64: string
      qrCodeExpiraEm: string
      reservadoAte: string
    }
  | {
      tipo: 'agendado'
      agendamentoId: string
      codigo: string
      status: 'confirmado' | 'reservado'
      valorPagoCentavos: number
      /** Cartão: quando a cobrança acontece (fim do prazo grátis). */
      cobrancaEm: string | null
    }

interface BarbeariaParaAgendar {
  id: string
  fuso: string
  subcontaId: string
  plano: Plano
  prazoGratisHoras: number
  retencaoPct: number
  toleranciaMin: number
}

interface Pedido {
  barbearia: BarbeariaParaAgendar
  clienteId: string
  barbeiroId: string
  inicio: Date
  fim: Date
  servicos: ServicoEscolhido[]
  valor: ValorComDesconto
  promocaoId: string | null
  usouPremio: boolean
  prazoGratisAte: Date
  toleranciaAte: Date
  origem: 'app' | 'web'
}

export async function criarAgendamento(
  ctx: Contexto,
  usuario: Usuario,
  entrada: EntradaAgendamento,
): Promise<{ saida: SaidaAgendamento; eventos: EventoInterno[] }> {
  const clienteId = await clienteDoUsuario(ctx.sql, usuario)
  const barbearia = await barbeariaParaAgendar(ctx.sql, entrada.barbeariaId)
  const inicio = new Date(entrada.inicio)
  if (Number.isNaN(inicio.getTime())) throw new ErroDeNegocio('dados_invalidos', 'Horário inválido')

  const local = partesLocais(inicio, barbearia.fuso)
  const disponibilidade = await consultarDisponibilidade(ctx, {
    barbeariaId: barbearia.id,
    data: local.data,
    servicoIds: entrada.servicoIds,
    ...(entrada.barbeiroId === 'qualquer' ? {} : { barbeiroId: entrada.barbeiroId }),
  })
  const barbeiro = disponibilidade.barbeiros.find((b) => b.inicios.includes(inicio.toISOString()))
  if (!barbeiro) {
    throw new ErroDeNegocio('horario_indisponivel', 'Esse horário não está mais disponível')
  }

  const itens: ItemDoPedido[] = disponibilidade.servicos.map((s) => ({
    servicoId: s.servicoId,
    preco: s.precoCentavos,
  }))
  const preco = await calcularPreco(ctx, {
    barbeariaId: barbearia.id,
    clienteId,
    itens,
    inicio,
    diaSemana: local.diaSemana,
    ...(entrada.cupom ? { cupom: entrada.cupom } : {}),
    usarPremio: entrada.usarPremio ?? false,
  })

  const politica = {
    prazoGratisHoras: barbearia.prazoGratisHoras,
    retencaoPct: barbearia.retencaoPct,
    toleranciaMin: barbearia.toleranciaMin,
  }
  const pedido: Pedido = {
    barbearia,
    clienteId,
    barbeiroId: barbeiro.barbeiroId,
    inicio,
    fim: new Date(inicio.getTime() + disponibilidade.duracaoMin * 60_000),
    servicos: disponibilidade.servicos,
    valor: preco.valor,
    promocaoId: preco.promocaoId,
    usouPremio: preco.usouPremio,
    prazoGratisAte: fimDoPrazoGratis(inicio, politica),
    toleranciaAte: fimDaTolerancia(inicio, politica),
    origem: entrada.origem,
  }

  if (pedido.valor.valorPago === 0) return agendarSemPagamento(ctx, pedido)
  if (entrada.meio === 'pix') return reservarComPix(ctx, pedido)
  return agendarNoCartao(ctx, pedido, entrada)
}

async function barbeariaParaAgendar(sql: Sql, barbeariaId: string): Promise<BarbeariaParaAgendar> {
  const [b] = await sql<
    {
      id: string
      fuso: string
      aceitar_agendamentos_online: boolean
      subconta_id: string | null
      plano: Plano | null
      prazo_gratis_horas: string | null
      retencao_pct: number | null
      tolerancia_min: number | null
    }[]
  >`
    select b.id, b.fuso, b.aceitar_agendamentos_online, s.asaas_conta_id as subconta_id, a.plano,
      p.prazo_gratis_horas::text, p.retencao_pct, p.tolerancia_min
    from public.barbearias b
    left join public.subcontas_asaas s on s.barbearia_id = b.id
    left join public.assinaturas a on a.barbearia_id = b.id
    left join public.politicas_cancelamento p on p.barbearia_id = b.id
    where b.id = ${barbeariaId}`
  if (!b) throw new ErroDeNegocio('nao_encontrado', 'Barbearia não encontrada')
  if (!b.aceitar_agendamentos_online || !b.subconta_id) {
    throw new ErroDeNegocio(
      'recebimentos_inativos',
      'Esta barbearia ainda não está recebendo agendamentos online',
    )
  }
  return {
    id: b.id,
    fuso: b.fuso,
    subcontaId: b.subconta_id,
    plano: b.plano ?? 'free',
    prazoGratisHoras: Number(b.prazo_gratis_horas ?? 2),
    retencaoPct: b.retencao_pct ?? 50,
    toleranciaMin: b.tolerancia_min ?? 15,
  }
}

const MENSAGENS_CUPOM: Record<MotivoCupomInvalido, string> = {
  outra_barbearia: 'Esse cupom não vale nesta barbearia',
  fora_do_periodo: 'Esse cupom não vale para a data escolhida',
  dia_invalido: 'Esse cupom não vale neste dia da semana',
  servico_nao_abrangido: 'Esse cupom não vale para os serviços escolhidos',
  esgotado: 'Esse cupom esgotou',
  ja_usado: 'Você já usou esse cupom',
}

export async function calcularPreco(
  ctx: Contexto,
  params: {
    barbeariaId: string
    clienteId: string
    itens: ItemDoPedido[]
    inicio: Date
    diaSemana: number
    cupom?: string
    usarPremio: boolean
  },
): Promise<{ valor: ValorComDesconto; promocaoId: string | null; usouPremio: boolean }> {
  const bruto = params.itens.reduce((total, i) => total + i.preco, 0)
  const semDesconto = {
    valor: { valorBruto: bruto, desconto: 0, valorPago: bruto },
    promocaoId: null,
    usouPremio: false,
  }

  if (params.usarPremio) {
    const [fidelidade] = await ctx.sql<
      {
        ativa: boolean
        cortes_necessarios: number
        servico_gratis_id: string | null
        cortes: number | null
      }[]
    >`
      select f.ativa, f.cortes_necessarios, f.servico_gratis_id, p.cortes
      from public.fidelidade_config f
      left join public.fidelidade_progresso p on p.barbearia_id = f.barbearia_id and p.cliente_id = ${params.clienteId}
      where f.barbearia_id = ${params.barbeariaId}`
    const config = fidelidade?.servico_gratis_id
      ? {
          ativa: fidelidade.ativa,
          cortesNecessarios: fidelidade.cortes_necessarios,
          servicoGratisId: fidelidade.servico_gratis_id,
        }
      : null
    if (!config || !temPremio(fidelidade?.cortes ?? 0, config)) {
      throw new ErroDeNegocio(
        'dados_invalidos',
        'Você ainda não tem o corte grátis nesta barbearia',
      )
    }
    const valor = aplicarPremio(params.itens, config)
    if (valor.desconto === 0) {
      throw new ErroDeNegocio(
        'dados_invalidos',
        'O serviço grátis da fidelidade não está no pedido',
      )
    }
    return { valor, promocaoId: null, usouPremio: true }
  }

  if (!params.cupom) return semDesconto

  const [promocao] = await ctx.sql<
    {
      id: string
      desconto_tipo: 'percentual' | 'fixo'
      desconto_valor: number
      servico_ids: string[] | null
      dias_semana: number[] | null
      inicio: Date
      fim: Date
      limite_usos: number | null
      um_uso_por_cliente: boolean
      usos_totais: number
      usos_do_cliente: number
    }[]
  >`
    select p.id, p.desconto_tipo, p.desconto_valor, p.servico_ids, p.dias_semana, p.inicio, p.fim,
      p.limite_usos, p.um_uso_por_cliente,
      (select count(*) from public.cupom_usos u where u.promocao_id = p.id) as usos_totais,
      (select count(*) from public.cupom_usos u where u.promocao_id = p.id and u.cliente_id = ${params.clienteId}) as usos_do_cliente
    from public.promocoes p
    where p.barbearia_id = ${params.barbeariaId} and p.tipo = 'cupom' and p.ativa
      and upper(p.codigo) = upper(${params.cupom.trim()})`
  if (!promocao) throw new ErroDeNegocio('dados_invalidos', 'Cupom não encontrado nesta barbearia')

  const cupom = {
    barbeariaId: params.barbeariaId,
    desconto:
      promocao.desconto_tipo === 'percentual'
        ? ({ tipo: 'percentual', pct: promocao.desconto_valor } as const)
        : ({ tipo: 'fixo', valor: promocao.desconto_valor } as const),
    servicoIds: promocao.servico_ids ?? ('todos' as const),
    diasSemana: promocao.dias_semana,
    inicio: promocao.inicio,
    fim: promocao.fim,
    limiteUsos: promocao.limite_usos,
    umUsoPorCliente: promocao.um_uso_por_cliente,
  }
  const validacao = validarCupom({
    cupom,
    barbeariaId: params.barbeariaId,
    inicioDoAtendimento: params.inicio,
    diaDaSemana: params.diaSemana,
    servicoIds: params.itens.map((i) => i.servicoId),
    usosTotais: promocao.usos_totais,
    usosDoCliente: promocao.usos_do_cliente,
  })
  if (!validacao.ok) throw new ErroDeNegocio('dados_invalidos', MENSAGENS_CUPOM[validacao.motivo])
  return { valor: aplicarCupom(params.itens, cupom), promocaoId: promocao.id, usouPremio: false }
}

async function travarHorario(tx: Transacao, pedido: Pedido, agora: Date): Promise<void> {
  // Uma reserva por barbeiro de cada vez: dois clientes não pegam o mesmo horário.
  await tx`select pg_advisory_xact_lock(hashtext(${pedido.barbeiroId}))`
  const conflitos = await tx`
    select 1 from public.agendamentos
    where barbeiro_id = ${pedido.barbeiroId} and status in ('reservado', 'confirmado', 'em_atendimento')
      and tstzrange(inicio, fim) && tstzrange(${pedido.inicio}, ${pedido.fim})
    union all
    select 1 from public.reservas_horario
    where barbeiro_id = ${pedido.barbeiroId} and expira_em > ${agora}
      and tstzrange(inicio, fim) && tstzrange(${pedido.inicio}, ${pedido.fim})`
  if (conflitos.length > 0) {
    throw new ErroDeNegocio(
      'horario_indisponivel',
      'Esse horário acabou de ser reservado por outra pessoa',
    )
  }
}

async function inserirAgendamento(
  tx: Transacao,
  pedido: Pedido,
  id: string,
  status: 'confirmado' | 'reservado',
): Promise<string> {
  const [linha] = await tx<{ codigo: string }[]>`
    insert into public.agendamentos (id, barbearia_id, cliente_id, barbeiro_id, inicio, fim, status,
      valor_bruto_centavos, desconto_centavos, valor_pago_centavos, promocao_id, usou_premio_fidelidade,
      prazo_gratis_ate, tolerancia_ate, retencao_pct, plano, origem)
    values (${id}, ${pedido.barbearia.id}, ${pedido.clienteId}, ${pedido.barbeiroId}, ${pedido.inicio},
      ${pedido.fim}, ${status}, ${pedido.valor.valorBruto}, ${pedido.valor.desconto},
      ${pedido.valor.valorPago}, ${pedido.promocaoId}, ${pedido.usouPremio}, ${pedido.prazoGratisAte},
      ${pedido.toleranciaAte}, ${pedido.barbearia.retencaoPct}, ${pedido.barbearia.plano}, ${pedido.origem})
    returning codigo`
  for (const s of pedido.servicos) {
    await tx`
      insert into public.agendamento_servicos (agendamento_id, servico_id, nome, duracao_min, preco_centavos)
      values (${id}, ${s.servicoId}, ${s.nome}, ${s.duracaoMin}, ${s.precoCentavos})`
  }
  if (pedido.promocaoId) {
    await tx`
      insert into public.cupom_usos (promocao_id, cliente_id, agendamento_id)
      values (${pedido.promocaoId}, ${pedido.clienteId}, ${id})`
  }
  return linha?.codigo ?? ''
}

async function agendarSemPagamento(
  ctx: Contexto,
  pedido: Pedido,
): Promise<{ saida: SaidaAgendamento; eventos: EventoInterno[] }> {
  const id = randomUUID()
  const codigo = await ctx.sql.begin(async (tx) => {
    await travarHorario(tx, pedido, ctx.agora())
    return inserirAgendamento(tx, pedido, id, 'confirmado')
  })
  return {
    saida: {
      tipo: 'agendado',
      agendamentoId: id,
      codigo,
      status: 'confirmado',
      valorPagoCentavos: 0,
      cobrancaEm: null,
    },
    eventos: [{ name: 'agendamento/criado', data: { agendamentoId: id } }],
  }
}

export async function clienteNoGatewayOuNovo(
  ctx: Contexto,
  barbearia: { id: string; subcontaId: string },
  clienteId: string,
): Promise<string> {
  const [existente] = await ctx.sql<{ gateway_cliente_id: string }[]>`
    select gateway_cliente_id from public.clientes_gateway
    where cliente_id = ${clienteId} and barbearia_id = ${barbearia.id}`
  if (existente) return existente.gateway_cliente_id

  const [cliente] = await ctx.sql<{ nome: string; email: string | null; celular: string | null }[]>`
    select nome, email, celular from public.clientes where id = ${clienteId}`
  const { clienteId: gatewayClienteId } = await ctx.pagamentos.garantirCliente({
    subcontaId: barbearia.subcontaId,
    cliente: {
      referencia: clienteId,
      nome: cliente?.nome ?? 'Cliente',
      ...(cliente?.email ? { email: cliente.email } : {}),
      ...(cliente?.celular ? { celular: cliente.celular } : {}),
    },
  })
  await ctx.sql`
    insert into public.clientes_gateway (cliente_id, barbearia_id, gateway_cliente_id)
    values (${clienteId}, ${barbearia.id}, ${gatewayClienteId})
    on conflict (cliente_id, barbearia_id) do nothing`
  return gatewayClienteId
}

async function reservarComPix(
  ctx: Contexto,
  pedido: Pedido,
): Promise<{ saida: SaidaAgendamento; eventos: EventoInterno[] }> {
  const agora = ctx.agora()
  const reservaId = randomUUID()
  const reservadoAte = new Date(agora.getTime() + RESERVA_PIX_MIN * 60_000)
  const qrExpiraEm = new Date(agora.getTime() + QR_CODE_MIN * 60_000)
  const dados: DadosReserva = {
    cobrancaId: '',
    servicos: pedido.servicos,
    valorBrutoCentavos: pedido.valor.valorBruto,
    descontoCentavos: pedido.valor.desconto,
    valorPagoCentavos: pedido.valor.valorPago,
    promocaoId: pedido.promocaoId,
    usouPremioFidelidade: pedido.usouPremio,
    plano: pedido.barbearia.plano,
    retencaoPct: pedido.barbearia.retencaoPct,
    prazoGratisAte: pedido.prazoGratisAte.toISOString(),
    toleranciaAte: pedido.toleranciaAte.toISOString(),
    origem: pedido.origem,
  }

  await ctx.sql.begin(async (tx) => {
    await travarHorario(tx, pedido, agora)
    await tx`
      insert into public.reservas_horario (id, barbearia_id, barbeiro_id, cliente_id, inicio, fim, expira_em, dados)
      values (${reservaId}, ${pedido.barbearia.id}, ${pedido.barbeiroId}, ${pedido.clienteId},
        ${pedido.inicio}, ${pedido.fim}, ${reservadoAte}, ${tx.json({ ...dados })})`
  })

  try {
    const gatewayClienteId = await clienteNoGatewayOuNovo(ctx, pedido.barbearia, pedido.clienteId)
    const pix = await ctx.pagamentos.criarCobrancaPix({
      subcontaId: pedido.barbearia.subcontaId,
      clienteId: gatewayClienteId,
      valor: pedido.valor.valorPago,
      expiraEm: qrExpiraEm,
      referencia: reservaId,
    })
    await ctx.sql`
      update public.reservas_horario
      set dados = jsonb_set(dados, '{cobrancaId}', to_jsonb(${pix.cobrancaId}::text))
      where id = ${reservaId}`
    return {
      saida: {
        tipo: 'pix',
        reservaId,
        valorPagoCentavos: pedido.valor.valorPago,
        copiaECola: pix.copiaECola,
        qrCodeBase64: pix.qrCodeBase64,
        qrCodeExpiraEm: qrExpiraEm.toISOString(),
        reservadoAte: reservadoAte.toISOString(),
      },
      eventos: [
        { name: 'reserva/criada', data: { reservaId, expiraEm: reservadoAte.toISOString() } },
      ],
    }
  } catch (erro) {
    await ctx.sql`delete from public.reservas_horario where id = ${reservaId}`
    throw erro
  }
}

async function agendarNoCartao(
  ctx: Contexto,
  pedido: Pedido,
  entrada: EntradaAgendamento,
): Promise<{ saida: SaidaAgendamento; eventos: EventoInterno[] }> {
  if (!entrada.cartao || !entrada.titular) {
    throw new ErroDeNegocio('dados_invalidos', 'Informe o cartão e os dados do titular')
  }
  const agora = ctx.agora()
  const id = randomUUID()
  const gatewayClienteId = await clienteNoGatewayOuNovo(ctx, pedido.barbearia, pedido.clienteId)
  const cartao = await ctx.pagamentos.tokenizarCartao({
    subcontaId: pedido.barbearia.subcontaId,
    clienteId: gatewayClienteId,
    cartao: entrada.cartao,
    titular: entrada.titular,
    ipRemoto: entrada.ipRemoto,
  })
  const plano = planejarCobrancaNoCartao({ agora, fimPrazoGratis: pedido.prazoGratisAte })

  // O horário fica preso como Reservado antes de falar com o banco emissor.
  const codigo = await ctx.sql.begin(async (tx) => {
    await travarHorario(tx, pedido, agora)
    const codigoGerado = await inserirAgendamento(tx, pedido, id, 'reservado')
    await tx`
      insert into public.pagamentos (agendamento_id, barbearia_id, meio, status, valor_centavos,
        cartao_token, cartao_final, ip_remoto, pre_autorizar_em, capturar_em)
      values (${id}, ${pedido.barbearia.id}, 'cartao', 'tokenizado', ${pedido.valor.valorPago},
        ${cartao.token}, ${cartao.final}, ${entrada.ipRemoto}, ${plano.preAutorizarEm}, ${plano.capturarEm})`
    return codigoGerado
  })

  let status: 'confirmado' | 'reservado' = 'reservado'
  if (plano.preAutorizarAgora) {
    const cobranca = await ctx.pagamentos.preAutorizar({
      subcontaId: pedido.barbearia.subcontaId,
      clienteId: gatewayClienteId,
      token: cartao.token,
      valor: pedido.valor.valorPago,
      referencia: id,
      ipRemoto: entrada.ipRemoto,
    })
    if (cobranca.status !== 'pre_autorizada') {
      await ctx.sql.begin(async (tx) => {
        await tx`delete from public.cupom_usos where agendamento_id = ${id}`
        await tx`delete from public.pagamentos where agendamento_id = ${id}`
        await tx`delete from public.agendamentos where id = ${id}`
      })
      throw new ErroDeNegocio(
        'cartao_recusado',
        cobranca.motivoRecusa ?? 'O cartão foi recusado. Tente outro cartão ou pague com Pix.',
      )
    }
    await ctx.sql.begin(async (tx) => {
      await tx`
        update public.pagamentos set status = 'pre_autorizado', asaas_cobranca_id = ${cobranca.cobrancaId}
        where agendamento_id = ${id}`
      await tx`update public.agendamentos set status = 'confirmado' where id = ${id}`
    })
    status = 'confirmado'
  }

  return {
    saida: {
      tipo: 'agendado',
      agendamentoId: id,
      codigo,
      status,
      valorPagoCentavos: pedido.valor.valorPago,
      cobrancaEm: plano.capturarEm.toISOString(),
    },
    eventos: [{ name: 'agendamento/criado', data: { agendamentoId: id } }],
  }
}

/** Prévia do valor no checkout (Figma Cliente 10), com cupom ou prêmio da fidelidade. */
export async function simularPreco(
  ctx: Contexto,
  usuario: Usuario,
  params: {
    barbeariaId: string
    servicoIds: string[]
    inicio: string
    cupom?: string
    usarPremio?: boolean
  },
): Promise<ValorComDesconto> {
  const clienteId = await clienteDoUsuario(ctx.sql, usuario)
  const [barbearia] = await ctx.sql<{ fuso: string }[]>`
    select fuso from public.barbearias where id = ${params.barbeariaId}`
  if (!barbearia) throw new ErroDeNegocio('nao_encontrado', 'Barbearia não encontrada')
  const servicos = await carregarServicos(ctx, params.barbeariaId, params.servicoIds)
  const inicio = new Date(params.inicio)
  const { valor } = await calcularPreco(ctx, {
    barbeariaId: params.barbeariaId,
    clienteId,
    itens: servicos.map((s) => ({ servicoId: s.servicoId, preco: s.precoCentavos })),
    inicio,
    diaSemana: partesLocais(inicio, barbearia.fuso).diaSemana,
    ...(params.cupom ? { cupom: params.cupom } : {}),
    usarPremio: params.usarPremio ?? false,
  })
  return valor
}
