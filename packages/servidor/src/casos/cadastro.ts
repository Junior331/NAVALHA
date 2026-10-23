import { createHash, randomBytes } from 'node:crypto'
import type { Plano } from '@navalha/core'
import type { Contexto } from '../contexto'
import { ErroDeNegocio } from '../erros'
import { exigirDono, type Usuario } from './acesso'

// Cadastros: cliente (app e cadastro leve da web), barbearia (Figma Cadastro 01–05) e equipe por
// convite (Admin 04, Convite 01–04). A subconta do gateway não nasce aqui: só em "Ativar
// recebimentos" (ajustes-taxas §Subconta).

const DIAS_DO_CONVITE = 7
const TRIAL_DIAS = 14

export async function cadastrarCliente(
  ctx: Contexto,
  usuario: Usuario,
  dados: { nome: string; celular?: string; email?: string },
): Promise<{ clienteId: string }> {
  const nome = dados.nome.trim()
  if (!nome) throw new ErroDeNegocio('dados_invalidos', 'Informe seu nome')
  const [cliente] = await ctx.sql<{ id: string }[]>`
    insert into public.clientes (usuario_id, nome, celular, email)
    values (${usuario.id}, ${nome}, ${dados.celular ?? null}, ${dados.email ?? null})
    on conflict (usuario_id) do update
      set nome = excluded.nome,
        celular = coalesce(excluded.celular, public.clientes.celular),
        email = coalesce(excluded.email, public.clientes.email)
    returning id`
  await ctx.sql`
    insert into public.perfis (usuario_id, nome, celular)
    values (${usuario.id}, ${nome}, ${dados.celular ?? null})
    on conflict (usuario_id) do update set nome = excluded.nome, atualizado_em = now()`
  if (!cliente) throw new ErroDeNegocio('dados_invalidos', 'Não foi possível salvar o cadastro')
  return { clienteId: cliente.id }
}

export interface DadosBarbearia {
  nome: string
  slug: string
  nomeDoDono: string
  telefone?: string
  whatsapp?: string
  endereco?: string
  bairro?: string
  cidade?: string
  uf?: string
  plano: Plano
  ciclo?: 'mensal' | 'anual'
}

const SLUGS_RESERVADOS = new Set([
  'admin',
  'ajuda',
  'api',
  'app',
  'barbearias',
  'cadastro',
  'convite',
  'entrar',
  'laboratorio',
  'navalha',
  'onboarding',
  'painel',
  'privacidade',
  'recuperar',
  'termos',
  'www',
])

export async function cadastrarBarbearia(
  ctx: Contexto,
  usuario: Usuario,
  dados: DadosBarbearia,
): Promise<{ barbeariaId: string; slug: string }> {
  if (usuario.anonimo)
    throw new ErroDeNegocio('sem_permissao', 'Crie uma conta para cadastrar a barbearia')
  const slug = dados.slug.trim().toLowerCase()
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    throw new ErroDeNegocio(
      'dados_invalidos',
      'O link pode ter só letras minúsculas, números e hífen',
    )
  }
  // A página pública fica em navalha.app/<slug>: o link não pode cobrir uma rota do próprio site.
  if (SLUGS_RESERVADOS.has(slug)) {
    throw new ErroDeNegocio('dados_invalidos', 'Esse link é reservado. Escolha outro.')
  }
  if (dados.plano !== 'free' && !dados.ciclo) {
    throw new ErroDeNegocio('dados_invalidos', 'Escolha entre plano mensal e anual')
  }

  try {
    const barbeariaId = await ctx.sql.begin(async (tx) => {
      const [barbearia] = await tx<{ id: string }[]>`
        insert into public.barbearias (nome, slug, telefone, whatsapp, endereco, bairro, cidade, uf)
        values (${dados.nome.trim()}, ${slug}, ${dados.telefone ?? null}, ${dados.whatsapp ?? null},
          ${dados.endereco ?? null}, ${dados.bairro ?? null}, ${dados.cidade ?? null}, ${dados.uf ?? null})
        returning id`
      if (!barbearia)
        throw new ErroDeNegocio('dados_invalidos', 'Não foi possível criar a barbearia')
      const [membro] = await tx<{ id: string }[]>`
        insert into public.membros (barbearia_id, usuario_id, papel)
        values (${barbearia.id}, ${usuario.id}, 'dono')
        returning id`
      await tx`
        insert into public.perfis (usuario_id, nome) values (${usuario.id}, ${dados.nomeDoDono})
        on conflict (usuario_id) do update set nome = excluded.nome, atualizado_em = now()`
      await tx`
        insert into public.perfis_profissionais (membro_id, barbearia_id, nome_exibicao)
        values (${membro?.id ?? ''}, ${barbearia.id}, ${dados.nomeDoDono})`
      const emTrial = dados.plano !== 'free'
      await tx`
        insert into public.assinaturas (barbearia_id, plano, ciclo, status, trial_ate)
        values (${barbearia.id}, ${dados.plano}, ${dados.ciclo ?? null}, ${emTrial ? 'trial' : 'ativa'},
          ${emTrial ? new Date(ctx.agora().getTime() + TRIAL_DIAS * 86_400_000) : null})`
      await tx`insert into public.politicas_cancelamento (barbearia_id) values (${barbearia.id})`
      await tx`insert into public.fidelidade_config (barbearia_id) values (${barbearia.id})`
      // Horário inicial do Onboarding 03: seg–sex 09–18, sábado 09–16, domingo fechado.
      for (const dia of [1, 2, 3, 4, 5, 6]) {
        await tx`
          insert into public.horarios_barbearia (barbearia_id, dia_semana, abre, fecha)
          values (${barbearia.id}, ${dia}, '09:00', ${dia === 6 ? '16:00' : '18:00'})`
      }
      return barbearia.id
    })
    return { barbeariaId, slug }
  } catch (erro) {
    if ((erro as { code?: string }).code === '23505') {
      throw new ErroDeNegocio('dados_invalidos', 'Esse link já está em uso. Escolha outro.')
    }
    throw erro
  }
}

const hash = (token: string) => createHash('sha256').update(token).digest('hex')

export async function criarConvite(
  ctx: Contexto,
  usuario: Usuario,
  dados: { barbeariaId: string; nome: string; contato?: string; servicoIds: string[] },
): Promise<{ token: string; expiraEm: string }> {
  await exigirDono(ctx.sql, usuario, dados.barbeariaId)
  if (!dados.nome.trim()) throw new ErroDeNegocio('dados_invalidos', 'Informe o nome do barbeiro')
  const token = randomBytes(24).toString('base64url')
  const expiraEm = new Date(ctx.agora().getTime() + DIAS_DO_CONVITE * 86_400_000)
  await ctx.sql`
    insert into public.convites (barbearia_id, token_hash, nome, contato, papel, servico_ids, expira_em, criado_por)
    values (${dados.barbeariaId}, ${hash(token)}, ${dados.nome.trim()}, ${dados.contato ?? null}, 'barbeiro',
      ${dados.servicoIds}::uuid[], ${expiraEm}, ${usuario.id})`
  return { token, expiraEm: expiraEm.toISOString() }
}

export async function consultarConvite(
  ctx: Contexto,
  token: string,
): Promise<{ barbeariaNome: string; nome: string; expirado: boolean }> {
  const [convite] = await ctx.sql<
    { barbearia_nome: string; nome: string; expira_em: Date; usado_em: Date | null }[]
  >`
    select b.nome as barbearia_nome, c.nome, c.expira_em, c.usado_em
    from public.convites c join public.barbearias b on b.id = c.barbearia_id
    where c.token_hash = ${hash(token)}`
  if (!convite) throw new ErroDeNegocio('nao_encontrado', 'Convite não encontrado')
  return {
    barbeariaNome: convite.barbearia_nome,
    nome: convite.nome,
    expirado: convite.usado_em !== null || convite.expira_em.getTime() < ctx.agora().getTime(),
  }
}

export async function aceitarConvite(
  ctx: Contexto,
  usuario: Usuario,
  dados: { token: string },
): Promise<{ barbeariaId: string; membroId: string }> {
  if (usuario.anonimo)
    throw new ErroDeNegocio('sem_permissao', 'Crie seu acesso antes de aceitar o convite')
  return ctx.sql.begin(async (tx) => {
    const [convite] = await tx<
      {
        id: string
        barbearia_id: string
        nome: string
        servico_ids: string[]
        expira_em: Date
        usado_em: Date | null
      }[]
    >`
      select id, barbearia_id, nome, servico_ids, expira_em, usado_em from public.convites
      where token_hash = ${hash(dados.token)} for update`
    if (!convite) throw new ErroDeNegocio('nao_encontrado', 'Convite não encontrado')
    if (convite.usado_em) throw new ErroDeNegocio('estado_invalido', 'Este convite já foi usado')
    if (convite.expira_em.getTime() < ctx.agora().getTime()) {
      throw new ErroDeNegocio('estado_invalido', 'Este convite expirou. Peça um novo link ao dono.')
    }
    const existente = await tx`
      select 1 from public.membros where barbearia_id = ${convite.barbearia_id} and usuario_id = ${usuario.id}`
    if (existente.length > 0)
      throw new ErroDeNegocio('estado_invalido', 'Você já faz parte desta barbearia')

    const [membro] = await tx<{ id: string }[]>`
      insert into public.membros (barbearia_id, usuario_id, papel)
      values (${convite.barbearia_id}, ${usuario.id}, 'barbeiro')
      returning id`
    const membroId = membro?.id ?? ''
    await tx`
      insert into public.perfis (usuario_id, nome) values (${usuario.id}, ${convite.nome})
      on conflict (usuario_id) do nothing`
    await tx`
      insert into public.perfis_profissionais (membro_id, barbearia_id, nome_exibicao)
      values (${membroId}, ${convite.barbearia_id}, ${convite.nome})`
    for (const servicoId of convite.servico_ids) {
      await tx`
        insert into public.servico_barbeiro (servico_id, membro_id, barbearia_id)
        select id, ${membroId}, barbearia_id from public.servicos
        where id = ${servicoId} and barbearia_id = ${convite.barbearia_id}
        on conflict do nothing`
    }
    await tx`update public.convites set usado_em = ${ctx.agora()}, usado_por = ${usuario.id} where id = ${convite.id}`
    return { barbeariaId: convite.barbearia_id, membroId }
  })
}

export async function registrarDispositivo(
  ctx: Contexto,
  usuario: Usuario,
  dados: { expoToken: string; plataforma: 'ios' | 'android' },
): Promise<void> {
  if (!/^Expo(nent)?PushToken\[.+\]$/.test(dados.expoToken)) {
    throw new ErroDeNegocio('dados_invalidos', 'Token de push inválido')
  }
  await ctx.sql`
    insert into public.dispositivos_push (expo_token, usuario_id, plataforma)
    values (${dados.expoToken}, ${usuario.id}, ${dados.plataforma})
    on conflict (expo_token) do update set usuario_id = excluded.usuario_id, plataforma = excluded.plataforma`
}
