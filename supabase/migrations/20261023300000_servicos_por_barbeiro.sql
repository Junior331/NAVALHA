-- O dono define quem realiza cada serviço direto pelo painel (Admin 05c e Onboarding 02).
grant insert, delete on public.servico_barbeiro to authenticated;
create policy dono_altera on public.servico_barbeiro for insert to authenticated
  with check (public.eh_dono(barbearia_id));
create policy dono_remove on public.servico_barbeiro for delete to authenticated
  using (public.eh_dono(barbearia_id));
