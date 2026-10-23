# Navalha — Roadmap de desenvolvimento e testes

Oct 22, 2026 · aprovado em 22/10 · fases 0–8 implementadas em 23/10 (o que foi feito, as decisões e as pendências estão em `docs/execucao.md`)

O roadmap se apoia em `docs/mapa.md`, nos três docs de regras (prioridade do `CLAUDE.md`: `ajustes-taxas` > `cartao-pre-autorizado` > `regras-de-negocio`) e em `docs/backlog-figma.md`.

**Regra de ordem:**
- **Fases 0–5:** não dependem de nenhuma tela.
- **Fase 6:** telas estáveis no Figma.
- **Fase 7:** telas ainda em ajuste no backlog.
- **Fase 8:** lançamento.

## Tabela-resumo

Estimativa para 1 dev com Claude Code, em dias úteis.

| Fase | Feature | Depende de | Bloqueio externo | Dias |
|---|---|---|---|---|
| 0 | Fundação: monorepo, CI, Supabase local | — | — | 3 |
| 1 | Domínio em `packages/core` | 0 | — | 8 |
| 2 | Banco, Auth e RLS | 0, 1 | — | 6 |
| 3 | `PaymentProvider` + Asaas sandbox + webhooks | 1, 2 | Conta Asaas sandbox; respostas do suporte (Escrow, estorno parcial, pré-autorização, tarifas) | 10 |
| 4 | Jobs no Inngest + liquidação | 1, 3 | — | 6 |
| 5 | API e notificações (`Notifier`: push + e-mail) | 2, 4 | Domínio de e-mail verificado no Resend | 6 |
| 6a | Acessos, cadastro e onboarding | 5 | — | 5 |
| 6b | App do barbeiro · partes estáveis | 5 | — | 4 |
| 6c | Admin · barbeiros, serviços, dashboard | 5 | — | 6 |
| 6d | Cliente · descoberta, conta, histórico, avaliação | 5 | — | 5 |
| 7a | Cliente · fluxo de agendamento e checkout (07–12, 15) | 4, 6d | Backlog do Figma | 8 |
| 7b | Página web pública + cadastro leve | 7a | Backlog do Figma | 5 |
| 7c | Admin · agenda, cancelar, no-show, ações de barbeiro | 4, 6c | Backlog do Figma | 6 |
| 7d | Admin · Ativar recebimentos, Financeiro, Configurações, Perfil | 3, 4, 6c | Backlog do Figma; CNPJ aprovado no Asaas (subconta em produção) | 7 |
| 7e | Admin · relatórios e promoções | 6c | Backlog do Figma | 4 |
| 7f | App do barbeiro · Meus ganhos, detalhe, notificações | 6b | Backlog do Figma | 2 |
| 8 | Lançamento: revisão de segurança, conta Asaas de produção, lojas, hardening | todas | CNPJ aprovado no Asaas; contas Apple/Google; Meta Business aberta em paralelo (WhatsApp pós-lançamento) | 4 |
| | **Total** | | | **95** |

Bloqueios externos que valem para o projeto inteiro (abrir já, em paralelo):
1. Conta Asaas com CNPJ aprovado. O sandbox não precisa, mas a produção sim.
2. Respostas do suporte do Asaas:
   - `ajustes-taxas` §Perguntas.
   - `cartao-pre-autorizado` §Perguntas.
   - `regras-de-negocio` §Validar com o Asaas e §Decisões.
3. Conta Meta Business, para a API do WhatsApp entrar logo depois do lançamento.
4. Contas de desenvolvedor Apple e Google.

---

## Decisões de arquitetura, com justificativa

Nenhuma skill do projeto cobre arquitetura, banco, pagamentos ou segurança. As skills de `.claude/skills/` são de UX, e as de `.agents/skills/` são de processo. As decisões abaixo seguem as boas práticas atuais de cada ferramenta.

| Decisão | Escolha | Justificativa |
|---|---|---|
| Monorepo | Turborepo + pnpm workspaces, TS strict | Já decidido. pnpm pelo isolamento de dependências e pelo cache do Turborepo no CI |
| Regras de negócio | `packages/core` puro, sem I/O | Já decidido. Toda regra de dinheiro e de estado é testável sem rede nem banco. App, web e jobs importam a mesma função |
| Dinheiro | Inteiros em centavos (tipo `Money`) | Evita erro de ponto flutuante. Testes de propriedade (fast-check) garantem que cliente + barbearia + Navalha = valor pago |
| Tarefas agendadas | **Inngest** (não Trigger.dev) | Roda como route handler do Next.js (`/api/inngest`), sem worker separado. O fluxo do `cartao-pre-autorizado` mapeia 1:1: `step.sleepUntil` para a janela de 72h e a captura; `step.waitForEvent` com timeout de 12h para a regularização; `cancelOn` no evento `agendamento.cancelado` para matar sozinho os passos pendentes; cron para o lote semanal; idempotência por id do agendamento. O Trigger.dev cobre o mesmo, mas exige deploy separado das tasks e cancelamento manual de runs |
| Webhooks do Asaas | Route handler valida o header `asaas-access-token`, grava o id em `webhook_eventos` (`unique`), responde 200 e publica um evento no Inngest | Webhook chega repetido e fora de ordem: idempotência no banco e processamento fora da request evitam timeout e duplicidade |
| Pagamentos | Interface `PaymentProvider` com `AsaasProvider` e `FakePaymentProvider` | Já decidido. O fake permite testar a liquidação inteira sem rede; o sandbox fica para a integração |
| Taxa do gateway (G) | Vem do provider em cada transação; para simulações usa o preço cheio (2,99% + R$ 0,49 no cartão) | `ajustes-taxas` §G com preço cheio. O modelo não depende de promoção |
| Multi-tenant | RLS por `barbearia_id`, com função `barbearias_do_usuario()` a partir de `membros`. O cliente só vê os próprios agendamentos | Já decidido. O isolamento fica no banco, não só na API |
| Testes de RLS | pgTAP (`supabase test db`) + Vitest com JWT por papel | O pgTAP testa a policy direto; o Vitest testa o caminho real da API |
| Cadastro leve (web) | Supabase anonymous sign-in, vinculado a `clientes` (nome, celular, e-mail); a conta vira permanente ao verificar o e-mail | O checkout não obriga a baixar o app nem a criar senha, e o RLS continua valendo |
| Cartão | Nunca gravar dado de cartão; só o `creditCardToken` | Escopo PCI mínimo. **Decisão em aberto:** confirmar com o Asaas se existe tokenização no cliente ou checkout hospedado, para o dado do cartão não passar pelo nosso servidor. Resolver antes da fase 3 |
| Notificações | Interface `Notifier`: push (Expo) e e-mail (Resend) no MVP; WhatsApp Cloud API depois | Escolha do usuário. O botão `wa.me` manual no Admin cobre cancelamento e remarcação |
| Unitários | Vitest | Funciona em `packages/core`, `apps/web` e jobs, com um só runner |
| E2E web | Playwright, seguindo `/e2e-coverage` (seletor por role/label, porta dedicada, `storageState`, `--repeat-each=3` em teste novo, `@axe-core/playwright`) | Recomendado por `/e2e-coverage` e pelo agente QA do projeto |
| E2E mobile | **Maestro** | Nenhuma skill do projeto recomenda ferramenta de E2E mobile. Maestro usa fluxos em YAML, roda contra dev build do Expo e é suportado nos EAS Workflows. Detox exige configuração nativa mais pesada |
| CI | GitHub Actions: lint, typecheck, unit, pgTAP em todo PR; integração com sandbox e E2E no merge e à noite | O sandbox é lento e tem limite de requisições; não deve travar PR |

**Decisões em aberto** (registrar a resposta aqui quando sair):
1. **Arredondamento:** quem fica com o centavo que sobra na divisão 80/20 e nos 8%.
2. **Caminho PCI do cartão:** ver a linha "Cartão" acima.
3. **No-show:** marcação automática ao fim da tolerância, ou automática com confirmação do barbeiro. O roadmap assume automática com aviso e desfazer.
4. **Ordem no Escrow:** liberar antes ou depois do estorno parcial (`regras-de-negocio` §Validar com o Asaas).

**Skills usadas e onde entram:**
- **`test-driven-development`:** teste falhando antes do código, sem exceção no `core`.
- **`verification-before-completion`:** nada é dado como pronto sem o comando rodado e a saída lida.
- **`requesting-code-review`:** ao fim de cada feature.
- **`/e2e-coverage`:** suíte web.
- **`security-review`** (comando embutido): antes do lançamento.
- **`cognitive-walkthrough`, `nielsen-heuristics-audit`, `ui-design-review`, `ux-audit-rethink`:** critério de aceite de cada tela.

---

## Critério de pronto (vale para toda feature)

1. Testes da feature verdes no CI: unit, pgTAP, integração quando houver, e E2E quando houver tela.
2. **Telas novas:** a skill `cognitive-walkthrough` rodada no fluxo principal, mais `nielsen-heuristics-audit` e `ui-design-review` na tela. A `ux-audit-rethink` roda no fim de cada fase 7. Nenhum problema de severidade ≥ 3 aberto.
3. Item correspondente do `backlog-figma.md` marcado como feito.
4. Revisão de código com `requesting-code-review`, sem achado Critical ou Important aberto.

---

## Fase 0 · Fundação

- **Objetivo:** base para tudo. Perfil afetado: nenhum.
- **Regras:** nenhuma.
- **Telas:** nenhuma.
- **Tarefas:**
  1. `git init` e scaffold Turborepo + pnpm. Estrutura: `apps/web` (Next.js App Router), `apps/mobile` (Expo, Expo Router), `packages/core`, `packages/config` (tsconfig, eslint, prettier).
  2. Vitest em `packages/core` e `apps/web`, com um teste trivial em cada.
  3. GitHub Actions rodando lint, typecheck e test com cache do Turborepo.
  4. Supabase CLI: `supabase init`, banco local e job de pgTAP no CI.
- **Testes:** o CI precisa falhar com um teste quebrado e passar com ele corrigido. Isso prova que o CI realmente roda os testes.
- **Dependências:** nenhuma. **Bloqueios externos:** nenhum.

## Fase 1 · Domínio (`packages/core`)

- **Objetivo:** todas as regras de dinheiro, estado e agenda como funções puras. Perfis afetados: todos.
- **Regras:**
  - `regras-de-negocio` §Cenários de liquidação, §Política de cancelamento, §Outras regras e §Decisões.
  - `cartao-pre-autorizado` §Cartão.
  - `ajustes-taxas` §G com preço cheio.
- **Telas:** nenhuma.
- **Tarefas** (um PR cada):
  1. `Money`: centavos, soma, percentual, regra de arredondamento única.
  2. Máquina de estados do agendamento: transições válidas e inválidas (não existe Pendente).
  3. Liquidação: `liquidar(evento, plano, valorPago, retencao, G, meio)` devolve as partes de cliente, barbearia e Navalha, e quem paga G.
  4. Política de cancelamento: dentro ou fora do prazo grátis, tolerância e no-show; no Pix, crédito de 100% ou reembolso descontando o custo do Pix.
  5. Cupom e fidelidade: desconto em % ou R$, dias válidos, limite de usos; serviço grátis sem taxa nem repasse; no-show consome o prêmio.
  6. Janelas do cartão: `preAutorizarEm`, `prazoRegularizacao` (12h), `capturarEm` (fim do prazo grátis), e a decisão "pré-autoriza agora ou tokeniza" (mais de 72h).
  7. Disponibilidade: horários por barbeiro, intervalo, folgas, pausa, duração somada dos serviços, conflitos, barbeiro que faz todos os serviços escolhidos.
  8. Carteira: disponível = saldo − taxas a transferir; saque mínimo de R$ 50 sobre o disponível.
- **Testes unitários (mínimo):**
  - **Os 5 cenários de liquidação:**
    - Concluído Free (R$ 92 − G / R$ 8).
    - Concluído Basic/Pro (R$ 100 − G / R$ 0).
    - Cliente cancela no prazo: no cartão nada foi capturado; no Pix, crédito de 100% ou reembolso − custo do Pix.
    - Cliente cancela fora do prazo ou no-show (R$ 50 / R$ 40 limpo / R$ 10 − G).
    - Barbearia cancela (R$ 100 de volta; custo do estorno sai da barbearia).
  - **Retenção:** 100%, 80%, 50%, 30% e 0%, conferindo cada linha da tabela de `regras-de-negocio` §Política de cancelamento.
  - **Plano:** Free × Basic × Pro em cada cenário.
  - **Taxa de 8%:** só no Concluído Free; não se aplica no cancelamento tardio nem no no-show.
  - **Cupom:** a taxa de 8% e a retenção são calculadas sobre o valor com desconto.
  - **G:** fica com a Navalha no tardio e no no-show; a barbearia nunca vê G nesses casos.
  - **Fidelidade:** serviço grátis sem taxa; no-show consome o prêmio.
  - **Propriedade (fast-check):** para qualquer valor, retenção e plano, as partes somam o valor pago e nenhuma é negativa.
  - **Máquina de estados:** toda transição não listada é rejeitada.
  - **Janelas do cartão:** agendamento com menos e com mais de 72h; falha + 12h → Liberado.
  - **Disponibilidade:** intervalo, folga parcial, pausa, fim do expediente, serviços que nenhum barbeiro faz junto.
- **Dependências:** fase 0. **Bloqueios externos:** nenhum (G entra como parâmetro).

## Fase 2 · Banco, Auth e RLS

- **Objetivo:** schema, autenticação por papel e isolamento entre barbearias. Perfis afetados: todos.
- **Regras:** `regras-de-negocio` §Visão geral e glossário; `mapa.md` §2.
- **Telas:** nenhuma.
- **Tarefas:**
  1. Migrations de barbearias, assinaturas, membros, convites, clientes, servicos, servico_barbeiro, horarios, bloqueios.
  2. Migrations de agendamentos, agendamento_servicos, pagamentos, lancamentos, taxas_a_transferir, lotes_semanais, saques, creditos_cliente, webhook_eventos.
  3. Migrations de configuração: politicas_cancelamento, fidelidade, promocoes e cupom_usos.
  4. RLS em todas as tabelas, mais a função `barbearias_do_usuario()`.
  5. Auth: e-mail com código (Figma: "acesso seguro por código"), convite de barbeiro, sign-in anônimo para o cadastro leve.
  6. Seed padronizado da Barbearia do Zé, com um endereço, um dono e preços e receitas coerentes (backlog **Todas as áreas · [regra] dados mockados**).
- **Testes:**
  - pgTAP: usuário da barbearia A não lê nem escreve nada da barbearia B, em todas as tabelas.
  - pgTAP: barbeiro não vê dados financeiros da barbearia (`regras-de-negocio` §glossário: barbeiro não recebe nem saca).
  - pgTAP: cliente só vê os próprios agendamentos; usuário anônimo só vê o cliente dele.
  - Vitest: as mesmas checagens via cliente Supabase com JWT de cada papel.
- **Dependências:** fases 0 e 1. **Bloqueios externos:** nenhum.

## Fase 3 · Pagamentos (Asaas sandbox)

- **Objetivo:** tudo que fala com o Asaas, atrás do `PaymentProvider`. Perfis afetados: dono e cliente.
- **Regras:**
  - `regras-de-negocio` §Implementação no Asaas.
  - `ajustes-taxas` §Subconta (criada só na ativação) e §Transferência (taxa por Pix).
  - `cartao-pre-autorizado` §Cartão.
- **Telas:** nenhuma ainda.
- **Tarefas:**
  1. Interface `PaymentProvider` e `FakePaymentProvider`.
  2. Criar subconta e habilitar Escrow (chamado só em "Ativar recebimentos").
  3. Cobrança Pix (QR Code, copia e cola, expiração).
  4. Cartão: tokenização, pré-autorização, captura, cancelamento da pré-autorização.
  5. Estorno total e parcial; liberação do Escrow.
  6. Pix enviado da subconta para a chave da Navalha (lote semanal).
  7. Assinatura Basic/Pro na conta principal, com trial de 14 dias.
  8. Route handler de webhooks: valida o token, grava em `webhook_eventos`, publica o evento no Inngest.
- **Testes:**
  - Contrato: o `FakePaymentProvider` e o `AsaasProvider` passam pela mesma suíte de testes.
  - Integração no sandbox: Pix pago, cartão pré-autorizado e capturado, estorno parcial de valor retido, transferência.
  - Webhooks com payloads gravados: token inválido devolve 401; evento repetido é processado uma vez só; eventos fora de ordem.
- **Dependências:** fases 1 e 2. **Bloqueios externos:** conta sandbox; respostas do suporte sobre Escrow, estorno parcial, custo da pré-autorização, prazo estendido para o MCC de barbearia e tarifas da subconta.

## Fase 4 · Jobs e liquidação (Inngest)

- **Objetivo:** executar no tempo certo tudo que o `core` calcula. Perfis afetados: todos.
- **Regras:**
  - `cartao-pre-autorizado` §Cartão, §Fluxo do cartão e §Transferência.
  - `regras-de-negocio` §Ações do backend por evento.
  - `ajustes-taxas` §Transferência.
- **Telas:** nenhuma.
- **Tarefas:**
  1. Função `agendamento.criado`: decide entre pré-autorizar agora ou dormir até a janela de 72h; captura no fim do prazo grátis. Tem `cancelOn: agendamento.cancelado`.
  2. Fluxo de falha: notifica e espera 12h por `pagamento.regularizado`; sem regularização, vira Liberado.
  3. Liquidação por evento final: concluído, cancelamentos, no-show. Uma ação por cenário, com estorno confirmado só em `DONE`.
  4. Marcação de no-show ao fim da tolerância.
  5. Cron do lote semanal da taxa por barbearia.
  6. Lembrete 1h antes, expiração do Pix (mais 10 min de reserva), expiração de convite, início e fim de promoção, fim do trial.
- **Testes:**
  - Integração com o dev server do Inngest e o `FakePaymentProvider`, com relógio controlado.
  - Cancelar dentro do prazo cancela a captura agendada.
  - Liquidação idempotente: evento duplicado não estorna duas vezes.
  - Lote semanal: uma transferência por barbearia, e o disponível desconta as taxas pendentes.
- **Dependências:** fases 1 e 3. **Bloqueios externos:** nenhum.

## Fase 5 · API e notificações

- **Objetivo:** route handlers do Next.js usados pelo app, pelo painel e pela página pública. Perfis afetados: todos.
- **Regras:** todas as anteriores, mais `regras-de-negocio` §Outras regras.
- **Telas:** nenhuma.
- **Tarefas:**
  1. Disponibilidade e criação do agendamento (instantâneo), com o pagamento.
  2. Cancelar (cliente ou barbearia), remarcar, iniciar e concluir atendimento, no-show.
  3. Cupom: validar e aplicar. Crédito do cliente: usar no checkout.
  4. Carteira: saldo retido, a receber, disponível; saque.
  5. Interface `Notifier`: push (Expo) e e-mail (Resend). Os templates cobrem confirmação, lembrete, falha da pré-autorização, cancelamento, remarcação e convite.
  6. Gerar o link `wa.me` com mensagem pronta para o Admin.
- **Testes:**
  - Vitest da API com Supabase local e `FakePaymentProvider`: o fluxo inteiro, do agendamento à liquidação, para Pix e cartão.
  - Isolamento: cada endpoint chamado com o JWT de outra barbearia devolve 403 ou 404.
- **Dependências:** fases 2 e 4. **Bloqueios externos:** domínio de e-mail verificado.

---

## Fase 6a · Acessos, cadastro e onboarding

- **Objetivo:** criar a conta e configurar a barbearia. Perfis afetados: dono, barbeiro e cliente.
- **Regras:**
  - `regras-de-negocio` §Planos e monetização: o card Free mostra "8% por atendimento".
  - `ajustes-taxas` §Subconta: o cadastro não cria subconta.
- **Telas:**
  - **Estáveis:** Login 01; Senha 01–05; Cadastro 01, 02, 04, 05; Onboarding 01–04; Mobile 01–08; Mobile Senha; Convite 01–04; Permissões.
  - **Pendente:** Cadastro 03 (backlog **Acessos · Cadastro 03 · [regra]**; conflito 1 do `mapa.md` §7).
- **Tarefas:**
  1. Componentes base do design system web e mobile, com botão principal preenchido e desabilitado de baixo contraste (backlog **Cliente · Todas as telas** e **Admin · Todas as telas**).
  2. Login e esqueci a senha (web e app).
  3. Cadastro do dono em 4 passos, com assinatura no Asaas.
  4. Onboarding: equipe (convite), serviços, horários.
  5. Convite do barbeiro no app: criar acesso, expirado.
  6. Cadastro do cliente no app e permissões.
- **Testes:**
  - E2E Playwright: cadastro Free e Basic com trial.
  - E2E Maestro: convite → acesso criado; criar conta de cliente.
- **Critério de pronto:** o geral, mais `cognitive-walkthrough` no cadastro e no convite.
- **Dependências:** fase 5. **Bloqueios externos:** nenhum.

## Fase 6b · App do barbeiro · partes estáveis

- **Objetivo:** o barbeiro gerencia agenda e disponibilidade. Perfil afetado: barbeiro.
- **Regras:** agendamento instantâneo; não há Solicitações nem Pendentes (backlog **Barbeiro · 06/06b/06c · 02b/03b · 07b · [regra]**: essas telas não serão construídas).
- **Telas (estáveis):** Barbeiro 02, 02d, 03, 03c, 03d, 04b, 05, 05b, 08, 08b, 09, 09b, 10, 10b, 11, 11b.
- **Tarefas:**
  1. Navegação por papel no app.
  2. Início (hoje) e agenda.
  3. Disponibilidade, folgas e pausar agenda.
  4. Perfil profissional, meus serviços e configurações.
- **Testes:** E2E Maestro: criar folga, conferir que o horário some para o cliente; pausar agenda.
- **Dependências:** fase 5. **Bloqueios externos:** nenhum.

## Fase 6c · Admin · barbeiros, serviços, dashboard

- **Objetivo:** gestão da equipe e do catálogo. Perfil afetado: dono.
- **Regras:** `regras-de-negocio` §Outras regras: a comissão é paga fora da Navalha.
- **Telas:** Admin 01, 03, 04–04c, 05–05d, mais o menu lateral.
- **Backlog aplicado aqui:**
  - **Admin · Todas as telas:** badges só para pendências; status × relógio; ajuda contextual.
  - **Admin · Menu lateral · [regra]:** sai "Solicitações".
  - **04:** texto neutro de gênero.
  - **05/05b:** um termo só; filtro de status com opção única.
- **Tarefas:**
  1. Shell do painel (menu, busca ⌘K, cabeçalho com relógio).
  2. Barbeiros e convite.
  3. Serviços: lista, filtros, novo, desativar.
  4. Dashboard.
- **Testes:**
  - E2E Playwright: convidar barbeiro e copiar o link; criar serviço e desativar com agendamentos futuros.
  - Isolamento: o painel da barbearia A não lista nada da B.
- **Dependências:** fase 5. **Bloqueios externos:** nenhum.

## Fase 6d · Cliente · descoberta, conta, histórico, avaliação

- **Objetivo:** encontrar a barbearia e acompanhar os agendamentos. Perfil afetado: cliente.
- **Regras:**
  - `regras-de-negocio` §Outras regras: cupom só na barbearia que o criou; fidelidade por barbearia.
  - `cartao-pre-autorizado` §Cartão: status Reservado, Confirmado e Liberado.
- **Telas:** Cliente 01, 02–02c, 13–13c, 14–14c, 16–16c, 17–18c, 19–19c, 20–20c.
- **Backlog aplicado aqui:**
  - **01 Home:** rótulo do "+"; [regra] fidelidade por barbearia.
  - **19 / 20 / 20b · [regra]:** cupom só na barbearia que o criou.
  - **Conferir 13, 14 e 19:** status Reservado e Liberado, e notificação de falha na pré-autorização.
- **Tarefas:**
  1. Home e busca.
  2. Agendamentos: lista e detalhe, com os status do cartão.
  3. Avaliar.
  4. Perfil, notificações e promoções.
- **Testes:** E2E Maestro: buscar → abrir barbearia; avaliar um atendimento concluído.
- **Critério de pronto:** o geral, mais `cognitive-walkthrough` em 13–14, que fazem parte da próxima auditoria pedida.
- **Dependências:** fase 5. **Bloqueios externos:** nenhum.

---

## Fase 7a · Cliente · fluxo de agendamento e checkout

- **Objetivo:** agendar e pagar. Perfil afetado: cliente.
- **Regras:**
  - `cartao-pre-autorizado` §Cartão e §Fluxo do cartão.
  - `regras-de-negocio` §Política de cancelamento, §Outras regras e §Decisões (cancelamento no prazo: cartão ou Pix).
  - `CLAUDE.md`: sem parcelamento.
- **Telas (pendentes):** Cliente 03–03e, 07–07d, 08–08c, 09–09c, 10, 10b, 10c, 11–11c, 12, 12b, 15–15d, mais as telas novas de falha da pré-autorização e Liberado.
- **Backlog aplicado aqui:**
  - **03:** rótulo único e manter seleção.
  - **07:** combo mais barato, duplicados, incompatibilidade antecipada, confirmar troca de barbearia.
  - **08c** e **09/09b/09c:** todos os itens.
  - **10:** política dinâmica visível; [regra] campo de cupom; "Editar".
  - **10b:** sem 3x; "Reservar com cartão" + data de cobrança; titular e CPF.
  - **10c:** [regra] valores dinâmicos; cartão × Pix no cancelamento.
  - **12:** variação Reservado.
  - **15/15b · [regra]:** valores dinâmicos.
  - **Telas novas:** falha na pré-autorização e Liberado.
- **Tarefas:**
  1. Passo 1 (serviços) com regra de combo.
  2. Passo 2 (barbeiro).
  3. Passo 3 (data e hora) com disponibilidade real.
  4. Checkout Pix e tela de Pix.
  5. Checkout cartão (Reservado ou Confirmado).
  6. Sucesso e calendário.
  7. Falha na pré-autorização e regularização em 12h.
  8. Cancelar com política dinâmica e escolha entre crédito ou reembolso no Pix.
- **Testes:**
  - E2E Maestro: agendar com Pix até Confirmado; agendar com cartão a mais de 72h (Reservado); simular falha → trocar cartão; cancelar no prazo com Pix escolhendo crédito.
  - Integração no sandbox: o mesmo caminho do Pix.
- **Critério de pronto:** o geral, mais `cognitive-walkthrough` do fluxo inteiro (reproduz o walkthrough de 22/10) e `ux-audit-rethink` no fim da fase.
- **Dependências:** fases 4 e 6d. **Bloqueios externos:** backlog do Figma; caminho PCI do cartão.

## Fase 7b · Página web pública + cadastro leve

- **Objetivo:** agendar pelo navegador em `navalha.app/<slug>`, sem baixar o app. Perfil afetado: cliente.
- **Regras:** as mesmas de 7a; o checkout pede só nome, celular e e-mail.
- **Telas:** versão responsiva das Cliente 03 e 07–12. Não há tela própria no Figma.
- **Tarefas:**
  1. Página da barbearia (SSR, SEO, link do Perfil "Ver página pública").
  2. Fluxo de agendamento web reaproveitando o `core`.
  3. Cadastro leve com sign-in anônimo e verificação de e-mail.
  4. Link universal que abre o app quando instalado.
- **Testes:**
  - E2E Playwright: agendar com Pix no navegador, sem conta prévia, com `@axe-core/playwright`.
  - Isolamento: o usuário anônimo só vê o próprio agendamento.
- **Dependências:** fase 7a. **Bloqueios externos:** backlog do Figma.

## Fase 7c · Admin · agenda, cancelar, no-show, ações de barbeiro

- **Objetivo:** operar a agenda do dia. Perfil afetado: dono.
- **Regras:**
  - `regras-de-negocio` §Cenários de liquidação (barbearia cancela; no-show) e §Política de cancelamento.
  - `CLAUDE.md`: sem Pendente; no-show é evento próprio.
- **Telas (pendentes):** Admin 02, 02b, 02c, 02d–02h, 02i, 02j, 02k, 03c, mais a ação nova de No-show.
- **Backlog aplicado aqui:**
  - **02/02c:** legenda e status, separação por barbeiro, cards completos, grade até o fechamento, cancelado libera o espaço.
  - **02b:** linha de pagamento.
  - **02g:** remover Pendente.
  - **02j:** [regra] custo do estorno com valores; tirar "não compareceu".
  - **No-show.**
  - **03c:** confirmar remover e pausar barbeiro.
- **Tarefas:**
  1. Agenda semana e dia, por barbeiro.
  2. Novo agendamento pelo balcão.
  3. Remarcar.
  4. Cancelar com impacto financeiro e `wa.me`.
  5. Ação de no-show.
  6. Remover e pausar barbeiro com os agendamentos afetados.
- **Testes:**
  - E2E Playwright: cancelar pela barbearia, conferindo o valor do estorno exibido e o lançamento gerado; marcar no-show, conferindo a divisão 80/20 no extrato.
  - Integração: o estorno parcial chega ao sandbox.
- **Dependências:** fases 4 e 6c. **Bloqueios externos:** backlog do Figma.

## Fase 7d · Admin · Ativar recebimentos, Financeiro, Configurações, Perfil

- **Objetivo:** dinheiro e regras da barbearia. Perfil afetado: dono.
- **Regras:**
  - `ajustes-taxas` §Subconta.
  - `cartao-pre-autorizado` §Transferência (disponível e saque).
  - `regras-de-negocio` §Política de cancelamento ("Você recebe 80% do valor retido") e §Decisões (saque mínimo de R$ 50).
- **Telas:** novas (Ativar recebimentos, Financeiro, Configurações); pendentes (Admin 09–09d).
- **Backlog aplicado aqui:**
  - **Ativar recebimentos.**
  - **Financeiro:** [regra] e disponível/saque.
  - **Configurações · [regra].**
  - **09:** confirmar o interruptor, que depende da ativação; um jeito só de salvar.
- **Tarefas:**
  1. Ativar recebimentos: dados bancários, KYC, criação da subconta e do Escrow.
  2. Financeiro: retido, a receber, disponível, extrato com taxas, saque.
  3. Configurações: política de cancelamento e fidelidade.
  4. Perfil da barbearia com visibilidade e "Aceitar agendamentos online".
- **Testes:**
  - E2E Playwright: sem ativação, a barbearia não recebe agendamento pago; ativar → aceitar.
  - Unit (já na fase 1) mais E2E: o disponível desconta as taxas a transferir; saque abaixo de R$ 50 é recusado.
  - Integração: criação de subconta no sandbox.
- **Dependências:** fases 3, 4 e 6c. **Bloqueios externos:** backlog do Figma; CNPJ aprovado para ativar em produção.

## Fase 7e · Admin · relatórios e promoções

- **Objetivo:** produção da equipe e cupons. Perfil afetado: dono.
- **Regras:** `regras-de-negocio` §Outras regras: comissão fora da Navalha; cupom por barbearia, com desconto saindo do valor da barbearia.
- **Telas (pendentes):** Admin 06, 07, 07b, 08–08d.
- **Backlog aplicado aqui:**
  - **07:** dias válidos.
  - **07b:** status da promoção agendada; aviso que corta o texto.
  - **08:** remover comissão; valores financeiros no Financeiro.
  - **08b:** todos os serviços no filtro; um "Limpar" só.
- **Tarefas:**
  1. Promoções: cupom e oferta automática, prévia ao vivo, agendamento.
  2. Relatórios de produção por barbeiro e serviço; exportar CSV.
- **Testes:**
  - E2E Playwright: criar cupom de fim de semana e conferir que ele não vale numa terça.
  - Unit: cupom com limite de usos e um uso por cliente.
- **Dependências:** fase 6c. **Bloqueios externos:** backlog do Figma.

## Fase 7f · App do barbeiro · Meus ganhos, detalhe, notificações

- **Objetivo:** fechar o app do barbeiro conforme a regra nova. Perfil afetado: barbeiro.
- **Regras:** `regras-de-negocio` §Telas que mudam (barbeiro não recebe nem saca).
- **Telas (pendentes):** Barbeiro 02c, 04, 07, 07c–07e, 12.
- **Backlog aplicado aqui:** **Barbeiro · 02c/04, 07 a 07e, 12 · [regra]**.
- **Tarefas:**
  1. "Meus ganhos" (produção do período).
  2. Detalhe com iniciar e concluir atendimento, sem repasse.
  3. Notificações sem "Pix recebido · retido".
- **Testes:** E2E Maestro: concluir atendimento → status Concluído e liquidação disparada (conferida no banco).
- **Dependências:** fase 6b. **Bloqueios externos:** backlog do Figma.

---

## Fase 8 · Lançamento

- **Objetivo:** ir para produção. Perfis afetados: todos.
- **Tarefas:**
  1. `security-review` em todo o código; revisão das policies de RLS e dos secrets (chaves das subcontas).
  2. Conta Asaas de produção, webhooks de produção e um teste com valor real baixo.
  3. Builds na loja via EAS; links universais em produção.
  4. Observabilidade: logs dos jobs, alertas de webhook falho e de liquidação travada.
- **Testes:** regressão completa (unit, pgTAP, integração no sandbox, E2E web e mobile) em ambiente de staging.
- **Dependências:** todas as fases. **Bloqueios externos:** CNPJ aprovado no Asaas; contas Apple e Google; Meta Business em andamento.

---

## Primeira sprint (10 dias), na ordem de execução

| # | Tarefa | Saída verificável | Dias |
|---|---|---|---|
| 1 | Scaffold do monorepo: `git init`, Turborepo + pnpm, TS strict, ESLint/Prettier, Vitest, `apps/web`, `apps/mobile`, `packages/core`, `packages/config`, mais CI no GitHub Actions rodando lint, typecheck e testes | CI verde com um teste trivial; CI vermelho quando o teste quebra | 1,5 |
| 2 | `core`: `Money` em centavos e tipos de domínio | Testes de soma, percentual e arredondamento | 0,5 |
| 3 | `core`: máquina de estados do agendamento | Testes de todas as transições válidas e inválidas | 1 |
| 4 | `core`: liquidação | Testes dos 5 cenários × plano × cupom × retenção, mais a propriedade de soma | 2 |
| 5 | `core`: política de cancelamento (prazo, retenção, tolerância, crédito ou reembolso no Pix) | Testes por cenário | 1 |
| 6 | `core`: janelas do cartão (72h, 12h, captura) | Testes com datas próximas e distantes | 0,5 |
| 7 | `core`: disponibilidade | Testes de intervalo, folga, pausa, duração, combinação de serviços | 1,5 |
| 8 | Supabase: CLI local, migration inicial (barbearias, membros, clientes, servicos, agendamentos), RLS e pgTAP de isolamento no CI | pgTAP verde no CI; acesso cruzado A × B bloqueado | 1,5 |
| 9 | `PaymentProvider` + `FakePaymentProvider` | Suíte de contrato verde contra o fake | 0,5 |

Antes da tarefa 1, preciso de duas confirmações: o nome do repositório no GitHub e o gerenciador de pacotes (o roadmap assume pnpm).
