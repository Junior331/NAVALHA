-- Isolamento entre barbearias (RLS por barbearia_id): docs/roadmap.md, fase 2.
-- Barbearia A: dono A, barbeiro A e o cliente X. Barbearia B: dono B (que também atende) e o cliente Y.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000a001', 'dono-a@teste.local'),
  ('00000000-0000-0000-0000-00000000a002', 'barbeiro-a@teste.local'),
  ('00000000-0000-0000-0000-00000000b001', 'dono-b@teste.local'),
  ('00000000-0000-0000-0000-0000000c0001', 'cliente-x@teste.local'),
  ('00000000-0000-0000-0000-0000000c0002', 'cliente-y@teste.local');

insert into public.barbearias (id, nome, slug) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Barbearia A', 'barbearia-a'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'Barbearia B', 'barbearia-b');

insert into public.membros (id, barbearia_id, usuario_id, papel) values
  ('11111111-0000-0000-0000-00000000a001', 'aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000a001', 'dono'),
  ('11111111-0000-0000-0000-00000000a002', 'aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000a002', 'barbeiro'),
  ('11111111-0000-0000-0000-00000000b001', 'bbbbbbbb-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000b001', 'dono');

insert into public.clientes (id, usuario_id, nome) values
  ('22222222-0000-0000-0000-0000000c0001', '00000000-0000-0000-0000-0000000c0001', 'Cliente X'),
  ('22222222-0000-0000-0000-0000000c0002', '00000000-0000-0000-0000-0000000c0002', 'Cliente Y');

insert into public.servicos (id, barbearia_id, nome, duracao_min, preco_centavos) values
  ('33333333-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', 'Corte', 40, 4000),
  ('33333333-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000000', 'Corte', 40, 4500);

insert into public.agendamentos (barbearia_id, cliente_id, barbeiro_id, inicio, fim, status, valor_pago_centavos) values
  ('aaaaaaaa-0000-0000-0000-000000000000', '22222222-0000-0000-0000-0000000c0001', '11111111-0000-0000-0000-00000000a002',
   '2026-10-20 13:00-03', '2026-10-20 13:40-03', 'confirmado', 4000),
  ('bbbbbbbb-0000-0000-0000-000000000000', '22222222-0000-0000-0000-0000000c0002', '11111111-0000-0000-0000-00000000b001',
   '2026-10-20 14:00-03', '2026-10-20 14:40-03', 'confirmado', 4500);

-- Integridade: o barbeiro do agendamento precisa ser da mesma barbearia.
select throws_ok(
  $$ insert into public.agendamentos (barbearia_id, cliente_id, barbeiro_id, inicio, fim, status, valor_pago_centavos)
     values ('bbbbbbbb-0000-0000-0000-000000000000', '22222222-0000-0000-0000-0000000c0002',
             '11111111-0000-0000-0000-00000000a002', '2026-10-21 10:00-03', '2026-10-21 10:40-03', 'confirmado', 4500) $$,
  '23503', null, 'barbeiro de outra barbearia não pode atender o agendamento'
);

-- Dono da barbearia A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a001","role":"authenticated"}', true);

select is((select count(*) from public.agendamentos)::int, 1, 'dono A vê só o agendamento de A');
select is((select count(*) from public.agendamentos where barbearia_id <> 'aaaaaaaa-0000-0000-0000-000000000000')::int, 0, 'dono A não vê agendamento de B');
select is((select count(*) from public.membros)::int, 2, 'dono A vê só a equipe de A');
select is((select count(*) from public.clientes)::int, 1, 'dono A vê só clientes que agendaram em A');
select is(
  (with u as (update public.servicos set preco_centavos = 1 where barbearia_id = 'bbbbbbbb-0000-0000-0000-000000000000' returning 1) select count(*) from u)::int,
  0, 'dono A não altera serviço de B'
);
select is(
  (with u as (update public.servicos set preco_centavos = 4200 where barbearia_id = 'aaaaaaaa-0000-0000-0000-000000000000' returning 1) select count(*) from u)::int,
  1, 'dono A altera serviço de A'
);
select throws_ok(
  $$ insert into public.agendamentos (barbearia_id, cliente_id, barbeiro_id, inicio, fim, status, valor_pago_centavos)
     values ('aaaaaaaa-0000-0000-0000-000000000000', '22222222-0000-0000-0000-0000000c0001',
             '11111111-0000-0000-0000-00000000a002', '2026-10-22 10:00-03', '2026-10-22 10:40-03', 'confirmado', 0) $$,
  '42501', null, 'agendamento só é criado pela API (service role), nunca direto pelo usuário'
);

-- Barbeiro da barbearia A
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a002","role":"authenticated"}', true);
select is((select count(*) from public.agendamentos)::int, 1, 'barbeiro A vê a agenda de A');
select is(
  (with u as (update public.servicos set preco_centavos = 1 where barbearia_id = 'aaaaaaaa-0000-0000-0000-000000000000' returning 1) select count(*) from u)::int,
  0, 'barbeiro não altera preço de serviço (só o dono)'
);

-- Cliente Y (agendou na B)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000c0002","role":"authenticated"}', true);
select is((select count(*) from public.agendamentos)::int, 1, 'cliente Y vê só o próprio agendamento');
select is((select count(*) from public.membros)::int, 0, 'cliente não lê a tabela de membros');
select is((select count(*) from public.clientes)::int, 1, 'cliente vê só o próprio cadastro');

-- Visitante sem login (página pública)
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*) from public.agendamentos)::int, 0, 'visitante não vê agendamentos');
select is((select count(*) from public.barbearias)::int, 2, 'visitante vê as barbearias (página pública)');
select is((select count(*) from public.servicos)::int, 2, 'visitante vê os serviços ativos');

reset role;
select * from finish();
rollback;
