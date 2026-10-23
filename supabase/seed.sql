-- Seed de desenvolvimento: Barbearia do Zé com dados padronizados entre app e painel
-- (backlog-figma, "Todas as áreas · [regra] dados mockados"). Valores canônicos escolhidos:
--   endereço: Rua Augusta, 120 · Pinheiros · São Paulo/SP (app do cliente)
--   dono: Zé Barbosa (painel e relatórios); equipe: Rafael Lima e Diego Souza
--   horários (Cliente 03e): seg–qua 09–20, qui–sex 09–21, sáb 08–18, domingo fechado
--   serviços e preços (Cliente 07): Corte + Barba R$ 55 / 50 min etc.
--   política (Cliente 10c): 2h grátis, 50% retido, 15 min de tolerância
-- Senha de todos os usuários locais: navalha123 (só para o banco local).

-- ── Usuários ───────────────────────────────────────────────────────────────────────────────
with usuarios(id, email, nome) as (
  values
    ('5eed0000-0000-0000-0000-000000000001'::uuid, 'ze@barbeariadoze.com', 'Zé Barbosa'),
    ('5eed0000-0000-0000-0000-000000000002'::uuid, 'rafael@barbeariadoze.com', 'Rafael Lima'),
    ('5eed0000-0000-0000-0000-000000000003'::uuid, 'diego@barbeariadoze.com', 'Diego Souza'),
    ('5eed0000-0000-0000-0000-000000000004'::uuid, 'lucas@exemplo.com', 'Lucas Andrade'),
    ('5eed0000-0000-0000-0000-000000000005'::uuid, 'marcos@exemplo.com', 'Marcos Dias')
), criados as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  )
  select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email,
    extensions.crypt('navalha123', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('nome', nome), now(), now(),
    '', '', '', ''
  from usuarios
  returning id, email
)
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text, jsonb_build_object('sub', id::text, 'email', email), 'email', now(), now(), now()
from criados;

insert into public.perfis (usuario_id, nome, celular) values
  ('5eed0000-0000-0000-0000-000000000001', 'Zé Barbosa', '(11) 91234-5678'),
  ('5eed0000-0000-0000-0000-000000000002', 'Rafael Lima', '(11) 98888-1111'),
  ('5eed0000-0000-0000-0000-000000000003', 'Diego Souza', '(11) 97777-2222'),
  ('5eed0000-0000-0000-0000-000000000004', 'Lucas Andrade', '(11) 98765-4321'),
  ('5eed0000-0000-0000-0000-000000000005', 'Marcos Dias', '(11) 96666-3333');

-- ── Barbearia ──────────────────────────────────────────────────────────────────────────────
insert into public.barbearias (id, nome, slug, descricao, telefone, whatsapp, instagram, endereco, bairro, cidade, uf, recebimentos_ativos_em, aceitar_agendamentos_online)
values (
  'ba7be000-0000-0000-0000-000000000001', 'Barbearia do Zé', 'barbearia-do-ze',
  'Barbearia clássica no coração de Pinheiros. Cortes, barba e tratamentos com hora marcada, café na casa e atendimento sem pressa.',
  '(11) 4002-8922', '(11) 91234-5678', 'barbeariadoze', 'Rua Augusta, 120', 'Pinheiros', 'São Paulo', 'SP',
  now(), true
);

insert into public.assinaturas (barbearia_id, plano, ciclo, status) values
  ('ba7be000-0000-0000-0000-000000000001', 'pro', 'mensal', 'ativa');

-- Subconta de mentira, para o FakePaymentProvider: a chave fica no Vault, como em produção.
insert into public.subcontas_asaas (barbearia_id, asaas_conta_id, wallet_id, chave_api_secret_id, escrow_habilitado, status_kyc,
  chave_pix_saque)
values (
  'ba7be000-0000-0000-0000-000000000001', 'sub_fake_ze', 'wallet_fake_ze',
  vault.create_secret('chave-fake-local', 'asaas-subconta-barbearia-do-ze'), true, 'aprovado',
  'financeiro@barbeariadoze.com'
);

insert into public.horarios_barbearia (barbearia_id, dia_semana, abre, fecha) values
  ('ba7be000-0000-0000-0000-000000000001', 1, '09:00', '20:00'),
  ('ba7be000-0000-0000-0000-000000000001', 2, '09:00', '20:00'),
  ('ba7be000-0000-0000-0000-000000000001', 3, '09:00', '20:00'),
  ('ba7be000-0000-0000-0000-000000000001', 4, '09:00', '21:00'),
  ('ba7be000-0000-0000-0000-000000000001', 5, '09:00', '21:00'),
  ('ba7be000-0000-0000-0000-000000000001', 6, '08:00', '18:00');

insert into public.politicas_cancelamento (barbearia_id, prazo_gratis_horas, retencao_pct, tolerancia_min) values
  ('ba7be000-0000-0000-0000-000000000001', 2, 50, 15);

-- ── Equipe ─────────────────────────────────────────────────────────────────────────────────
insert into public.membros (id, barbearia_id, usuario_id, papel) values
  ('3e3b0000-0000-0000-0000-000000000001', 'ba7be000-0000-0000-0000-000000000001', '5eed0000-0000-0000-0000-000000000001', 'dono'),
  ('3e3b0000-0000-0000-0000-000000000002', 'ba7be000-0000-0000-0000-000000000001', '5eed0000-0000-0000-0000-000000000002', 'barbeiro'),
  ('3e3b0000-0000-0000-0000-000000000003', 'ba7be000-0000-0000-0000-000000000001', '5eed0000-0000-0000-0000-000000000003', 'barbeiro');

insert into public.perfis_profissionais (membro_id, barbearia_id, nome_exibicao, bio, especialidades) values
  ('3e3b0000-0000-0000-0000-000000000001', 'ba7be000-0000-0000-0000-000000000001', 'Zé Barbosa',
   'Dono da casa. Corte clássico e barba na toalha quente.', '{"Corte clássico","Barba"}'),
  ('3e3b0000-0000-0000-0000-000000000002', 'ba7be000-0000-0000-0000-000000000001', 'Rafael Lima',
   'Há 6 anos na barbearia, especialista em degradê e acabamento na navalha. Atende com calma e sem pressa.',
   '{"Degradê","Barba","Sobrancelha"}'),
  ('3e3b0000-0000-0000-0000-000000000003', 'ba7be000-0000-0000-0000-000000000001', 'Diego Souza',
   'Química e pigmentação, do platinado à camuflagem de fios brancos.', '{"Pigmentação","Química"}');

insert into public.convites (barbearia_id, token_hash, nome, contato, papel, expira_em, criado_por) values
  ('ba7be000-0000-0000-0000-000000000001', encode(extensions.digest('convite-local-matheus', 'sha256'), 'hex'),
   'Matheus Rocha', 'matheus@email.com', 'barbeiro', now() + interval '7 days', '5eed0000-0000-0000-0000-000000000001');

-- Seg–sex com intervalo de almoço; sábado sem intervalo (Figma Barbeiro 09).
insert into public.horarios_atendimento (membro_id, barbearia_id, dia_semana, inicio, fim, pausa_inicio, pausa_fim)
select m.id, 'ba7be000-0000-0000-0000-000000000001', d,
  case when d = 6 then time '08:00' else time '09:00' end,
  case when d = 6 then time '15:00' else time '19:00' end,
  case when d = 6 then null else time '12:00' end,
  case when d = 6 then null else time '13:00' end
from (values
  ('3e3b0000-0000-0000-0000-000000000001'::uuid),
  ('3e3b0000-0000-0000-0000-000000000002'::uuid),
  ('3e3b0000-0000-0000-0000-000000000003'::uuid)
) as m(id)
cross join generate_series(1, 6) as d;

-- ── Serviços ───────────────────────────────────────────────────────────────────────────────
insert into public.servicos (id, barbearia_id, nome, categoria, descricao, duracao_min, preco_centavos, ativo, ordem) values
  ('5e7f0000-0000-0000-0000-000000000001', 'ba7be000-0000-0000-0000-000000000001', 'Corte + Barba', 'Combo', 'O mais pedido', 50, 5500, true, 1),
  ('5e7f0000-0000-0000-0000-000000000002', 'ba7be000-0000-0000-0000-000000000001', 'Corte + Barba + Sobrancelha', 'Combo', 'Pacote completo', 60, 6500, true, 2),
  ('5e7f0000-0000-0000-0000-000000000003', 'ba7be000-0000-0000-0000-000000000001', 'Corte masculino', 'Cabelo', 'Tesoura ou máquina', 40, 4000, true, 3),
  ('5e7f0000-0000-0000-0000-000000000004', 'ba7be000-0000-0000-0000-000000000001', 'Degradê', 'Cabelo', 'Acabamento na navalha', 45, 4500, true, 4),
  ('5e7f0000-0000-0000-0000-000000000005', 'ba7be000-0000-0000-0000-000000000001', 'Barba', 'Barba', 'Toalha quente', 30, 3000, true, 5),
  ('5e7f0000-0000-0000-0000-000000000006', 'ba7be000-0000-0000-0000-000000000001', 'Sobrancelha', 'Estética', 'Na navalha', 15, 1500, true, 6),
  ('5e7f0000-0000-0000-0000-000000000007', 'ba7be000-0000-0000-0000-000000000001', 'Pigmentação', 'Química', 'Barba ou cabelo', 40, 6000, true, 7),
  ('5e7f0000-0000-0000-0000-000000000008', 'ba7be000-0000-0000-0000-000000000001', 'Hidratação', 'Química', 'Tratamento capilar', 30, 4500, false, 8);

insert into public.servico_barbeiro (servico_id, membro_id, barbearia_id)
select s.id::uuid, m.id::uuid, 'ba7be000-0000-0000-0000-000000000001'
from (values
  ('3e3b0000-0000-0000-0000-000000000001', array['1','2','3','5','6']),
  ('3e3b0000-0000-0000-0000-000000000002', array['1','2','4','5','6']),
  ('3e3b0000-0000-0000-0000-000000000003', array['3','5','7','8'])
) as m(id, servicos)
cross join lateral unnest(m.servicos) as n
cross join lateral (select '5e7f0000-0000-0000-0000-00000000000' || n as id) as s;

insert into public.fidelidade_config (barbearia_id, ativa, cortes_necessarios, servico_gratis_id) values
  ('ba7be000-0000-0000-0000-000000000001', true, 5, '5e7f0000-0000-0000-0000-000000000003');

insert into public.promocoes (barbearia_id, nome, descricao, tipo, codigo, desconto_tipo, desconto_valor, servico_ids, dias_semana, inicio, fim, limite_usos) values
  ('ba7be000-0000-0000-0000-000000000001', 'Fim de semana', 'na Hidratação e Pigmentação, aos sábados e domingos.',
   'cupom', 'ZESABADO', 'percentual', 10,
   array['5e7f0000-0000-0000-0000-000000000007', '5e7f0000-0000-0000-0000-000000000008']::uuid[],
   array[0, 6]::smallint[], now() - interval '1 day', now() + interval '30 days', 100),
  ('ba7be000-0000-0000-0000-000000000001', 'Primeira vez', 'no primeiro corte de clientes novos.',
   'cupom', 'NAVALHA20', 'percentual', 20, null, null, now() - interval '1 day', now() + interval '30 days', 100);

-- ── Clientes e agendamentos ────────────────────────────────────────────────────────────────
insert into public.clientes (id, usuario_id, nome, celular, email) values
  ('c11e0000-0000-0000-0000-000000000001', '5eed0000-0000-0000-0000-000000000004', 'Lucas Andrade', '(11) 98765-4321', 'lucas@exemplo.com'),
  ('c11e0000-0000-0000-0000-000000000002', '5eed0000-0000-0000-0000-000000000005', 'Marcos Dias', '(11) 96666-3333', 'marcos@exemplo.com');

insert into public.fidelidade_progresso (barbearia_id, cliente_id, cortes) values
  ('ba7be000-0000-0000-0000-000000000001', 'c11e0000-0000-0000-0000-000000000001', 3);

-- Amanhã 16:30: Lucas com Rafael, Corte + Barba + Sobrancelha avulsos (65 min, R$ 70), cartão.
with horario as (
  select ((current_date + 1) + time '16:30') at time zone 'America/Sao_Paulo' as inicio
), ag as (
  insert into public.agendamentos (id, barbearia_id, cliente_id, barbeiro_id, inicio, fim, status,
    valor_bruto_centavos, valor_pago_centavos, prazo_gratis_ate, tolerancia_ate, retencao_pct, plano, origem)
  select 'a9e0000e-0000-0000-0000-000000000001', 'ba7be000-0000-0000-0000-000000000001',
    'c11e0000-0000-0000-0000-000000000001', '3e3b0000-0000-0000-0000-000000000002',
    inicio, inicio + interval '65 minutes', 'confirmado', 7000, 7000,
    inicio - interval '2 hours', inicio + interval '15 minutes', 50, 'pro', 'app'
  from horario
  returning id, inicio
)
insert into public.pagamentos (agendamento_id, barbearia_id, meio, status, valor_centavos, cartao_final, capturar_em)
select id, 'ba7be000-0000-0000-0000-000000000001', 'cartao', 'pre_autorizado', 7000, '4242', inicio - interval '2 hours'
from ag;

insert into public.agendamento_servicos (agendamento_id, servico_id, nome, duracao_min, preco_centavos) values
  ('a9e0000e-0000-0000-0000-000000000001', '5e7f0000-0000-0000-0000-000000000001', 'Corte + Barba', 50, 5500),
  ('a9e0000e-0000-0000-0000-000000000001', '5e7f0000-0000-0000-0000-000000000006', 'Sobrancelha', 15, 1500);

-- Ontem 10:00: Marcos com Zé, Corte + Barba via Pix, concluído e liquidado (plano Pro: sem taxa).
with horario as (
  select ((current_date - 1) + time '10:00') at time zone 'America/Sao_Paulo' as inicio
), ag as (
  insert into public.agendamentos (id, barbearia_id, cliente_id, barbeiro_id, inicio, fim, status,
    valor_bruto_centavos, valor_pago_centavos, prazo_gratis_ate, tolerancia_ate, retencao_pct, plano,
    origem, iniciado_em, concluido_em)
  select 'a9e0000e-0000-0000-0000-000000000002', 'ba7be000-0000-0000-0000-000000000001',
    'c11e0000-0000-0000-0000-000000000002', '3e3b0000-0000-0000-0000-000000000001',
    inicio, inicio + interval '50 minutes', 'concluido', 5500, 5500,
    inicio - interval '2 hours', inicio + interval '15 minutes', 50, 'pro', 'app',
    inicio + interval '2 minutes', inicio + interval '50 minutes'
  from horario
  returning id
)
insert into public.pagamentos (agendamento_id, barbearia_id, meio, status, valor_centavos)
select id, 'ba7be000-0000-0000-0000-000000000001', 'pix', 'pix_pago', 5500 from ag;

insert into public.agendamento_servicos (agendamento_id, servico_id, nome, duracao_min, preco_centavos) values
  ('a9e0000e-0000-0000-0000-000000000002', '5e7f0000-0000-0000-0000-000000000001', 'Corte + Barba', 50, 5500);

insert into public.lancamentos (barbearia_id, agendamento_id, tipo, evento_final, valor_pago_centavos, barbearia_centavos, quem_paga_gateway)
values ('ba7be000-0000-0000-0000-000000000001', 'a9e0000e-0000-0000-0000-000000000002', 'liquidacao', 'concluido', 5500, 5500, 'ninguem');

insert into public.avaliacoes (barbearia_id, agendamento_id, cliente_id, membro_id, nota, comentario) values
  ('ba7be000-0000-0000-0000-000000000001', 'a9e0000e-0000-0000-0000-000000000002', 'c11e0000-0000-0000-0000-000000000002',
   '3e3b0000-0000-0000-0000-000000000001', 5, 'Melhor corte que já fiz na região. O Zé não tem pressa e o resultado ficou impecável.');

-- ── Histórico das últimas 4 semanas (Dashboard, Financeiro e Relatórios) ───────────────────
-- Determinístico: os mesmos dias, horários e serviços a cada reset. Plano Pro: sem taxa Navalha
-- no atendimento; no no-show a Navalha fica com 20% do retido menos G (regras-de-negocio).
insert into public.clientes (id, nome, celular) values
  ('c11e0000-0000-0000-0000-000000000003', 'Bruno Alves', '(11) 95555-1010'),
  ('c11e0000-0000-0000-0000-000000000004', 'Davi Moreira', '(11) 95555-2020'),
  ('c11e0000-0000-0000-0000-000000000005', 'Felipe Ramos', '(11) 95555-3030'),
  ('c11e0000-0000-0000-0000-000000000006', 'Gustavo Lima', '(11) 95555-4040'),
  ('c11e0000-0000-0000-0000-000000000007', 'Henrique Costa', '(11) 95555-5050'),
  ('c11e0000-0000-0000-0000-000000000008', 'Igor Santos', '(11) 95555-6060'),
  ('c11e0000-0000-0000-0000-000000000009', 'João Pedro Nunes', '(11) 95555-7070'),
  ('c11e0000-0000-0000-0000-000000000010', 'Kaique Souza', '(11) 95555-8080');

create temporary table historico as
with dias as (
  select d::date as dia, (row_number() over (order by d))::int as n
  from generate_series(current_date - 28, current_date - 2, interval '1 day') as d
  where extract(dow from d) <> 0
), vagas as (
  select dias.dia, dias.n, b.membro, b.ordem, h.hora, h.ordem as turno
  from dias
  cross join (values
    ('3e3b0000-0000-0000-0000-000000000001'::uuid, 1),
    ('3e3b0000-0000-0000-0000-000000000002'::uuid, 2),
    ('3e3b0000-0000-0000-0000-000000000003'::uuid, 3)
  ) as b(membro, ordem)
  cross join (values (time '10:00', 1), (time '14:00', 2), (time '17:00', 3)) as h(hora, ordem)
  where (dias.n + b.ordem + h.ordem) % 4 <> 0
), escolhas as (
  select v.*,
    (case v.ordem
      when 1 then (array['1', '2', '3', '5'])[1 + (v.n + v.turno) % 4]
      when 2 then (array['1', '2', '4', '5'])[1 + (v.n + v.turno) % 4]
      else (array['3', '5', '7'])[1 + (v.n + v.turno) % 3]
    end) as servico_n,
    1 + (v.n * 3 + v.ordem * 2 + v.turno) % 10 as cliente_n,
    case when (v.n + v.turno) % 3 = 0 then 'cartao' else 'pix' end as meio_escolhido,
    case
      when (v.n + v.ordem + v.turno) % 17 = 0 then 'no_show'
      when (v.n + v.ordem) % 19 = 0 then 'cancelado_pela_barbearia'
      else 'concluido'
    end as status,
    case when (v.n + v.ordem) % 7 = 0 then 'balcao' when v.n % 5 = 0 then 'web' else 'app' end as origem
  from vagas v
)
select gen_random_uuid() as id, e.membro, e.status, e.origem,
  case when e.origem = 'balcao' then 'nenhum' else e.meio_escolhido end as meio,
  ('c11e0000-0000-0000-0000-0000000000' || lpad(e.cliente_n::text, 2, '0'))::uuid as cliente,
  s.id as servico, s.nome, s.duracao_min, s.preco_centavos::bigint as preco,
  ((e.dia + e.hora) at time zone 'America/Sao_Paulo') as inicio,
  case when e.meio_escolhido = 'cartao' and e.origem <> 'balcao'
    then floor(s.preco_centavos * 0.0299)::bigint + 49 else 0 end as g,
  (e.n + e.turno) % 4 as nota_extra
from escolhas e
join public.servicos s on s.id = ('5e7f0000-0000-0000-0000-00000000000' || e.servico_n)::uuid;

insert into public.agendamentos (id, barbearia_id, cliente_id, barbeiro_id, inicio, fim, status,
  valor_bruto_centavos, valor_pago_centavos, prazo_gratis_ate, tolerancia_ate, retencao_pct, plano,
  origem, pago_no_balcao, iniciado_em, concluido_em, cancelado_em, motivo_cancelamento)
select id, 'ba7be000-0000-0000-0000-000000000001', cliente, membro, inicio,
  inicio + make_interval(mins => duracao_min), status::public.status_agendamento, preco, preco,
  inicio - interval '2 hours', inicio + interval '15 minutes', 50, 'pro',
  origem::public.origem_agendamento, origem = 'balcao',
  case when status = 'concluido' then inicio + interval '3 minutes' end,
  case when status = 'concluido' then inicio + make_interval(mins => duracao_min) end,
  case when status = 'cancelado_pela_barbearia' then inicio - interval '1 day' end,
  case when status = 'cancelado_pela_barbearia' then 'Barbeiro indisponível' end
from historico;

insert into public.agendamento_servicos (agendamento_id, servico_id, nome, duracao_min, preco_centavos)
select id, servico, nome, duracao_min, preco from historico;

insert into public.pagamentos (agendamento_id, barbearia_id, meio, status, valor_centavos,
  taxa_gateway_centavos, valor_estornado_centavos, cartao_final, capturar_em)
select id, 'ba7be000-0000-0000-0000-000000000001', meio::public.meio_pagamento,
  (case
    when meio = 'pix' and status = 'cancelado_pela_barbearia' then 'estornado'
    when meio = 'pix' then 'pix_pago'
    when status = 'cancelado_pela_barbearia' then 'pre_autorizacao_cancelada'
    else 'capturado'
  end)::public.status_pagamento,
  preco,
  case when status = 'cancelado_pela_barbearia' then 0 else g end,
  case when status = 'cancelado_pela_barbearia' and meio = 'pix' then preco
       when status = 'no_show' then preco / 2 else 0 end,
  case when meio = 'cartao' then '4242' end,
  case when meio = 'cartao' then inicio - interval '2 hours' end
from historico
where meio <> 'nenhum';

-- Liquidação de cada evento final. No-show com 50% retido: 80% do retido para a barbearia e
-- 20% para a Navalha, que paga o G. Cancelado pela barbearia: tudo volta para o cliente.
insert into public.lancamentos (barbearia_id, agendamento_id, tipo, evento_final, valor_pago_centavos,
  cliente_centavos, barbearia_centavos, navalha_centavos, taxa_gateway_centavos, quem_paga_gateway, criado_em)
select 'ba7be000-0000-0000-0000-000000000001', id, 'liquidacao', status::public.evento_final,
  case when meio = 'nenhum' then 0 else preco end,
  case when meio = 'nenhum' then 0 when status = 'no_show' then preco / 2
       when status = 'cancelado_pela_barbearia' then preco else 0 end,
  case when meio = 'nenhum' then 0 when status = 'concluido' then preco - g
       when status = 'no_show' then (preco / 2) * 8 / 10 else 0 end,
  case when meio <> 'nenhum' and status = 'no_show'
    then (preco / 2) - (preco / 2) * 8 / 10 - g else 0 end,
  case when status = 'cancelado_pela_barbearia' then 0 else g end,
  (case when g = 0 or status = 'cancelado_pela_barbearia' then 'ninguem'
        when status = 'no_show' then 'navalha' else 'barbearia' end)::public.pagador_gateway,
  inicio + make_interval(mins => duracao_min + 5)
from historico;

insert into public.taxas_a_transferir (barbearia_id, agendamento_id, valor_centavos, criado_em)
select 'ba7be000-0000-0000-0000-000000000001', l.agendamento_id, l.navalha_centavos, l.criado_em
from public.lancamentos l
join historico h on h.id = l.agendamento_id
where l.navalha_centavos <> 0;

-- As taxas de mais de uma semana já foram no lote semanal; as recentes esperam o próximo.
with lote as (
  insert into public.lotes_semanais (barbearia_id, semana, valor_centavos, status, asaas_transferencia_id)
  select 'ba7be000-0000-0000-0000-000000000001', date_trunc('week', current_date - 7)::date,
    coalesce(sum(valor_centavos), 0), 'concluida', 'tra_seed_1'
  from public.taxas_a_transferir
  where barbearia_id = 'ba7be000-0000-0000-0000-000000000001' and criado_em < current_date - 7
  returning id
)
update public.taxas_a_transferir t set lote_id = lote.id
from lote
where t.barbearia_id = 'ba7be000-0000-0000-0000-000000000001' and t.criado_em < current_date - 7;

insert into public.saques (barbearia_id, valor_centavos, status, solicitado_por, asaas_transferencia_id, criado_em)
values ('ba7be000-0000-0000-0000-000000000001', 150000, 'concluida',
  '5eed0000-0000-0000-0000-000000000001', 'tra_seed_saque_1', now() - interval '6 days');

insert into public.avaliacoes (barbearia_id, agendamento_id, cliente_id, membro_id, nota, comentario)
select 'ba7be000-0000-0000-0000-000000000001', id, cliente, membro,
  case when nota_extra = 0 then 4 else 5 end,
  (array['Atendimento pontual e caprichado.', 'Voltarei com certeza.', null,
    'Ambiente top e corte no capricho.'])[1 + nota_extra]
from historico
where status = 'concluido' and nota_extra <> 2;

drop table historico;
