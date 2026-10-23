Antes de escrever qualquer código, quero que você mapeie o projeto Navalha inteiro e monte o roadmap de desenvolvimento e testes. Não implemente nada nesta etapa: o entregável é só o plano, e eu aprovo antes de você começar.

## 1. Skills

Liste as skills disponíveis (as de `.claude/skills/` e as que vierem de plugins) e leia o SKILL.md de cada uma antes de planejar. As de UX instaladas são `cognitive-walkthrough`, `nielsen-heuristics-audit`, `ui-design-review` e `ux-audit-rethink`: use-as como critério de aceite das telas, a rodar quando cada tela ficar pronta.

Para arquitetura, banco, pagamentos, segurança e testes não há skill instalada. Nessas decisões, siga as boas práticas atuais de Expo, Next.js, Supabase e da API do Asaas, e registre no roadmap a justificativa de cada escolha. Se alguma skill disponível cobrir um desses temas, use-a e cite qual.

## 2. Mapeamento

Leia, nesta ordem:

1. `CLAUDE.md` e os três docs de `docs/` (ajustes-taxas, cartao-pre-autorizado, regras-de-negocio). Em conflito, vale a ordem de prioridade do CLAUDE.md.
2. `docs/backlog-figma.md`, para saber quais telas ainda vão mudar.
3. O Figma (https://www.figma.com/design/7WvnZeMowPQEKNLxnY4Z82), páginas Acessos, Cliente, Barbeiro e Desktop Admin. O plano Starter do Figma MCP tem limite mensal baixo: use `get_metadata` (estrutura e textos) em vez de screenshot sempre que possível. Se o limite estourar, siga pelo Chrome.

Produza `docs/mapa.md` com: lista de features por perfil (cliente, barbeiro, dono, página web pública), entidades do banco, estados do agendamento, eventos de dinheiro, integrações externas e tarefas agendadas.

## 3. Stack (já decidida)

- Monorepo Turborepo, tudo em TypeScript.
- `apps/mobile`: Expo (React Native), um app só para cliente e barbeiro, navegação por papel.
- `apps/web`: Next.js, com o painel do dono, a página pública de agendamento (`navalha.app/<slug>`) e os route handlers da API e dos webhooks do Asaas.
- `packages/core`: regras de negócio puras (máquina de estados, cálculo de taxa, retenção 80/20, disponibilidade), sem dependência de framework.
- Supabase (Postgres + Auth + RLS por `barbearia_id`).
- Trigger.dev ou Inngest para as tarefas agendadas (pré-autorização na janela de 72h, prazo de 12h, captura, lote semanal da taxa). Recomende um dos dois com justificativa.
- Expo Notifications, links universais, Asaas em sandbox atrás de uma interface `PaymentProvider`.

## 4. Roadmap

Crie `docs/roadmap.md` em fases. Regra de ordem: primeiro o que não depende de tela que vai mudar (ver backlog-figma), por último as telas que ainda estão em ajuste no Figma.

Para cada feature, registre:

- **Objetivo** e perfil afetado.
- **Regras de negócio** aplicáveis, com referência ao doc e à seção.
- **Telas** do Figma envolvidas e se estão estáveis ou pendentes no backlog.
- **Tarefas** de implementação, pequenas o bastante para um PR cada.
- **Testes:**
  - unitários em `packages/core` para toda regra de dinheiro e de estado (todos os cenários da tabela de liquidação, incluindo cupom, retenção de 0% a 100% e plano Free x pago);
  - integração com o sandbox do Asaas e com os webhooks;
  - teste de isolamento entre barbearias (RLS);
  - E2E com Playwright no web e com a ferramenta que a skill de mobile recomendar no app.
- **Critério de pronto:** testes passando, revisão de UX com as skills de UX nas telas novas, e o item correspondente do backlog-figma marcado.
- **Dependências** de outras features e **bloqueios externos** (conta Asaas com CNPJ aprovado, respostas do suporte).

Inclua no topo do roadmap uma tabela-resumo com fase, feature, depende de, bloqueio externo e estimativa em dias.

## 5. Primeira sprint

No fim do roadmap, detalhe as tarefas da primeira sprint, já na ordem em que vai executá-las. A primeira tarefa deve ser o scaffold do monorepo com CI rodando os testes.

Quando terminar, me mostre um resumo e espere minha aprovação antes de escrever código.
