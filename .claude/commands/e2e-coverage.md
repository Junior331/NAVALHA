FASE 1 — Cobertura E2E (Playwright). Trabalhe em DUAS etapas com gate de
aprovação entre elas. NÃO implemente nada na Etapa A.

## Etapa A — Discovery (READ-ONLY, não altere nada)

Pré-condição: a Fase 0 (harness) já está aplicada — porta dedicada, storageState,
override de MSW no window. Se NÃO estiver, PARE e reporte; não escreva specs sobre
um harness quebrado.

1. Mapeie as FEATURES do produto e, pra cada uma, os FLUXOS de usuário (sequência
   ponta a ponta). Baseie-se em src/pages (rotas), src/modules e nos handlers do
   MSW (tests/mocks/api/handlers) pra saber o que já é mockável.
2. Classifique a criticidade de cada fluxo:
   - P0: jornada crítica — quebrar bloqueia o core ou perde receita
     (ex.: auth, criar assistente, conversar com assistente).
   - P1: importante e muito usado, mas com workaround.
   - P2: secundário / raro / cosmético.
3. Decida E2E vs Vitest por fluxo, pela regra de escopo (jornada atravessando
   telas + rede = E2E; lógica/validação/estado de componente = Vitest).
4. Marque o STATUS atual: coberto / spec existe mas quebrado / sem cobertura.
5. Entregue uma MATRIZ (tabela): Feature | Fluxo | Criticidade | E2E ou Vitest |
   Status | handler MSW existe? | observações.
6. Proponha um PLANO só dos P0/P1 marcados como E2E e SEM cobertura, agrupados em
   lotes pequenos (1 fluxo por spec), em ordem de prioridade. Pra cada item,
   estime o que falta (fixture, handler ausente, etc.).

PARE aqui. Aguarde minha aprovação do plano e da priorização antes da Etapa B.

## Etapa B — Implementação (só após aprovação)

Implemente UM fluxo por vez, um spec por fluxo, seguindo as Convenções abaixo.
Commit atômico conventional por fluxo. Rode `pnpm test:e2e <arquivo>` e mostre o
resultado verde antes de seguir pro próximo.

Convenções obrigatórias:
- Auth via storageState (project 'setup'); nunca repita o goto de /auth nos specs.
- Seletores por getByRole / getByLabel / getByText (Genesis + Radix são
  acessíveis); proibido CSS / data-testid frágil salvo último recurso justificado.
- Radix Select: getByRole('combobox').click() -> getByRole('option',{name}).click();
  nunca selectOption.
- Radix Dialog: getByRole('dialog') pra escopar o modal.
- Erro/vazio: window.worker.use(...) via page.evaluate; nunca page.route em modo
  test.
- Confira o path EXATO do endpoint no handler antes de mockar; respostas de
  sessions/assistants vêm em { success, data, location, errors }.
- Fixtures em tests/e2e/fixtures/ (crie se faltar).
- Um fluxo por arquivo, <feature>.spec.ts; 1 happy path + 1-2 estados visíveis ao
  usuário; não enumere branches (isso é Vitest).
- toHaveURL pra navegação; role/text estável pra conteúdo.

## Convenções técnicas (referência completa — seção 3 da política em CLAUDE.md)

- Auth: via `storageState` (project setup). NUNCA repita `page.goto('/auth?code=...')`
  dentro dos specs de feature.
- Seletores: `getByRole` / `getByLabel` / `getByText`. Genesis e Radix expõem
  acessibilidade — use isso. Proibido seletor CSS ou `data-testid` frágil, salvo
  último recurso justificado no próprio teste.
- Radix Select: `getByRole('combobox').click()` → `getByRole('option', { name }).click()`.
  NUNCA `selectOption` (não é `<select>` nativo).
- Radix Dialog: `getByRole('dialog')` pra escopar as interações do modal.
- Estados de erro/vazio: sobrescreva o handler MSW em runtime —
  `page.evaluate(() => window.worker.use(window.http.<method>('<url>', () => window.HttpResponse.json(envelope, { status }))))`.
  NUNCA `page.route` em modo test (o MSW intercepta antes da rede; `page.route`
  não dispara).
- Endpoints reais: confira o path exato no handler correspondente antes de
  mockar. Ex.: criar assistente é `POST {V1}/virtualAssistants/createVirtualAssistant`,
  não `/assistants`. Sessions/assistants vêm envelopados em
  `{ success, data, location, errors }`.
- Fixtures (uploads etc.): em `tests/e2e/fixtures/`. Crie o arquivo se faltar;
  referencie por path a partir da raiz do repo.
- Um fluxo por arquivo, nome `<feature>.spec.ts`.
- Asserts: navegação por `toHaveURL` da rota final; conteúdo por role/text
  estável, nunca por texto volátil.
