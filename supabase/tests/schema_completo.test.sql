-- Fase 2: regras de integridade e de acesso do schema completo (docs/roadmap.md, fase 2).
-- Barbearia A: dono A, barbeiro A, cliente X. Barbearia B: dono B e cliente Y. Usuário anônimo Z
-- (cadastro leve da página web).
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-00000000a001', 'dono-a@teste.local', false),
  ('00000000-0000-0000-0000-00000000a002', 'barbeiro-a@teste.local', false),
  ('00000000-0000-0000-0000-00000000b001', 'dono-b@teste.local', false),
  ('00000000-0000-0000-0000-0000000c0001', 'cliente-x@teste.local', false),
  ('00000000-0000-0000-0000-0000000c0002', 'cliente-y@teste.local', false),
  ('00000000-0000-0000-0000-0000000c0003', null, true);

insert into public.barbearias (id, nome, slug) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Barbearia A', 'barbearia-a'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'Barbearia B', 'barbearia-b');

insert into public.membros (id, barbearia_id, usuario_id, papel) values
  ('11111111-0000-0000-0000-00000000a001', 'aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000a001', 'dono'),
  ('11111111-0000-0000-0000-00000000a002', 'aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000a002', 'barbeiro'),
  ('11111111-0000-0000-0000-00000000b001', 'bbbbbbbb-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000b001', 'dono');

insert into public.perfis_profissionais (membro_id, barbearia_id, nome_exibicao) values
  ('11111111-0000-0000-0000-00000000a002', 'aaaaaaaa-0000-0000-0000-000000000000', 'Rafael Lima');

insert into public.clientes (id, usuario_id, nome) values
  ('22222222-0000-0000-0000-0000000c0001', '00000000-0000-0000-0000-0000000c0001', 'Cliente X'),
  ('22222222-0000-0000-0000-0000000c0002', '00000000-0000-0000-0000-0000000c0002', 'Cliente Y'),
  ('22222222-0000-0000-0000-0000000c0003', '00000000-0000-0000-0000-0000000c0003', 'Cliente Z');

insert into public.politicas_cancelamento (barbearia_id) values
  ('aaaaaaaa-0000-0000-0000-000000000000'),
  ('bbbbbbbb-0000-0000-0000-000000000000');

insert into public.agendamentos (id, barbearia_id, cliente_id, barbeiro_id, inicio, fim, status, valor_bruto_centavos, valor_pago_centavos, prazo_gratis_ate, tolerancia_ate, retencao_pct, plano) values
  ('44444444-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', '22222222-0000-0000-0000-0000000c0001', '11111111-0000-0000-0000-00000000a002',
   '2026-10-20 13:00-03', '2026-10-20 14:00-03', 'confirmado', 5500, 5500, '2026-10-20 11:00-03', '2026-10-20 13:15-03', 50, 'free'),
  ('44444444-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000000', '22222222-0000-0000-0000-0000000c0002', '11111111-0000-0000-0000-00000000b001',
   '2026-10-20 14:00-03', '2026-10-20 14:40-03', 'confirmado', 4500, 4500, '2026-10-20 12:00-03', '2026-10-20 14:15-03', 50, 'pro');

insert into public.pagamentos (agendamento_id, barbearia_id, meio, status, valor_centavos, cartao_token, cartao_final) values
  ('44444444-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', 'cartao', 'pre_autorizado', 5500, 'tok_segredo', '1111'),
  ('44444444-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000000', 'pix', 'pix_pago', 4500, null, null);

insert into public.lancamentos (barbearia_id, agendamento_id, tipo, evento_final, valor_pago_centavos, cliente_centavos, barbearia_centavos, navalha_centavos, taxa_gateway_centavos, quem_paga_gateway) values
  ('aaaaaaaa-0000-0000-0000-000000000000', '44444444-0000-0000-0000-00000000000a', 'liquidacao', 'concluido', 5500, 0, 4892, 440, 168, 'barbearia');

insert into public.bloqueios (barbearia_id, membro_id, inicio, fim, motivo) values
  ('aaaaaaaa-0000-0000-0000-000000000000', '11111111-0000-0000-0000-00000000a002', '2026-10-21 14:00-03', '2026-10-21 16:00-03', 'Consulta');

insert into public.notificacoes (usuario_id, titulo, corpo) values
  ('00000000-0000-0000-0000-0000000c0001', 'Lembrete', 'Seu corte é em 1 hora.'),
  ('00000000-0000-0000-0000-0000000c0002', 'Lembrete', 'Seu corte é em 1 hora.');

-- Integridade da agenda: o mesmo barbeiro não atende dois agendamentos ativos ao mesmo tempo.
select throws_ok(
  $$ insert into public.agendamentos (barbearia_id, cliente_id, barbeiro_id, inicio, fim, status, valor_bruto_centavos, valor_pago_centavos, prazo_gratis_ate, tolerancia_ate, retencao_pct, plano)
     values ('aaaaaaaa-0000-0000-0000-000000000000', '22222222-0000-0000-0000-0000000c0002', '11111111-0000-0000-0000-00000000a002',
             '2026-10-20 13:30-03', '2026-10-20 14:10-03', 'confirmado', 4000, 4000, '2026-10-20 11:30-03', '2026-10-20 13:45-03', 50, 'free') $$,
  '23P01', null, 'barbeiro não pode ter dois agendamentos ativos sobrepostos'
);
select lives_ok(
  $$ insert into public.agendamentos (barbearia_id, cliente_id, barbeiro_id, inicio, fim, status, valor_bruto_centavos, valor_pago_centavos, prazo_gratis_ate, tolerancia_ate, retencao_pct, plano)
     values ('aaaaaaaa-0000-0000-0000-000000000000', '22222222-0000-0000-0000-0000000c0002', '11111111-0000-0000-0000-00000000a002',
             '2026-10-20 14:00-03', '2026-10-20 14:40-03', 'confirmado', 4000, 4000, '2026-10-20 12:00-03', '2026-10-20 14:15-03', 50, 'free') $$,
  'horário colado no anterior (fim = início) é permitido'
);
select lives_ok(
  $$ insert into public.agendamentos (barbearia_id, cliente_id, barbeiro_id, inicio, fim, status, valor_bruto_centavos, valor_pago_centavos, prazo_gratis_ate, tolerancia_ate, retencao_pct, plano)
     values ('aaaaaaaa-0000-0000-0000-000000000000', '22222222-0000-0000-0000-0000000c0002', '11111111-0000-0000-0000-00000000a002',
             '2026-10-20 13:00-03', '2026-10-20 14:00-03', 'cancelado_no_prazo', 5500, 5500, '2026-10-20 11:00-03', '2026-10-20 13:15-03', 50, 'free') $$,
  'agendamento cancelado não ocupa o horário'
);
select matches(
  (select codigo from public.agendamentos where id = '44444444-0000-0000-0000-00000000000a'),
  '^NV-[0-9]{4,}$', 'agendamento recebe código NV-xxxx'
);
select throws_ok(
  $$ update public.barbearias set aceitar_agendamentos_online = true where id = 'aaaaaaaa-0000-0000-0000-000000000000' $$,
  '23514', null, 'sem ativar recebimentos, a barbearia não aceita agendamentos online (ajustes-taxas §Subconta)'
);
select throws_ok(
  $$ update public.politicas_cancelamento set retencao_pct = 101 where barbearia_id = 'aaaaaaaa-0000-0000-0000-000000000000' $$,
  '23514', null, 'retenção fica entre 0 e 100%'
);

-- Dono A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a001","role":"authenticated"}', true);
select is((select count(*) from public.pagamentos)::int, 1, 'dono A vê só o pagamento de A');
select is((select count(*) from public.lancamentos)::int, 1, 'dono A vê o extrato de A');
select throws_ok('select cartao_token from public.pagamentos', '42501', null, 'token do cartão nunca sai do banco para o usuário');
select is((select count(*) from public.bloqueios)::int, 1, 'dono A vê as folgas da equipe');

-- Barbeiro A: não recebe nem saca pela Navalha (regras-de-negocio §Visão geral e glossário).
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a002","role":"authenticated"}', true);
select is((select count(*) from public.pagamentos)::int, 0, 'barbeiro não vê pagamentos');
select is((select count(*) from public.lancamentos)::int, 0, 'barbeiro não vê o extrato');
select is((select count(*) from public.bloqueios)::int, 1, 'barbeiro vê as próprias folgas');

-- Cliente X
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000c0001","role":"authenticated"}', true);
select is((select count(*) from public.pagamentos)::int, 1, 'cliente vê o pagamento do próprio agendamento');
select is((select count(*) from public.notificacoes)::int, 1, 'cliente vê só as próprias notificações');
select is((select count(*) from public.bloqueios)::int, 0, 'cliente não vê o motivo das folgas');
select is((select count(*) from public.lancamentos)::int, 0, 'cliente não vê extrato da barbearia');

-- Usuário anônimo do cadastro leve
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000c0003","role":"authenticated","is_anonymous":true}', true);
select is((select count(*) from public.clientes)::int, 1, 'usuário anônimo vê só o próprio cadastro');
select is((select count(*) from public.agendamentos)::int, 0, 'usuário anônimo não vê agendamentos de outros');

-- Visitante sem login (página pública e checkout)
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*) from public.politicas_cancelamento where barbearia_id in ('aaaaaaaa-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000000'))::int, 2, 'política de cada barbearia é pública (checkout com valores dinâmicos)');
select is((select count(*) from public.perfis_profissionais where barbearia_id in ('aaaaaaaa-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000000'))::int, 1, 'perfil profissional do barbeiro é público');
select throws_ok('select count(*) from public.pagamentos', '42501', null, 'visitante não acessa pagamentos');
select throws_ok('select count(*) from public.bloqueios', '42501', null, 'visitante não acessa folgas');
select throws_ok('select count(*) from public.subcontas_asaas', '42501', null, 'visitante não acessa subcontas');

reset role;
select throws_ok(
  $$ update public.barbearias set capa_url = 'x); background: url(https://exemplo.com/a.png' where slug = 'barbearia-a' $$,
  '23514', null, 'capa só aceita URL http(s) simples (vai para o CSS da página pública)'
);

select * from finish();
rollback;
