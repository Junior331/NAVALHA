-- Dados que o gateway exige para cobrar: cliente por subconta (o Asaas cria um "customer" em cada
-- subconta) e o IP do comprador, exigido na cobrança de cartão (docs/roadmap.md, fase 3).

create table public.clientes_gateway (
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  barbearia_id uuid not null references public.barbearias (id) on delete cascade,
  gateway_cliente_id text not null,
  criado_em timestamptz not null default now(),
  primary key (cliente_id, barbearia_id)
);
alter table public.clientes_gateway enable row level security;
grant all on public.clientes_gateway to service_role;

alter table public.pagamentos
  add column ip_remoto inet,
  add column motivo_recusa text;
