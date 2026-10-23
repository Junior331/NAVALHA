# Navalha — Execução do roadmap

Registro do que já foi feito em cada fase do `docs/roadmap.md`, do que ficou de fora e por quê.
Atualizado a cada fase.

## Feito

| Fase | Entrega | Testes |
|---|---|---|
| 0 | Monorepo Turborepo + pnpm, CI (formato, lint, typecheck, unit, pgTAP, integração) | CI verde |
| 1 | `packages/core`: Money, máquina de estados, liquidação, política, janelas do cartão, disponibilidade, cupom, fidelidade, carteira, fuso | 118 unit |
| 2 | Schema completo com RLS, Auth (código por e-mail, anônimo), seed padronizado, tipos gerados (`packages/db`) | 40 pgTAP |
| 3 | `packages/pagamentos`: PaymentProvider, fake, adaptador Asaas, webhooks, contrato (fake, servidor de mentira e sandbox) | 52 unit + sandbox (pulado sem chave) |
| 4 | `packages/servidor`: liquidação, cartão pré-autorizado, Pix, no-show, lembrete, lote semanal, webhook; funções do Inngest | 39 integração + 11 unit |
| 5 | Casos de uso e rotas da API, sessão do Supabase, canais de notificação (push + e-mail de fallback) | 30 integração + 19 unit |

## Decisões tomadas durante a execução

- **Arredondamento (provisório):** percentuais arredondam para baixo; o centavo que sobra fica com o cliente (retenção) ou com a barbearia (8% e 80/20).
- **Pix:** o agendamento só existe depois de pago; antes disso o horário fica numa reserva temporária de 20 min (QR Code de 10 min).
- **No-show:** automático ao fim da tolerância, e também manual pela equipe (só depois da tolerância).
- **G na Navalha:** no cancelamento tardio e no no-show, a parte da Navalha pode ficar negativa (G maior que 20% do retido); saldo negativo da semana fica para o lote seguinte.
- **cacheComponents do Next desligado:** painel e app dependem da sessão em toda tela.
- **Botão principal:** preenchido em quase-preto (contraste AA); o laranja da marca fica para destaques e gráficos (#E8711A no claro, #E06C1C no escuro, validados pelo script da skill dataviz).
- **Cadastro do dono na web:** passo extra de verificação do e-mail por código (não está no Figma Cadastro 01–05).

## Pendências e bloqueios

- **Fase 5 → 7c:** remarcar ficou para a agenda do Admin.
- **Fase 5 → 7d:** carteira e saque ficaram para o Financeiro.
- **Asaas:** endpoints marcados "validar no sandbox" (Escrow, cancelar pré-autorização, confirmar Pix de teste) dependem da conta sandbox.
- **Asaas:** criar cobrança exige CPF/CNPJ do cliente, e o cartão exige CPF, CEP, número e telefone do titular. Isso conflita com o cadastro leve (nome, celular, e-mail) e vale levar ao suporte.
- **Assinatura Basic/Pro (Cadastro 04):** a cobrança recorrente na conta principal fica para quando houver a conta Asaas. Por ora o plano entra em trial de 14 dias sem cartão.
