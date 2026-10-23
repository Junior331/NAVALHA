# Navalha

Agendamento para barbearias com pagamento antecipado (Pix ou cartão) e cancelamento com regra
clara para a barbearia e para o cliente. O dinheiro fica retido na subconta da barbearia até o
evento final (atendido, cancelado, no-show) e só então é liquidado.

- **Painel web** (dono): agenda, equipe, serviços, promoções, financeiro, relatórios, perfil.
- **Página pública** `navalha.app/<slug>`: o cliente agenda e paga sem baixar o app.
- **App** (Expo): o cliente agenda e acompanha; o barbeiro cuida da agenda do dia.

As regras de negócio estão em [`docs/`](docs/). Quando dois documentos conflitam, vale a ordem do
[`CLAUDE.md`](CLAUDE.md). O plano está em [`docs/roadmap.md`](docs/roadmap.md) e o que foi feito,
com as decisões e pendências, em [`docs/execucao.md`](docs/execucao.md).

## Estrutura

| Pasta                 | O que é                                                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `apps/web`            | Next.js 16: painel, página pública, rotas da API e funções do Inngest                                                   |
| `apps/mobile`         | Expo SDK 58 com Expo Router: app do cliente e do barbeiro                                                               |
| `packages/core`       | Regras puras: dinheiro em centavos, estados, liquidação, política, cartão, disponibilidade, cupom, fidelidade, carteira |
| `packages/pagamentos` | Interface do gateway, gateway de mentira e adaptador do Asaas                                                           |
| `packages/servidor`   | Casos de uso e serviços (agendar, cancelar, liquidar, Pix, cartão, lote semanal, webhooks)                              |
| `packages/db`         | Conexão com o Postgres e tipos gerados do Supabase                                                                      |
| `supabase/`           | Migrações, RLS, seed da Barbearia do Zé, testes pgTAP e modelos de e-mail                                               |

## Rodando localmente

Pré-requisitos: Node 22 (`.nvmrc`), Docker (para o Supabase local) e Chrome (para os E2E locais).

```bash
# pnpm pelo npx: o corepack do Node 23 falha na verificação de assinatura
npx -y pnpm@9.15.4 install

# Supabase local (portas 553xx: API 55321, banco 55322, Studio 55323, e-mails 55324)
npx supabase start

# Variáveis de ambiente
cp apps/web/.env.example apps/web/.env.local        # preencha com `npx supabase status -o env`
cp apps/mobile/.env.example apps/mobile/.env.local  # mesma chave pública do Supabase

# Web (painel, página pública e API) em http://localhost:3000
cd apps/web && npx next dev -p 3000

# App: no navegador em http://localhost:8081, ou no celular pelo Expo
cd apps/mobile && npx expo start --web --port 8081
```

### Contas do seed

Todas com a senha `navalha123` (só no ambiente local).

| Quem                    | E-mail                                                |
| ----------------------- | ----------------------------------------------------- |
| Dono da Barbearia do Zé | `ze@barbeariadoze.com`                                |
| Barbeiros               | `rafael@barbeariadoze.com`, `diego@barbeariadoze.com` |
| Clientes                | `lucas@exemplo.com`, `marcos@exemplo.com`             |

O seed traz quatro semanas de histórico (atendimentos, Pix e cartão, no-show, cancelamentos e
liquidações) para o Dashboard, o Financeiro e os Relatórios. Cupons: `ZESABADO` e `NAVALHA20`.

### Pagamentos no desenvolvimento

Com `PAGAMENTOS=fake`, o gateway é de mentira: cartões aprovam, exceto o `4000000000000002`
(recusado). O Pix não tem banco para pagar, então a tela do Pix mostra **"Simular pagamento do
Pix"**, que faz o papel do webhook do Asaas. Esse atalho não existe em produção nem com
`PAGAMENTOS=asaas`.

As funções agendadas (pré-autorização, captura, lembrete, no-show automático, lote semanal) rodam
no Inngest. Localmente, suba o servidor de desenvolvimento dele (`npx inngest-cli@latest dev -u
http://localhost:3000/api/inngest`); sem ele, os eventos ficam só registrados no log.

## Testes

```bash
npx -y pnpm@9.15.4 verificar      # formato, lint, tipos e testes unitários (o mesmo do CI)
npx supabase test db              # RLS e schema (pgTAP)
cd packages/servidor && npx vitest run --config vitest.integracao.config.ts   # integração
cd apps/web && npx vitest run --config vitest.integracao.config.ts            # API

# E2E (Playwright) contra o servidor que já está de pé, usando o Chrome instalado
cd apps/web && E2E_URL=http://localhost:3000 PW_CANAL=chrome npx playwright test
```

Os fluxos do app estão em `apps/mobile/.maestro/` (Maestro). Eles precisam de um build de
desenvolvimento (`appId: app.navalha`) num emulador ou celular.

## Problemas conhecidos do ambiente local

- **Depois de `supabase db reset`, reinicie o `next dev`.** O reset recria os tipos do banco com
  OIDs novos, e o driver do Postgres guarda os antigos em cache (um status chega como
  `["onfirmado"]`).
- **Depois de `supabase db reset`, os e-mails voltam ao modelo padrão** (link em vez de código).
  Rode `npx supabase stop && npx supabase start` para reaplicar os modelos de `supabase/templates`.
- **Depois de instalar pacotes, reinicie o `next dev`** se aparecer "Module not found" de arquivos
  internos do Next: o pnpm reorganiza o `node_modules` (linker hoisted).
- **Windows:** as portas 54247–54346 são reservadas pelo sistema; por isso o Supabase usa 553xx.

## Produção

| Peça             | Configuração                                                                                                                |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Web              | Vercel (ou outro Node). Variáveis de `apps/web/.env.example`; `SUPABASE_JWT_SECRET` vazio (a sessão é verificada pelo JWKS) |
| Banco e Auth     | Supabase. Aplicar `supabase/migrations`, configurar os modelos de e-mail com código e o SMTP                                |
| Jobs             | Inngest Cloud: `INNGEST_SIGNING_KEY` e `INNGEST_EVENT_KEY`                                                                  |
| Pagamentos       | Asaas: `PAGAMENTOS=asaas`, `ASAAS_URL`, `ASAAS_CHAVE`, `ASAAS_WEBHOOK_TOKEN`, `NAVALHA_CHAVE_PIX`                           |
| E-mail           | Resend: `RESEND_CHAVE`, `EMAIL_REMETENTE`                                                                                   |
| App              | EAS Build com o `projectId` em `app.json` (necessário para o push)                                                          |
| Links universais | `IOS_APP_ID` e `ANDROID_SHA256` no web; domínio em `app.json`                                                               |
| Saúde            | `GET /api/saude` responde 200 com o banco no ar e 503 sem ele                                                               |

Bloqueios externos e itens que dependem de contas de terceiros estão em
[`docs/execucao.md`](docs/execucao.md#pendências-e-bloqueios).
