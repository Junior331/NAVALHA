import { precoDoServico, type Desconto, type StatusAgendamento } from '@navalha/core'
import type { Contexto } from '../contexto'
import { ErroDeNegocio } from '../erros'
import { carregarAgendamento } from '../repositorio'
import { clienteDoUsuario, papelNaBarbearia, type Usuario } from './acesso'

// Página pública da barbearia (navalha.app/<slug>, versão web da Cliente 03) e situação do
// agendamento para quem agendou, inclusive pelo cadastro leve (usuário anônimo).

export interface PaginaDaBarbearia {
  id: string
  slug: string
  nome: string
  descricao: string | null
  telefone: string | null
  whatsapp: string | null
  instagram: string | null
  endereco: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  capaUrl: string | null
  logoUrl: string | null
  fuso: string
  /** Recebimentos ativos e reservas online ligadas (ajustes-taxas §Subconta). */
  aceitaAgendamentos: boolean
  nota: number | null
  avaliacoes: number
  servicos: {
    id: string
    nome: string
    categoria: string | null
    descricao: string | null
    duracaoMin: number
    precoCentavos: number
    precoSemDescontoCentavos: number
    barbeiroIds: string[]
  }[]
  barbeiros: { id: string; nome: string; nota: number | null; avaliacoes: number }[]
  horarios: { diaSemana: number; abre: string; fecha: string }[]
  politica: { prazoGratisHoras: number; retencaoPct: number; toleranciaMin: number }
  depoimentos: { nota: number; comentario: string; cliente: string; data: string }[]
}

export async function paginaDaBarbearia(
  ctx: Contexto,
  slug: string,
): Promise<PaginaDaBarbearia | null> {
  const [b] = await ctx.sql<
    {
      id: string
      slug: string
      nome: string
      descricao: string | null
      telefone: string | null
      whatsapp: string | null
      instagram: string | null
      endereco: string | null
      bairro: string | null
      cidade: string | null
      uf: string | null
      capa_url: string | null
      logo_url: string | null
      fuso: string
      aceita: boolean
      prazo_gratis_horas: string | null
      retencao_pct: number | null
      tolerancia_min: number | null
    }[]
  >`
    select b.id, b.slug, b.nome, b.descricao, b.telefone, b.whatsapp, b.instagram, b.endereco,
      b.bairro, b.cidade, b.uf, b.capa_url, b.logo_url, b.fuso,
      (b.aceitar_agendamentos_online and b.recebimentos_ativos_em is not null) as aceita,
      p.prazo_gratis_horas::text, p.retencao_pct, p.tolerancia_min
    from public.barbearias b
    left join public.politicas_cancelamento p on p.barbearia_id = b.id
    where b.slug = ${slug.toLowerCase()}`
  if (!b) return null

  const [servicos, barbeiros, horarios, depoimentos] = await Promise.all([
    ctx.sql<
      {
        id: string
        nome: string
        categoria: string | null
        descricao: string | null
        duracao_min: number
        preco_centavos: number
        desconto_tipo: 'percentual' | 'fixo' | null
        desconto_valor: number | null
        barbeiro_ids: string[]
      }[]
    >`
      select s.id, s.nome, s.categoria, s.descricao, s.duracao_min, s.preco_centavos,
        s.desconto_tipo, s.desconto_valor,
        coalesce(array_agg(sb.membro_id) filter (where m.ativo), '{}') as barbeiro_ids
      from public.servicos s
      left join public.servico_barbeiro sb on sb.servico_id = s.id
      left join public.membros m on m.id = sb.membro_id
      where s.barbearia_id = ${b.id} and s.ativo
      group by s.id
      order by s.ordem, s.nome`,
    ctx.sql<{ id: string; nome: string; nota: string | null; avaliacoes: number }[]>`
      select m.id, coalesce(pp.nome_exibicao, pe.nome, 'Barbeiro') as nome,
        round(avg(a.nota), 1)::text as nota, count(a.id)::int as avaliacoes
      from public.membros m
      left join public.perfis_profissionais pp on pp.membro_id = m.id
      left join public.perfis pe on pe.usuario_id = m.usuario_id
      left join public.avaliacoes a on a.membro_id = m.id
      where m.barbearia_id = ${b.id} and m.ativo
      group by m.id, pp.nome_exibicao, pe.nome
      order by count(a.id) desc, nome`,
    ctx.sql<{ dia_semana: number; abre: string; fecha: string }[]>`
      select dia_semana, to_char(abre, 'HH24:MI') as abre, to_char(fecha, 'HH24:MI') as fecha
      from public.horarios_barbearia where barbearia_id = ${b.id} order by dia_semana`,
    ctx.sql<{ nota: number; comentario: string; cliente: string; criada_em: Date }[]>`
      select a.nota, a.comentario, split_part(c.nome, ' ', 1) as cliente, a.criada_em
      from public.avaliacoes a
      join public.clientes c on c.id = a.cliente_id
      where a.barbearia_id = ${b.id} and a.comentario is not null
      order by a.criada_em desc
      limit 6`,
  ])

  const totalAvaliacoes = barbeiros.reduce((total, x) => total + x.avaliacoes, 0)
  const somaDasNotas = barbeiros.reduce((total, x) => total + Number(x.nota ?? 0) * x.avaliacoes, 0)

  return {
    id: b.id,
    slug: b.slug,
    nome: b.nome,
    descricao: b.descricao,
    telefone: b.telefone,
    whatsapp: b.whatsapp,
    instagram: b.instagram,
    endereco: b.endereco,
    bairro: b.bairro,
    cidade: b.cidade,
    uf: b.uf,
    capaUrl: b.capa_url,
    logoUrl: b.logo_url,
    fuso: b.fuso,
    aceitaAgendamentos: b.aceita,
    nota: totalAvaliacoes ? Math.round((somaDasNotas / totalAvaliacoes) * 10) / 10 : null,
    avaliacoes: totalAvaliacoes,
    servicos: servicos.map((s) => {
      const desconto: Desconto | null =
        s.desconto_tipo === 'percentual'
          ? { tipo: 'percentual', pct: s.desconto_valor ?? 0 }
          : s.desconto_tipo === 'fixo'
            ? { tipo: 'fixo', valor: s.desconto_valor ?? 0 }
            : null
      return {
        id: s.id,
        nome: s.nome,
        categoria: s.categoria,
        descricao: s.descricao,
        duracaoMin: s.duracao_min,
        precoCentavos: precoDoServico(s.preco_centavos, desconto),
        precoSemDescontoCentavos: s.preco_centavos,
        barbeiroIds: s.barbeiro_ids,
      }
    }),
    barbeiros: barbeiros.map((x) => ({
      id: x.id,
      nome: x.nome,
      nota: x.nota === null ? null : Number(x.nota),
      avaliacoes: x.avaliacoes,
    })),
    horarios: horarios.map((h) => ({ diaSemana: h.dia_semana, abre: h.abre, fecha: h.fecha })),
    politica: {
      prazoGratisHoras: Number(b.prazo_gratis_horas ?? 2),
      retencaoPct: b.retencao_pct ?? 50,
      toleranciaMin: b.tolerancia_min ?? 15,
    },
    depoimentos: depoimentos.map((d) => ({
      nota: d.nota,
      comentario: d.comentario,
      cliente: d.cliente,
      data: d.criada_em.toISOString(),
    })),
  }
}

export type SituacaoDoAgendamento =
  | {
      tipo: 'agendamento'
      id: string
      codigo: string
      status: StatusAgendamento
      inicio: string
      fim: string
      barbeiro: string
      servicos: string[]
      valorPagoCentavos: number
      meio: 'pix' | 'cartao' | null
      cartaoFinal: string | null
      /** Cartão: quando a pré-autorização é feita e quando o valor é cobrado. */
      preAutorizarEm: string | null
      cobrancaEm: string | null
      prazoGratisAte: string
      regularizarAte: string | null
    }
  | { tipo: 'reserva'; reservadoAte: string }
  | { tipo: 'expirado' }

/**
 * Situação para a tela de Pix e de sucesso (Cliente 11 e 12): o Pix vira agendamento quando é
 * pago, com o mesmo id da reserva.
 */
export async function situacaoDoAgendamento(
  ctx: Contexto,
  usuario: Usuario,
  id: string,
): Promise<SituacaoDoAgendamento> {
  const [existe] = await ctx.sql<{ barbearia_id: string }[]>`
    select barbearia_id from public.agendamentos where id = ${id}`
  if (existe) {
    const ag = await carregarAgendamento(ctx.sql, id)
    const daEquipe = await papelNaBarbearia(ctx.sql, usuario.id, ag.barbeariaId)
    if (!daEquipe && ag.clienteUsuarioId !== usuario.id) {
      throw new ErroDeNegocio('nao_encontrado', 'Agendamento não encontrado')
    }
    const [detalhe] = await ctx.sql<
      { barbeiro: string; servicos: string[]; cartao_final: string | null }[]
    >`
      select coalesce(pp.nome_exibicao, pe.nome, 'Barbeiro') as barbeiro,
        array(select nome from public.agendamento_servicos where agendamento_id = a.id) as servicos,
        p.cartao_final
      from public.agendamentos a
      join public.membros m on m.id = a.barbeiro_id
      left join public.perfis_profissionais pp on pp.membro_id = m.id
      left join public.perfis pe on pe.usuario_id = m.usuario_id
      left join public.pagamentos p on p.agendamento_id = a.id
      where a.id = ${id}`
    return {
      tipo: 'agendamento',
      id: ag.id,
      codigo: ag.codigo,
      status: ag.status,
      inicio: ag.inicio.toISOString(),
      fim: ag.fim.toISOString(),
      barbeiro: detalhe?.barbeiro ?? 'Barbeiro',
      servicos: detalhe?.servicos ?? [],
      valorPagoCentavos: ag.valorPagoCentavos,
      meio: ag.pagamento?.meio ?? null,
      cartaoFinal: detalhe?.cartao_final ?? null,
      preAutorizarEm: ag.pagamento?.preAutorizarEm?.toISOString() ?? null,
      cobrancaEm: ag.pagamento?.capturarEm?.toISOString() ?? null,
      prazoGratisAte: ag.prazoGratisAte.toISOString(),
      regularizarAte: ag.pagamento?.regularizarAte?.toISOString() ?? null,
    }
  }

  const clienteId = await clienteDoUsuario(ctx.sql, usuario)
  const [reserva] = await ctx.sql<{ expira_em: Date }[]>`
    select expira_em from public.reservas_horario where id = ${id} and cliente_id = ${clienteId}`
  if (!reserva) throw new ErroDeNegocio('nao_encontrado', 'Agendamento não encontrado')
  return reserva.expira_em.getTime() > ctx.agora().getTime()
    ? { tipo: 'reserva', reservadoAte: reserva.expira_em.toISOString() }
    : { tipo: 'expirado' }
}

export interface BarbeariaNaBusca {
  slug: string
  nome: string
  bairro: string | null
  cidade: string | null
  logoUrl: string | null
  nota: number | null
  avaliacoes: number
  aceitaAgendamentos: boolean
}

/** Busca do app (Cliente 04): só quem escolheu aparecer nas buscas (Admin 09). */
export async function buscarBarbearias(ctx: Contexto, termo: string): Promise<BarbeariaNaBusca[]> {
  const filtro = `%${termo.trim()}%`
  const linhas = await ctx.sql<
    {
      slug: string
      nome: string
      bairro: string | null
      cidade: string | null
      logo_url: string | null
      nota: string | null
      avaliacoes: number
      aceita: boolean
    }[]
  >`
    select b.slug, b.nome, b.bairro, b.cidade, b.logo_url,
      round(avg(a.nota), 1)::text as nota, count(a.id)::int as avaliacoes,
      (b.aceitar_agendamentos_online and b.recebimentos_ativos_em is not null) as aceita
    from public.barbearias b
    left join public.avaliacoes a on a.barbearia_id = b.id
    where b.aparecer_nas_buscas
      and (b.nome ilike ${filtro} or coalesce(b.bairro, '') ilike ${filtro}
        or coalesce(b.cidade, '') ilike ${filtro})
    group by b.id
    order by aceita desc, count(a.id) desc, b.nome
    limit 30`
  return linhas.map((l) => ({
    slug: l.slug,
    nome: l.nome,
    bairro: l.bairro,
    cidade: l.cidade,
    logoUrl: l.logo_url,
    nota: l.nota === null ? null : Number(l.nota),
    avaliacoes: l.avaliacoes,
    aceitaAgendamentos: l.aceita,
  }))
}
