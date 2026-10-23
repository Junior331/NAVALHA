-- Remarcar (Admin 02i): cada remarcação sobe a versão do agendamento, e os jobs agendados para o
-- horário antigo se descartam ao acordar. Balcão: pagamento combinado na barbearia, fora do app.

alter table public.agendamentos
  add column versao integer not null default 1,
  add column pago_no_balcao boolean not null default false;

-- Promoções criadas e editadas pelo dono direto do painel (Admin 07).
grant insert, update on public.promocoes to authenticated;
create policy dono_cria on public.promocoes for insert to authenticated
  with check (public.eh_dono(barbearia_id));
create policy dono_altera on public.promocoes for update to authenticated
  using (public.eh_dono(barbearia_id)) with check (public.eh_dono(barbearia_id));

-- Fidelidade editável pelo dono (Configurações).
grant update (ativa, cortes_necessarios, servico_gratis_id) on public.fidelidade_config to authenticated;
create policy dono_altera on public.fidelidade_config for update to authenticated
  using (public.eh_dono(barbearia_id)) with check (public.eh_dono(barbearia_id));
