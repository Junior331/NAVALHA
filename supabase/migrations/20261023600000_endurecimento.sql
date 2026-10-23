-- Revisão de segurança (roadmap, fase 8). Capa e logo vêm do Storage, mas o dono pode gravar a
-- coluna direto pela API do Supabase: só aceita URL http(s) sem aspas nem parênteses, que é o que
-- a página pública põe no CSS.
alter table public.barbearias
  add constraint capa_url_http check (capa_url is null or capa_url ~ '^https?://[^\s()''"]+$'),
  add constraint logo_url_http check (logo_url is null or logo_url ~ '^https?://[^\s()''"]+$');
