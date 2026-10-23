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
insert into public.subcontas_asaas (barbearia_id, asaas_conta_id, wallet_id, chave_api_secret_id, escrow_habilitado, status_kyc)
values (
  'ba7be000-0000-0000-0000-000000000001', 'sub_fake_ze', 'wallet_fake_ze',
  vault.create_secret('chave-fake-local', 'asaas-subconta-barbearia-do-ze'), true, 'aprovado'
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
