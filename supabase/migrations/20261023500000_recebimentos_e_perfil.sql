-- Ativar recebimentos (ajustes-taxas §Subconta): a chave Pix da própria barbearia recebe os saques
-- (regras-de-negocio §Decisões: saque manual, mínimo de R$ 50, sobre o disponível).
alter table public.subcontas_asaas
  add column chave_pix_saque text;

-- Perfil da barbearia (Admin 09): capa e logo no Storage, numa pasta por barbearia. Leitura
-- pública (a página web e o app mostram as imagens); só o dono envia, troca e apaga.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('barbearias', 'barbearias', true, 2097152, '{image/jpeg,image/png,image/webp}')
on conflict (id) do nothing;

create function public.eh_dono_da_pasta(pasta text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.membros m
    where m.usuario_id = auth.uid() and m.ativo and m.papel = 'dono' and m.barbearia_id::text = pasta
  )
$$;
revoke all on function public.eh_dono_da_pasta(text) from public;
grant execute on function public.eh_dono_da_pasta(text) to authenticated;

create policy barbearias_imagens_leitura on storage.objects for select to anon, authenticated
  using (bucket_id = 'barbearias');
create policy barbearias_imagens_dono_envia on storage.objects for insert to authenticated
  with check (bucket_id = 'barbearias' and public.eh_dono_da_pasta((storage.foldername(name))[1]));
create policy barbearias_imagens_dono_troca on storage.objects for update to authenticated
  using (bucket_id = 'barbearias' and public.eh_dono_da_pasta((storage.foldername(name))[1]))
  with check (bucket_id = 'barbearias' and public.eh_dono_da_pasta((storage.foldername(name))[1]));
create policy barbearias_imagens_dono_apaga on storage.objects for delete to authenticated
  using (bucket_id = 'barbearias' and public.eh_dono_da_pasta((storage.foldername(name))[1]));
