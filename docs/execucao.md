# Navalha — Execução do roadmap

Registro do que já foi feito em cada fase do `docs/roadmap.md`, do que ficou de fora e por quê.
Atualizado em 23/10/2026, com as fases 0 a 8 implementadas e o painel no visual das telas de referência.

## Feito

| Fase | Entrega | Testes |
|---|---|---|
| 0 | Monorepo Turborepo + pnpm, CI (formato, lint, typecheck, unit, pgTAP, integração, E2E) | CI |
| 1 | `packages/core`: Money, máquina de estados, liquidação, política, janelas do cartão, disponibilidade, cupom, oferta automática, combos, fidelidade, carteira, fuso | 122 unit |
| 2 | Schema completo com RLS, Auth (código por e-mail, anônimo), seed com 4 semanas de histórico, tipos gerados (`packages/db`) | 44 pgTAP |
| 3 | `packages/pagamentos`: PaymentProvider, fake, adaptador Asaas, webhooks, contrato (fake, servidor de mentira e sandbox) | 52 unit + sandbox (pulado sem chave) |
| 4 | `packages/servidor`: liquidação, cartão pré-autorizado, Pix, no-show, lembrete, lote semanal, webhook; funções do Inngest com versão do agendamento | 14 unit |
| 5 | Casos de uso e rotas da API, sessão do Supabase, canais de notificação (push + e-mail de fallback) | 100 integração (servidor) + 6 (API) |
| 6a | Cadastro do dono com código, onboarding (equipe, serviços, horários, recebimentos) | E2E cadastro → ativação |
| 6c | Painel: dashboard, barbeiros (convite, pausa, remoção), serviços | E2E |
| 7b | Página pública `/<slug>` (SSR, SEO), agendar no navegador com cadastro leve, Pix com QR e consulta automática, cartão "Reservar", tela de sucesso com o app | E2E Pix e cartão, axe |
| 7c | Agenda do painel: dia/semana por barbeiro, remarcar, balcão, cancelar e no-show com prévia, WhatsApp manual | E2E balcão → remarcar → cancelar, axe |
| 7d | Ativar recebimentos (subconta + Escrow + Vault), Financeiro (retido, a receber, disponível, extrato, saque ≥ R$ 50), Configurações (política, fidelidade), Perfil (imagens no Storage, visibilidade, divulgar com link e QR Code) | 11 integração + E2E saque e política |
| 7e | Promoções (cupom e oferta automática, dias válidos, agendada), Relatórios (produção sem comissão, filtros, CSV) | E2E cupom de fim de semana numa terça |
| 6b, 6d, 7a, 7f | App Expo: acessos, cliente (início, busca, barbearia, agendar, Pix, cancelar com crédito ou reembolso, avaliar, notificações), barbeiro (Meus ganhos, agenda, detalhe com iniciar/concluir/no-show, expediente, pausas, perfil), push, convite por deep link | 3 unit + 4 fluxos Maestro (não executados) + revisão no navegador |
| 8 | Revisão de segurança, cabeçalhos HTTP, `/api/saude`, E2E no CI, links universais (config), README com runbook | ver abaixo |

## Decisões tomadas durante a execução

- **Arredondamento (provisório):** percentuais arredondam para baixo; o centavo que sobra fica com o cliente (retenção) ou com a barbearia (8% e 80/20).
- **Pix:** o agendamento só existe depois de pago; antes disso o horário fica numa reserva temporária de 20 min (QR Code de 10 min). Um Pix em aberto por cliente.
- **No-show:** automático ao fim da tolerância, e também manual pela equipe (só depois da tolerância), com prévia dos valores.
- **G na Navalha:** no cancelamento tardio e no no-show, a parte da Navalha pode ficar negativa (G maior que 20% do retido); saldo negativo da semana fica para o lote seguinte.
- **Remarcar:** a equipe remarca qualquer agendamento ativo; o cliente, só dentro do prazo grátis. Prazo e tolerância andam junto com o horário, com a política do momento da compra. A versão do agendamento sobe e os jobs do horário antigo se descartam ao acordar. Cartão já pré-autorizado só remarca dentro da validade da pré-autorização (72h).
- **Balcão:** agendamento da equipe entra Confirmado, com pagamento combinado na barbearia (fora do app, sem liquidação de dinheiro).
- **Carteira:** calculada pelo extrato do Navalha (liquidações, lotes e saques); o cartão conta como "a receber" por 32 dias depois da liquidação. Conciliar com o saldo do Asaas em produção (pendência abaixo).
- **Ativar recebimentos:** liga os agendamentos online automaticamente; a subconta é gravada antes do Escrow para não pagar duas subcontas se o Escrow falhar.
- **Oferta automática:** vale a de maior desconto do dia; cupom e oferta não somam.
- **Combos:** reconhecidos pelo nome ("Corte + Barba"), porque o cadastro de serviços não guarda os itens de cada combo.
- **Busca do app:** só barbearias que ativaram os recebimentos e escolheram aparecer nas buscas.
- **cacheComponents do Next desligado:** painel e app dependem da sessão em toda tela.
- **Visual do painel (telas de referência de 23/10):** Inter no texto e DM Mono nos números, tinta ardósia (#3F4655), fundo branco com lateral #FAFAFA e o laranja da marca #F27508. A logo (três lâminas, 100/50/20% de opacidade) está no painel, nas telas de acesso, na página pública, no favicon e nos ícones do app. Textos laranja e o círculo do "hoje" usam #C05100 para passar no contraste AA; o laranja vivo fica nas barras, pontos e gráficos.
- **Agenda:** o "Pendentes" das referências virou "Reservados" (cartão aguardando a pré-autorização), porque não existe status Pendente; "Solicitações" continua fora do menu. Cancelados aparecem na grade, riscados, e saem pelos Filtros; no-show tem filtro próprio. Na semana, só os dias em que a barbearia abre.
- **Menu:** Clientes (nova tela, com busca) e Financeiro com Receitas, Repasses (saques e lotes da taxa) e Relatórios. Os números ao lado do menu são agendamentos de hoje, equipe ativa e serviços ativos. Perfil da barbearia fica embaixo, no lugar de Solicitações, e no menu da conta.
- **Botão principal:** preenchido em quase-preto (contraste AA) nos formulários; as ações do cabeçalho seguem as referências (claras, com borda e ícone).
- **Cadastro do dono na web:** passo extra de verificação do e-mail por código (não está no Figma Cadastro 01–05).

## Revisão de segurança (fase 8)

- Toda rota que altera dados exige sessão; cada caso de uso confere se o usuário pode agir sobre a barbearia ou o agendamento (a conexão do servidor ignora o RLS).
- Rotas públicas: vitrine, busca, disponibilidade e prévia do convite (só leitura); webhook do Asaas (token com comparação em tempo constante e idempotência); Inngest (assinatura em produção).
- RLS testada no pgTAP, inclusive o cliente anônimo do cadastro leve (só vê o próprio agendamento).
- Um Pix em aberto por cliente, para ninguém segurar vários horários sem pagar.
- Capa e logo só aceitam URL http(s) simples (vão para o CSS da página pública).
- Cabeçalhos: `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`; sem `X-Powered-By`.
- CORS só para as origens de `CORS_ORIGENS`; o atalho de Pix de teste não existe em produção.
- O cartão nunca é gravado: só o token do Asaas e os 4 últimos dígitos.

## Pendências e bloqueios

- **Asaas (conta):** endpoints marcados "validar no sandbox" (Escrow, cancelar pré-autorização, confirmar Pix de teste) e as 4 perguntas ao suporte (`ajustes-taxas` §Perguntas) dependem da conta sandbox e do CNPJ aprovado para produção.
- **Asaas (dados do cliente):** a cobrança exige CPF/CNPJ do cliente, e o cartão exige CPF, CEP, número e telefone do titular. O checkout pede esses dados no cartão; no Pix, levar ao suporte se o CPF é obrigatório.
- **Asaas (KYC e saldo):** o status da conta (em análise → aprovada) deve chegar pelo webhook de status da conta, ainda não tratado; conciliar a carteira com `GET /finance/balance`.
- **Caminho PCI do cartão:** os dados do cartão passam pelo servidor até a tokenização no Asaas. Confirmar com o Asaas se há tokenização direto do cliente antes do lançamento.
- **Assinatura Basic/Pro (Cadastro 04):** a cobrança recorrente na conta principal fica para quando houver a conta Asaas. Por ora o plano entra em trial de 14 dias sem cartão.
- **App nas lojas:** contas da Apple e do Google, `projectId` do EAS (push), IDs para os links universais (`IOS_APP_ID`, `ANDROID_SHA256`) e os links das lojas na tela de sucesso.
- **Maestro:** os 4 fluxos estão escritos, mas não rodaram aqui (sem emulador). O app foi conferido no navegador (Expo web).
- **WhatsApp:** API oficial depois do lançamento; abrir a conta Meta Business em paralelo. No MVP, link `wa.me` manual no painel.
- **Busca "perto de mim":** precisa de latitude e longitude da barbearia (geocodificação do endereço).
- **Cliente remarcar pelo app:** a API está pronta (`/api/agendamentos/:id/remarcacao`); falta a tela no app.
- **Regularizar o cartão recusado:** o aviso e o prazo de 12h aparecem; falta a tela de trocar o cartão ou pagar com Pix dentro do mesmo agendamento.
- **Conta permanente do cadastro leve:** o cliente da web entra como anônimo; converter em conta com e-mail verificado fica para quando ele baixar o app.
- **Combos:** guardar os itens de cada combo no cadastro de serviços, no lugar do nome.
- **Captcha:** avaliar captcha no sign-in anônimo da página pública antes do lançamento (o Supabase já limita por IP).
