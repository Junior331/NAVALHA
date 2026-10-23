# Navalha — Mapa do projeto

Oct 22, 2026 · gerado pelo Claude Code

Fontes:
- `CLAUDE.md` e os três docs de `docs/`. Em conflito vale a prioridade do `CLAUDE.md`: `ajustes-taxas` > `cartao-pre-autorizado` > `regras-de-negocio`.
- `docs/backlog-figma.md`.
- O Figma (`7WvnZeMowPQEKNLxnY4Z82`), páginas Acessos, Cliente, Barbeiro e Desktop Admin, lido pelo `get_metadata`.

⚠ = tela com item pendente no `backlog-figma.md`. **Nova** = tela que ainda não existe no Figma.

---

## 1. Features por perfil

### Cliente (app Expo)

| Feature | Telas do Figma | Estado |
|---|---|---|
| Entrada e intro | Mobile 01 Splash, 02–04 Intro | Estável |
| Login e cadastro | Mobile 05 Login cliente, 07–08 Criar conta (dados, verificar e-mail) | Estável |
| Esqueci a senha (código) | Mobile Senha 01–04, Conclusão 02 | Estável |
| Permissões | Permissão 01 Notificações, 02 Localização | Estável |
| Home | Cliente 01 | ⚠ fidelidade por barbearia; rótulo do "+" |
| Busca | Cliente 02, 02b filtros, 02c vazio | Estável |
| Barbearia | Cliente 03–03e (sobre, serviços, barbeiros, avaliações, horários) | ⚠ entradas do fluxo |
| Agendar · serviços | Cliente 07–07d | ⚠ |
| Agendar · barbeiro | Cliente 08–08c | ⚠ |
| Agendar · data e hora | Cliente 09–09c | ⚠ |
| Checkout | Cliente 10 Pix, 10b cartão, 10c política | ⚠ |
| Pagamento Pix | Cliente 11 aguardando, 11b confirmando, 11c expirado | Estável |
| Sucesso | Cliente 12, 12b calendário | ⚠ variação Reservado |
| Falha na pré-autorização / Liberado | **Nova** | ⚠ |
| Agendamentos | Cliente 13–13c, 14–14c detalhe | ⚠ conferir Reservado/Liberado |
| Cancelar | Cliente 15–15d | ⚠ valores dinâmicos |
| Avaliar | Cliente 16–16c | Estável |
| Perfil e conta | Cliente 17–18c | Estável |
| Notificações | Cliente 19–19c | ⚠ |
| Promoções e cupom | Cliente 20–20c | ⚠ cupom só na barbearia que criou |

### Barbeiro (app Expo, mesmo app, navegação por papel)

| Feature | Telas do Figma | Estado |
|---|---|---|
| Convite e criação de acesso | Convite 01–04, Conclusão 03 | Estável |
| Login barbeiro | Mobile 06 | Estável |
| Início | Barbeiro 02 hoje, 02d agenda pausada | Estável |
| Início · carteira → "Meus ganhos" | Barbeiro 02c | ⚠ [regra] |
| Agenda | Barbeiro 03 próximos, 03c concluídos, 03d cancelados | Estável |
| Detalhe do agendamento (iniciar e concluir atendimento) | Barbeiro 07, 07c–07e | ⚠ [regra] sai repasse e taxa |
| Ajustes | Barbeiro 04, 04b pausar agenda | ⚠ [regra] sai carteira e chave Pix |
| Perfil profissional | Barbeiro 05, 05b | Estável |
| Meus serviços | Barbeiro 08, 08b | Estável |
| Disponibilidade | Barbeiro 09, 09b | Estável |
| Folgas e bloqueios | Barbeiro 10, 10b | Estável |
| Configurações e sair | Barbeiro 11, 11b | Estável |
| Notificações | Barbeiro 12, 12b | ⚠ [regra] |
| Solicitações e pendentes | Barbeiro 02b, 03b, 06–06c, 07b | **Removidas** (agendamento instantâneo) |

### Dono (painel web Next.js)

| Feature | Telas do Figma | Estado |
|---|---|---|
| Login e esqueci a senha | Login 01, Senha 01–05 | Estável |
| Cadastro | Cadastro 01 conta, 02 barbearia, 03 plano, 04 pagamento da assinatura, 05 boas-vindas | ⚠ 03 Plano |
| Onboarding | Onboarding 01 equipe, 02 serviços, 03 horários, 04 pronto | Estável |
| Ativar recebimentos | **Nova** | ⚠ |
| Dashboard | Admin 01 | ⚠ status × relógio |
| Agenda | Admin 02, 02c dia, 02k filtros, 02b evento | ⚠ |
| Novo agendamento | Admin 02d–02h | ⚠ 02g |
| Remarcar e cancelar | Admin 02i, 02j | ⚠ 02j |
| No-show | **Nova** | ⚠ |
| Barbeiros e convite | Admin 03, 03c, 04–04c | ⚠ 03c, 04 |
| Serviços | Admin 05–05d | ⚠ 05, 05b |
| Promoções | Admin 06, 07, 07b | ⚠ 07, 07b |
| Relatórios | Admin 08–08d | ⚠ |
| Perfil da barbearia | Admin 09–09d | ⚠ |
| Financeiro / Carteira | **Nova** | ⚠ [regra] |
| Configurações (política de cancelamento, fidelidade) | **Nova** | ⚠ [regra] |
| Clientes | Item no menu, sem tela | Sem design |
| Menu lateral | Todas as telas | ⚠ sai "Solicitações" |

O dono que também atende usa um login só, no painel web e no app de barbeiro (`regras-de-negocio` §Decisões).

### Página web pública (`navalha.app/<slug>`, Next.js)

| Feature | Base de design | Estado |
|---|---|---|
| Página da barbearia | Versão responsiva da Cliente 03 | Sem tela própria; herda ⚠ da 03 |
| Agendamento e checkout | Versão responsiva da Cliente 07–12 | Herda ⚠ do fluxo |
| Cadastro leve | Nome, celular e e-mail. Não obriga a baixar o app | **Nova** |

---

## 2. Entidades do banco (Supabase Postgres)

Toda tabela de dados de uma barbearia tem `barbearia_id` e RLS. Os valores em dinheiro são `bigint` em centavos.

| Grupo | Tabela | Campos e regras principais |
|---|---|---|
| Barbearia | `barbearias` | Nome, slug, endereço, contatos, capa, logo, `aparecer_nas_buscas`, `aceitar_agendamentos_online` |
| | `assinaturas` | Plano Free, Basic ou Pro; ciclo mensal ou anual; trial de 14 dias; id da assinatura no Asaas (conta principal) |
| | `subcontas_asaas` | `walletId` e chave de API (em secret, nunca em texto puro); status de KYC; Escrow habilitado; `ativada_em`. Criada só em "Ativar recebimentos" (`ajustes-taxas` §Subconta) |
| Pessoas | `usuarios` | Supabase Auth, incluindo usuário anônimo do cadastro leve |
| | `membros` | `usuario_id`, `barbearia_id`, papel (dono ou barbeiro), status (ativo, de folga, removido) |
| | `convites` | Token, serviços, papel, expira em 7 dias, uso único |
| | `clientes` | Nome, celular, e-mail, `usuario_id`; origem app ou web |
| Catálogo | `servicos` | Categoria, duração, preço, desconto, ativo |
| | `servico_barbeiro` | Quem realiza cada serviço |
| Disponibilidade | `horarios_atendimento` | Por barbeiro e dia da semana, com intervalo |
| | `bloqueios` | Folga de dia inteiro ou parcial, motivo; pausa de agenda |
| Agendamento | `agendamentos` | Cliente, barbeiro, início, fim, status, código (NV-xxxx), `prazo_gratis_ate`, `tolerancia_ate`, cupom, valor pago |
| | `agendamento_servicos` | Serviço, preço e duração congelados no momento do agendamento |
| Dinheiro | `pagamentos` | Meio (Pix ou cartão), status, ids do Asaas, `creditCardToken`, id da pré-autorização, `pre_autorizar_em`, `capturar_em` |
| | `lancamentos` | Extrato por evento de dinheiro: tipo, valor, parte do cliente, da barbearia e da Navalha, G |
| | `taxas_a_transferir` | Taxa da Navalha acumulada até o lote |
| | `lotes_semanais` | Um registro por barbearia por semana (`ajustes-taxas` §Transferência) |
| | `saques` | Mínimo de R$ 50 sobre o disponível |
| | `creditos_cliente` | Crédito de 100% na barbearia (Pix cancelado no prazo) |
| Configuração | `politicas_cancelamento` | Prazo grátis, % retido (0–100), tolerância de atraso |
| | `fidelidade_config`, `fidelidade_progresso` | Liga/desliga, número de cortes, serviço grátis |
| Promoções | `promocoes` | Cupom com código ou oferta automática; desconto em % ou R$; serviços abrangidos; dias válidos; início e fim; limite de usos; um uso por cliente |
| | `cupom_usos` | Uso por agendamento |
| Outros | `avaliacoes`, `favoritos`, `notificacoes`, `dispositivos_push` | |
| | `webhook_eventos` | Id do evento do Asaas com `unique`, para idempotência |

---

## 3. Estados do agendamento

Não existe Pendente: o agendamento é instantâneo (`CLAUDE.md`; `regras-de-negocio` §Outras regras).

| Status | Quando |
|---|---|
| Reservado | Cartão tokenizado e pré-autorização ainda não criada ou pendente (`cartao-pre-autorizado` §Cartão) |
| Confirmado | Pix pago ou pré-autorização aprovada |
| Em atendimento | Barbeiro tocou em "Iniciar atendimento" |
| Concluído | Barbeiro tocou em "Concluir atendimento". Dispara a liquidação |
| Cancelado no prazo | Cliente cancelou antes do fim do prazo grátis |
| Cancelado fora do prazo | Cliente cancelou depois do prazo grátis |
| Cancelado pela barbearia | Dono ou barbeiro cancelou |
| No-show | Evento próprio, separado de cancelamento (`CLAUDE.md`). Passou da tolerância de atraso |
| Liberado | Pré-autorização falhou e o cliente não regularizou em 12h. Ninguém paga |

```
Reservado ──pré-autorização aprovada──▶ Confirmado ──iniciar──▶ Em atendimento ──concluir──▶ Concluído
   │  └─falhou + 12h sem regularizar──▶ Liberado              │
   └─cancelou──▶ Cancelado no prazo                            ├─▶ Cancelado no prazo / fora do prazo
Pix pago ──────────────────────────────▶ Confirmado            ├─▶ Cancelado pela barbearia
                                                               └─▶ No-show
```

O pagamento tem estados próprios: `tokenizado`, `pre_autorizado`, `capturado`, `pix_pago`, `retido`, `liberado`, `estornado_parcial`, `estornado`.

---

## 4. Eventos de dinheiro

| Evento | Origem | Efeito |
|---|---|---|
| Pix recebido | Webhook `PAYMENT_RECEIVED` | Confirmado; valor retido no Escrow |
| Cartão tokenizado | Checkout | Reservado (se faltarem mais de 72h para o fim do prazo grátis) |
| Pré-autorização criada, aprovada ou falhou | Job ou checkout; webhook `PAYMENT_CONFIRMED` | Confirmado, ou fluxo de 12h |
| Captura | Job no fim do prazo grátis | Valor retido |
| Liquidação | Evento final | Uma ação só por cenário (`regras-de-negocio` §Cenários de liquidação) |
| Estorno total ou parcial | Liquidação | Confirmado por `PAYMENT_REFUNDED` com status `DONE` |
| Liberação do Escrow | Liquidação | Valor da barbearia disponível (cartão: "a receber" até o Asaas liquidar, 32 dias) |
| Crédito ao cliente | Cancelamento no prazo via Pix, se o cliente escolher crédito | `creditos_cliente` |
| Acúmulo da taxa | Liquidação no plano Free (8% do bruto) ou cancelamento tardio/no-show (20% do retido − G) | `taxas_a_transferir` |
| Lote semanal | Job | Pix da subconta para a chave da Navalha (`ajustes-taxas` §Transferência) |
| Saque | Dono | Mínimo de R$ 50 sobre o disponível (disponível = saldo − taxas a transferir) |
| Assinatura | Cadastro 04 | Cobrança recorrente Basic/Pro na conta principal da Navalha |

---

## 5. Integrações externas

| Integração | Uso | Observação |
|---|---|---|
| Asaas | Subconta e Escrow, Pix, tokenização, pré-autorização e captura de cartão, estornos, Pix enviado, assinaturas, webhooks | Sempre atrás da interface `PaymentProvider`. Sandbox em dev e CI |
| Supabase | Auth (e-mail com código, anônimo para o cadastro leve), Postgres com RLS, Storage (capa e logo) | |
| Inngest | Tarefas agendadas e orientadas a evento | Justificativa no roadmap |
| Expo Notifications | Push para cliente e barbeiro | |
| E-mail transacional (Resend) | Fallback das notificações e cadastro leve | Atrás da interface `Notifier` |
| Links universais / App Links | Abrir convite, agendamento e página da barbearia no app | |
| WhatsApp | MVP: só o botão `wa.me` manual no Admin (cancelamento e remarcação). API oficial depois do lançamento, atrás do `Notifier` | Conta Meta Business é bloqueio externo, aberta em paralelo |
| Calendários | Google, Apple, Outlook e `.ics` (Cliente 12b) | Só links e arquivo; sem API |

---

## 6. Tarefas agendadas

| Tarefa | Quando | Regra |
|---|---|---|
| Criar a pré-autorização | Quando o agendamento entra na janela de 72h antes do fim do prazo grátis | `cartao-pre-autorizado` §Cartão |
| Prazo de regularização | 12h depois da falha → Liberado | idem |
| Captura do cartão | No fim do prazo grátis | idem |
| Expiração do Pix | Expira o código; mantém o horário por mais 10 min (Cliente 11c) | Figma |
| Lembrete | 1h antes do horário | Figma (Cliente 12) |
| Marcar no-show | Ao fim da tolerância de atraso, se o atendimento não foi iniciado | `regras-de-negocio` §Política de cancelamento |
| Lote semanal da taxa | Uma vez por semana, por barbearia | `ajustes-taxas` §Transferência |
| Expiração de convite | 7 dias | Figma (Admin 04b) |
| Promoção agendada | Início e fim | Figma (Admin 07b) |
| Fim do trial | 14 dias depois do cadastro Basic/Pro | Figma (Cadastro 03/04) |

---

## 7. Conflitos encontrados (Figma × docs)

Os docs valem. Estes pontos ainda não estão no `backlog-figma.md`:

1. **Cadastro 03 · Plano:** o Basic anuncia "Pix e cartão no pagamento", o que sugere que o Free não tem pagamento online. Pelos docs, todos os planos têm (`regras-de-negocio` §Planos).
2. **Barbeiro 07c:** mostra "Taxa Navalha · 8%" e "Você recebe". A regra manda tirar o repasse e a taxa do detalhe do barbeiro (já coberto pelo item [regra] de 07–07e).
3. **Onboarding 02:** os preços (Corte + barba a R$ 70, 50 min) divergem do resto do arquivo (já coberto pelo item [regra] de dados mockados).
4. **Subconta:** `regras-de-negocio` §Implementação cria a subconta no Cadastro, mas `ajustes-taxas` §Subconta manda criar só em "Ativar recebimentos". Vale `ajustes-taxas`.
5. **Plano Free com 1 barbeiro e cupons só no Pro** (Cadastro 03): os docs não falam de limites por plano. Fica valendo o Figma, até haver doc dizendo o contrário.
