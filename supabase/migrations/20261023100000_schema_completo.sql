-- Fase 2: schema completo do MVP (docs/mapa.md §2). Valores em centavos (bigint).
-- Regras: ajustes-taxas (subconta só na ativação), cartao-pre-autorizado (janelas do cartão),
-- regras-de-negocio (liquidação, política, cupons, fidelidade, carteira).
-- Escrita de dinheiro e de agenda só pela API (conexão de servidor); o usuário só lê, via RLS.

create extension if not exists btree_gist with schema extensions;

create type public.plano as enum ('free', 'basic', 'pro');
create type public.ciclo_assinatura as enum ('mensal', 'anual');
create type public.status_assinatura as enum ('trial', 'ativa', 'inadimplente', 'cancelada');
create type public.meio_pagamento as enum ('pix', 'cartao');
create type public.status_pagamento as enum (
  'pix_aguardando',
  'pix_pago',
  'tokenizado',
  'pre_autorizado',
  'recusado',
  'pre_autorizacao_cancelada',
  'capturado',
  'estornado_parcial',
  'estornado'
);
create type public.origem_agendamento as enum ('app', 'web', 'balcao');
create type public.evento_final as enum (
  'concluido',
  'cancelado_no_prazo',
  'cancelado_fora_do_prazo',
  'no_show',
  'cancelado_pela_barbearia'
);
create type public.tipo_lancamento as enum ('liquidacao', 'saque', 'lote_taxa', 'credito_cliente');
create type public.pagador_gateway as enum ('barbearia', 'navalha', 'cliente', 'ninguem');
create type public.tipo_desconto as enum ('percentual', 'fixo');
create type public.tipo_promocao as enum ('cupom', 'automatica');
create type public.status_transferencia as enum ('pendente', 'concluida', 'falhou');

-- ── Barbearia ──────────────────────────────────────────────────────────────────────────────
alter table public.barbearias
  add column descricao text check (length(descricao) <= 240),
  add column telefone text,
  add column whatsapp text,
  add column instagram text,
  add column endereco text,
  add column bairro text,
  add column cidade text,
  add column uf char(2),
  add column capa_url text,
  add column logo_url text,
  add column fuso text not null default 'America/Sao_Paulo',
  add column aparecer_nas_buscas boolean not null default true,
  add column aceitar_agendamentos_online boolean not null default false,
  add column recebimentos_ativos_em timestamptz,
  -- Sem subconta ativa, não há como receber: ajustes-taxas §Subconta.
  add constraint aceita_online_so_com_recebimentos
    check (not aceitar_agendamentos_online or recebimentos_ativos_em is not null);

create table public.assinaturas (
  barbearia_id uuid primary key references public.barbearias (id) on delete cascade,
  plano public.plano not null default 'free',
  ciclo public.ciclo_assinatura,
  status public.status_assinatura not null default 'ativa',
  trial_ate timestamptz,
  asaas_assinatura_id text,
  atualizada_em timestamptz not null default now(),
  check (plano = 'free' or ciclo is not null)
);

-- Chave de API da subconta fica no Vault; aqui só a referência. Nenhum usuário lê esta tabela.
create table public.subcontas_asaas (
  barbearia_id uuid primary key references public.barbearias (id) on delete cascade,
  asaas_conta_id text not null unique,
  wallet_id text not null unique,
  chave_api_secret_id uuid not null,
  escrow_habilitado boolean not null default false,
  status_kyc text not null default 'pendente',
  criada_em timestamptz not null default now()
);

create table public.horarios_barbearia (
  barbearia_id uuid not null references public.barbearias (id) on delete cascade,
  dia_semana smallint not null check (dia_semana between 0 and 6),
  abre time not null,
  fecha time not null,
  primary key (barbearia_id, dia_semana),
  check (fecha > abre)
);

-- ── Pessoas ────────────────────────────────────────────────────────────────────────────────
create table public.perfis (
  usuario_id uuid primary key references auth.users (id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  celular text,
  avatar_url text,
  atualizado_em timestamptz not null default now()
);

-- Perfil público do profissional (Figma Barbeiro 05 e Cliente 08).
create table public.perfis_profissionais (
  membro_id uuid primary key,
  barbearia_id uuid not null,
  nome_exibicao text not null check (length(trim(nome_exibicao)) > 0),
  bio text,
  especialidades text[] not null default '{}',
  avatar_url text,
  foreign key (membro_id, barbearia_id) references public.membros (id, barbearia_id) on delete cascade
);

create table public.convites (
  id uuid primary key default gen_random_uuid(),
  barbearia_id uuid not null references public.barbearias (id) on delete cascade,
  token_hash text not null unique,
  nome text not null,
  contato text,
  papel public.papel_membro not null default 'barbeiro',
  servico_ids uuid[] not null default '{}',
  expira_em timestamptz not null,
  usado_em timestamptz,
  usado_por uuid references auth.users (id) on delete set null,
  criado_por uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now()
);

-- ── Catálogo e agenda ──────────────────────────────────────────────────────────────────────
alter table public.servicos
  add column descricao text,
  add column desconto_tipo public.tipo_desconto,
  add column desconto_valor integer check (desconto_valor > 0),
  add column ordem integer not null default 0,
  add constraint desconto_completo check ((desconto_tipo is null) = (desconto_valor is null)),
  add constraint desconto_percentual_ate_100 check (desconto_tipo <> 'percentual' or desconto_valor <= 100),
  add constraint servicos_id_barbearia_unico unique (id, barbearia_id);

create table public.servico_barbeiro (
  servico_id uuid not null,
  membro_id uuid not null,
  barbearia_id uuid not null,
  primary key (servico_id, membro_id),
  foreign key (servico_id, barbearia_id) references public.servicos (id, barbearia_id) on delete cascade,
  foreign key (membro_id, barbearia_id) references public.membros (id, barbearia_id) on delete cascade
);

create table public.horarios_atendimento (
  membro_id uuid not null,
  barbearia_id uuid not null,
  dia_semana smallint not null check (dia_semana between 0 and 6),
  inicio time not null,
  fim time not null,
  pausa_inicio time,
  pausa_fim time,
  primary key (membro_id, dia_semana),
  foreign key (membro_id, barbearia_id) references public.membros (id, barbearia_id) on delete cascade,
  check (fim > inicio),
  check ((pausa_inicio is null) = (pausa_fim is null)),
  check (pausa_inicio is null or (pausa_inicio >= inicio and pausa_fim <= fim and pausa_fim > pausa_inicio))
);

-- Folgas, bloqueios parciais e pausa de agenda. membro_id nulo = barbearia inteira (ex.: feriado).
create table public.bloqueios (
  id uuid primary key default gen_random_uuid(),
  barbearia_id uuid not null references public.barbearias (id) on delete cascade,
  membro_id uuid references public.membros (id) on delete cascade,
  inicio timestamptz not null,
  fim timestamptz not null,
  motivo text,
  criado_em timestamptz not null default now(),
  check (fim > inicio)
);
create index bloqueios_barbearia_periodo_idx on public.bloqueios using gist (barbearia_id, tstzrange(inicio, fim));

-- Reserva temporária do horário enquanto o QR Code do Pix está aberto (o agendamento só existe
-- depois de pago). Expira sozinha; a API checa sobreposição com agendamentos e reservas.
create table public.reservas_horario (
  id uuid primary key default gen_random_uuid(),
  barbearia_id uuid not null references public.barbearias (id) on delete cascade,
  barbeiro_id uuid not null,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  inicio timestamptz not null,
  fim timestamptz not null,
  expira_em timestamptz not null,
  dados jsonb not null default '{}',
  criada_em timestamptz not null default now(),
  foreign key (barbeiro_id, barbearia_id) references public.membros (id, barbearia_id),
  check (fim > inicio)
);
create index reservas_horario_barbeiro_idx on public.reservas_horario (barbeiro_id, expira_em);

create sequence public.agendamento_codigo_seq start 1000;

alter table public.agendamentos
  add column codigo text not null unique default ('NV-' || nextval('public.agendamento_codigo_seq')::text),
  add column valor_bruto_centavos bigint not null default 0 check (valor_bruto_centavos >= 0),
  add column desconto_centavos bigint not null default 0 check (desconto_centavos >= 0),
  add column promocao_id uuid,
  add column usou_premio_fidelidade boolean not null default false,
  add column prazo_gratis_ate timestamptz,
  add column tolerancia_ate timestamptz,
  add column retencao_pct smallint check (retencao_pct between 0 and 100),
  add column plano public.plano,
  add column origem public.origem_agendamento not null default 'app',
  add column observacoes text,
  add column iniciado_em timestamptz,
  add column concluido_em timestamptz,
  add column cancelado_em timestamptz,
  add column motivo_cancelamento text,
  add constraint valor_pago_com_desconto check (valor_pago_centavos = valor_bruto_centavos - desconto_centavos),
  -- Mesmo barbeiro não atende dois agendamentos ativos ao mesmo tempo.
  add constraint agendamentos_sem_sobreposicao exclude using gist (
    barbeiro_id with =,
    tstzrange(inicio, fim) with &&
  ) where (status in ('reservado', 'confirmado', 'em_atendimento'));

alter table public.agendamentos
  alter column prazo_gratis_ate set not null,
  alter column tolerancia_ate set not null,
  alter column retencao_pct set not null,
  alter column plano set not null;

create table public.agendamento_servicos (
  agendamento_id uuid not null references public.agendamentos (id) on delete cascade,
  servico_id uuid not null references public.servicos (id) on delete restrict,
  nome text not null,
  duracao_min integer not null check (duracao_min > 0),
  preco_centavos bigint not null check (preco_centavos >= 0),
  primary key (agendamento_id, servico_id)
);

-- ── Dinheiro ───────────────────────────────────────────────────────────────────────────────
create table public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  agendamento_id uuid not null unique references public.agendamentos (id) on delete restrict,
  barbearia_id uuid not null references public.barbearias (id) on delete restrict,
  meio public.meio_pagamento not null,
  status public.status_pagamento not null,
  valor_centavos bigint not null check (valor_centavos >= 0),
  taxa_gateway_centavos bigint not null default 0 check (taxa_gateway_centavos >= 0),
  valor_estornado_centavos bigint not null default 0 check (valor_estornado_centavos >= 0),
  asaas_cobranca_id text unique,
  cartao_token text,
  cartao_final char(4),
  pre_autorizar_em timestamptz,
  capturar_em timestamptz,
  falhou_em timestamptz,
  regularizar_ate timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Extrato por evento de dinheiro. Uma liquidação por agendamento (idempotência).
create table public.lancamentos (
  id uuid primary key default gen_random_uuid(),
  barbearia_id uuid not null references public.barbearias (id) on delete restrict,
  agendamento_id uuid references public.agendamentos (id) on delete restrict,
  tipo public.tipo_lancamento not null,
  evento_final public.evento_final,
  valor_pago_centavos bigint not null default 0,
  cliente_centavos bigint not null default 0,
  credito_cliente_centavos bigint not null default 0,
  barbearia_centavos bigint not null default 0,
  navalha_centavos bigint not null default 0,
  taxa_gateway_centavos bigint not null default 0,
  quem_paga_gateway public.pagador_gateway not null default 'ninguem',
  criado_em timestamptz not null default now(),
  check (tipo <> 'liquidacao' or (agendamento_id is not null and evento_final is not null))
);
create unique index lancamentos_uma_liquidacao_por_agendamento
  on public.lancamentos (agendamento_id) where tipo = 'liquidacao';
create index lancamentos_barbearia_idx on public.lancamentos (barbearia_id, criado_em desc);

create table public.lotes_semanais (
  id uuid primary key default gen_random_uuid(),
  barbearia_id uuid not null references public.barbearias (id) on delete restrict,
  semana date not null,
  valor_centavos bigint not null,
  status public.status_transferencia not null default 'pendente',
  asaas_transferencia_id text,
  criado_em timestamptz not null default now(),
  unique (barbearia_id, semana)
);

-- Pode ser negativo: G sai da parte da Navalha no cancelamento tardio e no no-show.
create table public.taxas_a_transferir (
  id uuid primary key default gen_random_uuid(),
  barbearia_id uuid not null references public.barbearias (id) on delete restrict,
  agendamento_id uuid not null unique references public.agendamentos (id) on delete restrict,
  valor_centavos bigint not null,
  lote_id uuid references public.lotes_semanais (id) on delete set null,
  criado_em timestamptz not null default now()
);

create table public.saques (
  id uuid primary key default gen_random_uuid(),
  barbearia_id uuid not null references public.barbearias (id) on delete restrict,
  valor_centavos bigint not null check (valor_centavos >= 5000),
  status public.status_transferencia not null default 'pendente',
  solicitado_por uuid references auth.users (id) on delete set null,
  asaas_transferencia_id text,
  criado_em timestamptz not null default now()
);

create table public.creditos_cliente (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  barbearia_id uuid not null references public.barbearias (id) on delete cascade,
  valor_centavos bigint not null check (valor_centavos > 0),
  origem_agendamento_id uuid not null unique references public.agendamentos (id) on delete restrict,
  usado_em_agendamento_id uuid references public.agendamentos (id) on delete set null,
  criado_em timestamptz not null default now()
);

create table public.webhook_eventos (
  id text primary key,
  origem text not null default 'asaas',
  tipo text not null,
  payload jsonb not null,
  recebido_em timestamptz not null default now(),
  processado_em timestamptz
);

-- ── Configuração ───────────────────────────────────────────────────────────────────────────
-- Padrão do Figma (Cliente 10c): 2h grátis, 50% retido, 15 min de tolerância.
create table public.politicas_cancelamento (
  barbearia_id uuid primary key references public.barbearias (id) on delete cascade,
  prazo_gratis_horas numeric(5, 2) not null default 2 check (prazo_gratis_horas >= 0),
  retencao_pct smallint not null default 50 check (retencao_pct between 0 and 100),
  tolerancia_min integer not null default 15 check (tolerancia_min >= 0)
);

create table public.fidelidade_config (
  barbearia_id uuid primary key references public.barbearias (id) on delete cascade,
  ativa boolean not null default false,
  cortes_necessarios integer not null default 5 check (cortes_necessarios > 0),
  servico_gratis_id uuid references public.servicos (id) on delete set null
);

create table public.fidelidade_progresso (
  barbearia_id uuid not null references public.barbearias (id) on delete cascade,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  cortes integer not null default 0 check (cortes >= 0),
  primary key (barbearia_id, cliente_id)
);

create table public.promocoes (
  id uuid primary key default gen_random_uuid(),
  barbearia_id uuid not null references public.barbearias (id) on delete cascade,
  nome text not null,
  descricao text,
  tipo public.tipo_promocao not null,
  codigo text,
  desconto_tipo public.tipo_desconto not null,
  desconto_valor integer not null check (desconto_valor > 0),
  servico_ids uuid[],
  dias_semana smallint[],
  inicio timestamptz not null,
  fim timestamptz not null,
  limite_usos integer check (limite_usos > 0),
  um_uso_por_cliente boolean not null default true,
  ativa boolean not null default true,
  criada_em timestamptz not null default now(),
  check (fim > inicio),
  check ((tipo = 'cupom') = (codigo is not null)),
  check (desconto_tipo <> 'percentual' or desconto_valor <= 100),
  unique (barbearia_id, codigo)
);

alter table public.agendamentos
  add constraint agendamentos_promocao_fk foreign key (promocao_id) references public.promocoes (id) on delete set null;

create table public.cupom_usos (
  promocao_id uuid not null references public.promocoes (id) on delete cascade,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  agendamento_id uuid not null unique references public.agendamentos (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (promocao_id, agendamento_id)
);

-- ── Relacionamento ─────────────────────────────────────────────────────────────────────────
create table public.avaliacoes (
  id uuid primary key default gen_random_uuid(),
  barbearia_id uuid not null references public.barbearias (id) on delete cascade,
  agendamento_id uuid not null unique references public.agendamentos (id) on delete cascade,
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  membro_id uuid not null references public.membros (id) on delete cascade,
  nota smallint not null check (nota between 1 and 5),
  comentario text check (length(comentario) <= 500),
  criada_em timestamptz not null default now()
);

create table public.favoritos (
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  barbearia_id uuid not null references public.barbearias (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (cliente_id, barbearia_id)
);

create table public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete cascade,
  titulo text not null,
  corpo text not null,
  tipo text not null default 'geral',
  dados jsonb not null default '{}',
  lida_em timestamptz,
  criada_em timestamptz not null default now()
);
create index notificacoes_usuario_idx on public.notificacoes (usuario_id, criada_em desc);

create table public.dispositivos_push (
  expo_token text primary key,
  usuario_id uuid not null references auth.users (id) on delete cascade,
  plataforma text not null check (plataforma in ('ios', 'android')),
  criado_em timestamptz not null default now()
);

-- ── Funções auxiliares das policies ────────────────────────────────────────────────────────
create function public.membro_do_usuario(alvo uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select m.id from public.membros m where m.barbearia_id = alvo and m.usuario_id = auth.uid() and m.ativo
$$;
revoke all on function public.membro_do_usuario(uuid) from public;
grant execute on function public.membro_do_usuario(uuid) to authenticated;

-- ── RLS e grants ───────────────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'assinaturas', 'subcontas_asaas', 'horarios_barbearia', 'perfis', 'perfis_profissionais',
    'convites', 'servico_barbeiro', 'horarios_atendimento', 'bloqueios', 'reservas_horario',
    'agendamento_servicos', 'pagamentos', 'lancamentos', 'lotes_semanais', 'taxas_a_transferir',
    'saques', 'creditos_cliente', 'webhook_eventos', 'politicas_cancelamento', 'fidelidade_config',
    'fidelidade_progresso', 'promocoes', 'cupom_usos', 'avaliacoes', 'favoritos', 'notificacoes',
    'dispositivos_push'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Leitura pública: página da barbearia e checkout (valores dinâmicos da política).
grant select on public.horarios_barbearia, public.perfis_profissionais, public.servico_barbeiro,
  public.horarios_atendimento, public.politicas_cancelamento, public.fidelidade_config,
  public.promocoes, public.avaliacoes to anon, authenticated;
create policy publico_le on public.horarios_barbearia for select to anon, authenticated using (true);
create policy publico_le on public.perfis_profissionais for select to anon, authenticated using (true);
create policy publico_le on public.servico_barbeiro for select to anon, authenticated using (true);
create policy publico_le on public.horarios_atendimento for select to anon, authenticated using (true);
create policy publico_le on public.politicas_cancelamento for select to anon, authenticated using (true);
create policy publico_le on public.fidelidade_config for select to anon, authenticated using (true);
create policy publico_le on public.promocoes for select to anon, authenticated
  using (ativa or barbearia_id in (select public.barbearias_do_usuario()));
create policy publico_le on public.avaliacoes for select to anon, authenticated using (true);

-- Equipe da barbearia.
grant select on public.bloqueios, public.agendamento_servicos, public.convites,
  public.fidelidade_progresso, public.cupom_usos to authenticated;
create policy equipe_le on public.bloqueios for select to authenticated
  using (barbearia_id in (select public.barbearias_do_usuario()));
create policy equipe_le on public.agendamento_servicos for select to authenticated
  using (exists (
    select 1 from public.agendamentos a where a.id = agendamento_id
      and (a.barbearia_id in (select public.barbearias_do_usuario()) or a.cliente_id = public.cliente_do_usuario())
  ));
create policy dono_le on public.convites for select to authenticated using (public.eh_dono(barbearia_id));
create policy equipe_ou_cliente_le on public.fidelidade_progresso for select to authenticated
  using (barbearia_id in (select public.barbearias_do_usuario()) or cliente_id = public.cliente_do_usuario());
create policy dono_le on public.cupom_usos for select to authenticated
  using (exists (select 1 from public.promocoes p where p.id = promocao_id and public.eh_dono(p.barbearia_id)));

-- Dinheiro: só o dono (barbeiro não recebe nem saca pela Navalha) e o cliente no próprio pagamento.
grant select (id, agendamento_id, barbearia_id, meio, status, valor_centavos, taxa_gateway_centavos,
  valor_estornado_centavos, cartao_final, capturar_em, regularizar_ate, criado_em, atualizado_em)
  on public.pagamentos to authenticated;
create policy dono_le on public.pagamentos for select to authenticated using (public.eh_dono(barbearia_id));
create policy cliente_le on public.pagamentos for select to authenticated
  using (exists (select 1 from public.agendamentos a where a.id = agendamento_id and a.cliente_id = public.cliente_do_usuario()));

grant select on public.lancamentos, public.lotes_semanais, public.taxas_a_transferir, public.saques,
  public.assinaturas to authenticated;
create policy dono_le on public.lancamentos for select to authenticated using (public.eh_dono(barbearia_id));
create policy dono_le on public.lotes_semanais for select to authenticated using (public.eh_dono(barbearia_id));
create policy dono_le on public.taxas_a_transferir for select to authenticated using (public.eh_dono(barbearia_id));
create policy dono_le on public.saques for select to authenticated using (public.eh_dono(barbearia_id));
create policy dono_le on public.assinaturas for select to authenticated using (public.eh_dono(barbearia_id));

grant select on public.creditos_cliente to authenticated;
create policy cliente_ou_dono_le on public.creditos_cliente for select to authenticated
  using (cliente_id = public.cliente_do_usuario() or public.eh_dono(barbearia_id));

-- Dados do próprio usuário.
grant select, insert, update on public.perfis to authenticated;
create policy proprio on public.perfis for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy equipe_le on public.perfis for select to authenticated
  using (exists (
    select 1 from public.membros m
    where m.usuario_id = perfis.usuario_id and m.barbearia_id in (select public.barbearias_do_usuario())
  ));

grant select, update (lida_em) on public.notificacoes to authenticated;
create policy proprio_le on public.notificacoes for select to authenticated using (usuario_id = auth.uid());
create policy proprio_marca_lida on public.notificacoes for update to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

grant select, insert, delete on public.dispositivos_push, public.favoritos to authenticated;
create policy proprio on public.dispositivos_push for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy proprio on public.favoritos for all to authenticated
  using (cliente_id = public.cliente_do_usuario()) with check (cliente_id = public.cliente_do_usuario());

-- Configuração editável pelo dono direto do app (sem regra de dinheiro envolvida).
grant update (descricao, telefone, whatsapp, instagram, endereco, bairro, cidade, uf, capa_url, logo_url,
  aparecer_nas_buscas) on public.barbearias to authenticated;
grant update (prazo_gratis_horas, retencao_pct, tolerancia_min) on public.politicas_cancelamento to authenticated;
create policy dono_altera on public.politicas_cancelamento for update to authenticated
  using (public.eh_dono(barbearia_id)) with check (public.eh_dono(barbearia_id));
grant insert, update, delete on public.horarios_barbearia to authenticated;
create policy dono_altera on public.horarios_barbearia for all to authenticated
  using (public.eh_dono(barbearia_id)) with check (public.eh_dono(barbearia_id));
grant insert, update, delete on public.horarios_atendimento to authenticated;
create policy dono_ou_proprio_altera on public.horarios_atendimento for all to authenticated
  using (public.eh_dono(barbearia_id) or membro_id = public.membro_do_usuario(barbearia_id))
  with check (public.eh_dono(barbearia_id) or membro_id = public.membro_do_usuario(barbearia_id));
grant insert, delete on public.bloqueios to authenticated;
create policy dono_ou_proprio_cria on public.bloqueios for insert to authenticated
  with check (public.eh_dono(barbearia_id) or membro_id = public.membro_do_usuario(barbearia_id));
create policy dono_ou_proprio_apaga on public.bloqueios for delete to authenticated
  using (public.eh_dono(barbearia_id) or membro_id = public.membro_do_usuario(barbearia_id));
grant insert, update on public.perfis_profissionais to authenticated;
create policy dono_ou_proprio_altera on public.perfis_profissionais for all to authenticated
  using (public.eh_dono(barbearia_id) or membro_id = public.membro_do_usuario(barbearia_id))
  with check (public.eh_dono(barbearia_id) or membro_id = public.membro_do_usuario(barbearia_id));

-- O servidor (API e jobs) usa a service role.
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
