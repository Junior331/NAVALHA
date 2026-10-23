import { SAQUE_MINIMO, saldoDisponivel, validarSaque, type Centavos } from '@navalha/core'
import type { Transacao } from '@navalha/db'
import type { Contexto } from '../contexto'
import { ErroDeNegocio } from '../erros'
import { reais } from '../repositorio'
import { exigirDono, type Usuario } from './acesso'

// Recebimentos e carteira da barbearia (Admin · Ativar recebimentos e Financeiro).
// ajustes-taxas §Subconta: a subconta só nasce na ativação, porque cada uma custa R$ 12,90.
// cartao-pre-autorizado §Transferência: disponível = saldo − taxas da Navalha ainda não
// transferidas no lote semanal. regras-de-negocio §Decisões: saque manual, mínimo de R$ 50.

/** O Asaas libera o cartão em até 32 dias (ajustes-taxas §G com preço cheio). */
const LIQUIDACAO_DO_CARTAO_DIAS = 32

export interface DadosAtivacao {
  barbeariaId: string
  titular: {
    nome: string
    email: string
    cpfCnpj: string
    celular: string
    faturamentoMensalCentavos: Centavos
    endereco: { logradouro: string; numero: string; bairro: string; cep: string }
  }
  /** Chave Pix da própria barbearia, destino dos saques. */
  chavePix: string
}

export async function ativarRecebimentos(
  ctx: Contexto,
  usuario: Usuario,
  dados: DadosAtivacao,
): Promise<{ situacao: 'aprovada' | 'em_analise' }> {
  await exigirDono(ctx.sql, usuario, dados.barbeariaId)
  const [atual] = await ctx.sql<
    {
      recebimentos_ativos_em: Date | null
      asaas_conta_id: string | null
      escrow_habilitado: boolean | null
      status_kyc: string | null
    }[]
  >`
    select b.recebimentos_ativos_em, s.asaas_conta_id, s.escrow_habilitado, s.status_kyc
    from public.barbearias b
    left join public.subcontas_asaas s on s.barbearia_id = b.id
    where b.id = ${dados.barbeariaId}`
  if (!atual) throw new ErroDeNegocio('nao_encontrado', 'Barbearia não encontrada')
  if (atual.recebimentos_ativos_em) {
    throw new ErroDeNegocio('estado_invalido', 'Os recebimentos já estão ativos')
  }

  let subcontaId = atual.asaas_conta_id
  let situacao: 'aprovada' | 'em_analise' =
    atual.status_kyc === 'aprovado' ? 'aprovada' : 'em_analise'
  if (!subcontaId) {
    const t = dados.titular
    const criada = await ctx.pagamentos.criarSubconta({
      nome: t.nome,
      email: t.email,
      cpfCnpj: t.cpfCnpj,
      celular: t.celular,
      faturamentoMensal: t.faturamentoMensalCentavos,
      endereco: t.endereco,
    })
    // Guarda a subconta antes do Escrow: se ele falhar, tentar de novo não cria (nem paga) outra.
    await ctx.sql`
      insert into public.subcontas_asaas (barbearia_id, asaas_conta_id, wallet_id, chave_api_secret_id,
        status_kyc, chave_pix_saque)
      values (${dados.barbeariaId}, ${criada.subcontaId}, ${criada.walletId},
        vault.create_secret(${criada.chaveApi}, ${`asaas-subconta-${dados.barbeariaId}`}),
        ${criada.situacao === 'aprovada' ? 'aprovado' : 'pendente'}, ${dados.chavePix})`
    subcontaId = criada.subcontaId
    situacao = criada.situacao
  }
  if (!atual.escrow_habilitado) {
    await ctx.pagamentos.habilitarEscrow({ subcontaId })
  }

  await ctx.sql.begin(async (tx) => {
    await tx`
      update public.subcontas_asaas set escrow_habilitado = true, chave_pix_saque = ${dados.chavePix}
      where barbearia_id = ${dados.barbeariaId}`
    // Ativou, já aceita agendamentos online; o dono pode pausar no Perfil.
    await tx`
      update public.barbearias
      set recebimentos_ativos_em = ${ctx.agora()}, aceitar_agendamentos_online = true
      where id = ${dados.barbeariaId}`
  })
  return { situacao }
}

export interface Carteira {
  ativa: boolean
  /** KYC da subconta no gateway: saques só depois de aprovado. */
  cadastroAprovado: boolean
  /** Pix pago e cartão capturado, presos no Escrow até o atendimento. */
  retidoCentavos: Centavos
  /** Cartões pré-autorizados: viram cobrança no fim do prazo grátis. */
  preAutorizadoCentavos: Centavos
  /** Parte da barbearia em cartões já liquidados, esperando o Asaas liberar (até 32 dias). */
  aReceberCentavos: Centavos
  saldoCentavos: Centavos
  taxasATransferirCentavos: number
  disponivelCentavos: Centavos
  saqueMinimoCentavos: Centavos
}

async function numerosDaCarteira(
  tx: Transacao,
  barbeariaId: string,
  agora: Date,
): Promise<Carteira> {
  const corte = new Date(agora.getTime() - LIQUIDACAO_DO_CARTAO_DIAS * 86_400_000)
  const [l] = await tx<
    {
      recebimentos_ativos_em: Date | null
      status_kyc: string | null
      retido: number
      pre_autorizado: number
      a_receber: number
      liberado: number
      transferido: number
      sacado: number
      taxas: number
    }[]
  >`
    select b.recebimentos_ativos_em, s.status_kyc,
      (select coalesce(sum(a.valor_pago_centavos), 0) from public.agendamentos a
        join public.pagamentos p on p.agendamento_id = a.id
        where a.barbearia_id = b.id and p.status in ('pix_pago', 'capturado')
          and not exists (select 1 from public.lancamentos x
            where x.agendamento_id = a.id and x.tipo = 'liquidacao'))::bigint as retido,
      (select coalesce(sum(p.valor_centavos), 0) from public.pagamentos p
        join public.agendamentos a on a.id = p.agendamento_id
        where p.barbearia_id = b.id and p.status = 'pre_autorizado'
          and a.status in ('confirmado', 'em_atendimento'))::bigint as pre_autorizado,
      (select coalesce(sum(x.barbearia_centavos), 0) from public.lancamentos x
        join public.pagamentos p on p.agendamento_id = x.agendamento_id
        where x.barbearia_id = b.id and x.tipo = 'liquidacao' and p.meio = 'cartao'
          and x.criado_em > ${corte})::bigint as a_receber,
      (select coalesce(sum(x.barbearia_centavos + x.navalha_centavos), 0) from public.lancamentos x
        left join public.pagamentos p on p.agendamento_id = x.agendamento_id
        where x.barbearia_id = b.id and x.tipo = 'liquidacao'
          and (p.meio is distinct from 'cartao' or x.criado_em <= ${corte}))::bigint as liberado,
      (select coalesce(sum(valor_centavos), 0) from public.lotes_semanais
        where barbearia_id = b.id and status = 'concluida')::bigint as transferido,
      (select coalesce(sum(valor_centavos), 0) from public.saques
        where barbearia_id = b.id and status <> 'falhou')::bigint as sacado,
      (select coalesce(sum(t.valor_centavos), 0) from public.taxas_a_transferir t
        left join public.lotes_semanais lo on lo.id = t.lote_id
        where t.barbearia_id = b.id and (lo.id is null or lo.status <> 'concluida'))::bigint as taxas
    from public.barbearias b
    left join public.subcontas_asaas s on s.barbearia_id = b.id
    where b.id = ${barbeariaId}`
  if (!l) throw new ErroDeNegocio('nao_encontrado', 'Barbearia não encontrada')

  const saldo = Math.max(0, l.liberado - l.transferido - l.sacado)
  return {
    ativa: l.recebimentos_ativos_em !== null,
    cadastroAprovado: l.status_kyc === 'aprovado',
    retidoCentavos: l.retido,
    preAutorizadoCentavos: l.pre_autorizado,
    aReceberCentavos: Math.max(0, l.a_receber),
    saldoCentavos: saldo,
    taxasATransferirCentavos: l.taxas,
    disponivelCentavos: saldoDisponivel({ saldo, taxasATransferir: Math.max(0, l.taxas) }),
    saqueMinimoCentavos: SAQUE_MINIMO,
  }
}

export async function consultarCarteira(
  ctx: Contexto,
  usuario: Usuario,
  barbeariaId: string,
): Promise<Carteira> {
  await exigirDono(ctx.sql, usuario, barbeariaId)
  return ctx.sql.begin((tx) => numerosDaCarteira(tx, barbeariaId, ctx.agora()))
}

export async function solicitarSaque(
  ctx: Contexto,
  usuario: Usuario,
  params: { barbeariaId: string; valorCentavos: Centavos },
): Promise<{ saqueId: string }> {
  await exigirDono(ctx.sql, usuario, params.barbeariaId)

  // Trava por barbearia: dois cliques não sacam duas vezes o mesmo disponível.
  const saque = await ctx.sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtext(${`saque:${params.barbeariaId}`}))`
    const carteira = await numerosDaCarteira(tx, params.barbeariaId, ctx.agora())
    if (!carteira.ativa) {
      throw new ErroDeNegocio('recebimentos_inativos', 'Ative os recebimentos antes de sacar')
    }
    if (!carteira.cadastroAprovado) {
      throw new ErroDeNegocio(
        'estado_invalido',
        'O cadastro da conta ainda está em análise. O saque libera depois da aprovação.',
      )
    }
    const validacao = validarSaque({
      valor: params.valorCentavos,
      disponivel: carteira.disponivelCentavos,
    })
    if (!validacao.ok) {
      throw new ErroDeNegocio(
        'dados_invalidos',
        validacao.motivo === 'abaixo_do_minimo'
          ? `O saque mínimo é de ${reais(SAQUE_MINIMO)}`
          : `Você pode sacar até ${reais(carteira.disponivelCentavos)}`,
      )
    }
    const [subconta] = await tx<{ asaas_conta_id: string; chave_pix_saque: string | null }[]>`
      select asaas_conta_id, chave_pix_saque from public.subcontas_asaas
      where barbearia_id = ${params.barbeariaId}`
    if (!subconta?.chave_pix_saque) {
      throw new ErroDeNegocio('estado_invalido', 'Cadastre a chave Pix que recebe os saques')
    }
    const [linha] = await tx<{ id: string }[]>`
      insert into public.saques (barbearia_id, valor_centavos, solicitado_por)
      values (${params.barbeariaId}, ${params.valorCentavos}, ${usuario.id})
      returning id`
    return {
      id: linha?.id ?? '',
      subcontaId: subconta.asaas_conta_id,
      chavePix: subconta.chave_pix_saque,
    }
  })

  try {
    const { transferenciaId } = await ctx.pagamentos.transferirPix({
      subcontaId: saque.subcontaId,
      chavePix: saque.chavePix,
      valor: params.valorCentavos,
      referencia: `saque:${saque.id}`,
      descricao: 'Saque Navalha',
    })
    await ctx.sql`
      update public.saques set status = 'concluida', asaas_transferencia_id = ${transferenciaId}
      where id = ${saque.id}`
  } catch (erro) {
    await ctx.sql`update public.saques set status = 'falhou' where id = ${saque.id}`
    console.error('[saque] o gateway recusou', erro)
    throw new ErroDeNegocio(
      'estado_invalido',
      'O banco não confirmou o saque. Nada saiu da carteira; tente de novo mais tarde.',
    )
  }
  return { saqueId: saque.id }
}

/** Interruptor do Perfil (Admin 09): só liga depois de ativar os recebimentos. */
export async function definirAgendamentosOnline(
  ctx: Contexto,
  usuario: Usuario,
  params: { barbeariaId: string; aceitar: boolean },
): Promise<{ aceitar: boolean }> {
  await exigirDono(ctx.sql, usuario, params.barbeariaId)
  const [barbearia] = await ctx.sql<{ recebimentos_ativos_em: Date | null }[]>`
    select recebimentos_ativos_em from public.barbearias where id = ${params.barbeariaId}`
  if (params.aceitar && !barbearia?.recebimentos_ativos_em) {
    throw new ErroDeNegocio(
      'recebimentos_inativos',
      'Ative os recebimentos para aceitar agendamentos online',
    )
  }
  await ctx.sql`
    update public.barbearias set aceitar_agendamentos_online = ${params.aceitar}
    where id = ${params.barbeariaId}`
  return { aceitar: params.aceitar }
}
