-- Schema inicial: barbearias, equipe, clientes, serviços e agendamentos, com RLS por barbearia_id.
-- Regras: docs/mapa.md §2 e §3; CLAUDE.md (sem status Pendente; no-show separado de cancelamento).
-- Escrita de agendamentos só pela API (service role), que aplica as regras de packages/core.

create type public.papel_membro as enum ('dono', 'barbeiro');

create type public.status_agendamento as enum (
  'reservado',
  'confirmado',
  'em_atendimento',
  'concluido',
  'cancelado_no_prazo',
  'cancelado_fora_do_prazo',
  'cancelado_pela_barbearia',
  'no_show',
  'liberado'
);

create table public.barbearias (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  criada_em timestamptz not null default now()
);

create table public.membros (
  id uuid primary key default gen_random_uuid(),
  barbearia_id uuid not null references public.barbearias (id) on delete cascade,
  usuario_id uuid not null references auth.users (id) on delete cascade,
  papel public.papel_membro not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (barbearia_id, usuario_id),
  unique (id, barbearia_id)
);
create index membros_usuario_idx on public.membros (usuario_id);

-- Cliente é global: o mesmo cliente agenda em várias barbearias.
create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid unique references auth.users (id) on delete set null,
  nome text not null check (length(trim(nome)) > 0),
  celular text,
  email text,
  criado_em timestamptz not null default now()
);

create table public.servicos (
  id uuid primary key default gen_random_uuid(),
  barbearia_id uuid not null references public.barbearias (id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  categoria text,
  duracao_min integer not null check (duracao_min > 0),
  preco_centavos bigint not null check (preco_centavos >= 0),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create index servicos_barbearia_idx on public.servicos (barbearia_id);

create table public.agendamentos (
  id uuid primary key default gen_random_uuid(),
  barbearia_id uuid not null references public.barbearias (id) on delete restrict,
  cliente_id uuid not null references public.clientes (id) on delete restrict,
  barbeiro_id uuid not null,
  inicio timestamptz not null,
  fim timestamptz not null,
  status public.status_agendamento not null,
  valor_pago_centavos bigint not null check (valor_pago_centavos >= 0),
  criado_em timestamptz not null default now(),
  check (fim > inicio),
  -- O barbeiro precisa ser da mesma barbearia do agendamento.
  foreign key (barbeiro_id, barbearia_id) references public.membros (id, barbearia_id)
);
create index agendamentos_barbearia_inicio_idx on public.agendamentos (barbearia_id, inicio);
create index agendamentos_cliente_idx on public.agendamentos (cliente_id);

-- Funções auxiliares das policies. SECURITY DEFINER evita recursão de RLS em membros.
create function public.barbearias_do_usuario()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select m.barbearia_id from public.membros m where m.usuario_id = auth.uid() and m.ativo
$$;

create function public.eh_dono(alvo uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.membros m
    where m.barbearia_id = alvo and m.usuario_id = auth.uid() and m.papel = 'dono' and m.ativo
  )
$$;

create function public.cliente_do_usuario()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select c.id from public.clientes c where c.usuario_id = auth.uid()
$$;

revoke all on function public.barbearias_do_usuario() from public;
revoke all on function public.eh_dono(uuid) from public;
revoke all on function public.cliente_do_usuario() from public;
grant execute on function public.barbearias_do_usuario() to authenticated;
grant execute on function public.eh_dono(uuid) to authenticated;
grant execute on function public.cliente_do_usuario() to authenticated;

alter table public.barbearias enable row level security;
alter table public.membros enable row level security;
alter table public.clientes enable row level security;
alter table public.servicos enable row level security;
alter table public.agendamentos enable row level security;

-- Grants explícitos (config.toml: auto_expose_new_tables = false).
grant select on public.barbearias, public.servicos to anon;
grant select on public.barbearias, public.membros, public.clientes, public.servicos, public.agendamentos to authenticated;
grant update (nome) on public.barbearias to authenticated;
grant update (papel, ativo) on public.membros to authenticated;
grant update (nome, celular, email) on public.clientes to authenticated;
grant insert, update on public.servicos to authenticated;

-- barbearias: leitura pública (página navalha.app/<slug>); só o dono altera.
create policy barbearias_leitura_publica on public.barbearias
  for select to anon, authenticated using (true);
create policy barbearias_dono_altera on public.barbearias
  for update to authenticated using (public.eh_dono(id)) with check (public.eh_dono(id));

-- membros: a equipe vê a própria barbearia; só o dono altera.
create policy membros_equipe_le on public.membros
  for select to authenticated using (barbearia_id in (select public.barbearias_do_usuario()));
create policy membros_dono_altera on public.membros
  for update to authenticated using (public.eh_dono(barbearia_id)) with check (public.eh_dono(barbearia_id));

-- clientes: o próprio cliente, e a equipe das barbearias onde ele agendou.
create policy clientes_proprio_le on public.clientes
  for select to authenticated using (usuario_id = auth.uid());
create policy clientes_equipe_le on public.clientes
  for select to authenticated using (
    exists (
      select 1 from public.agendamentos a
      where a.cliente_id = clientes.id
        and a.barbearia_id in (select public.barbearias_do_usuario())
    )
  );
create policy clientes_proprio_altera on public.clientes
  for update to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- servicos: ativos são públicos; a equipe vê todos; só o dono cria e altera.
create policy servicos_ativos_publicos on public.servicos
  for select to anon, authenticated using (ativo);
create policy servicos_equipe_le on public.servicos
  for select to authenticated using (barbearia_id in (select public.barbearias_do_usuario()));
create policy servicos_dono_cria on public.servicos
  for insert to authenticated with check (public.eh_dono(barbearia_id));
create policy servicos_dono_altera on public.servicos
  for update to authenticated using (public.eh_dono(barbearia_id)) with check (public.eh_dono(barbearia_id));

-- agendamentos: equipe da barbearia e o próprio cliente leem; escrita só pela API.
create policy agendamentos_equipe_le on public.agendamentos
  for select to authenticated using (barbearia_id in (select public.barbearias_do_usuario()));
create policy agendamentos_cliente_le on public.agendamentos
  for select to authenticated using (cliente_id = public.cliente_do_usuario());
