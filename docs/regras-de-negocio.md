# Navalha — Regras de negócio (pagamentos, taxas e cancelamento)

Oct 21, 2026 · @Jaja

O cliente paga 100% antecipado, o valor fica retido na subconta Asaas da barbearia e só é liquidado quando o agendamento termina: atendimento concluído, cancelamento ou no-show. É nesse momento que a taxa da Navalha é calculada e cobrada.

## Visão geral e glossário

| Termo | Definição |
| --- | --- |
| Cliente | Quem agenda e paga pelo app |
| Barbearia | Estabelecimento assinante. Dona da carteira e de todo o dinheiro recebido |
| Barbeiro | Profissional da barbearia. Não recebe nem saca nada pela Navalha |
| Navalha | Plataforma. Recebe só a sua taxa, nunca o valor cheio do serviço |
| Subconta | Conta Asaas de cada barbearia, criada via API pela Navalha |
| Escrow | Retenção do Asaas que bloqueia o valor na subconta até a liberação |
| Evento final | O que encerra um agendamento: concluído, cancelado no prazo, cancelado fora do prazo, no-show ou cancelado pela barbearia |
| Liquidação | Ação do backend no evento final: estornar, liberar e transferir a taxa |
| Taxa do gateway | Tarifa cobrada pelo Asaas por transação ou estorno. É diferente da taxa Navalha |

## Planos e monetização

A Navalha ganha de duas formas que não se somam: taxa por transação no Free, ou mensalidade no Basic e no Pro. Todos os planos têm pagamento online.

| Plano | Mensalidade | Taxa Navalha por atendimento | Taxa do gateway |
| --- | --- | --- | --- |
| Free | R$ 0 | 8% | Paga pela barbearia |
| Basic | R$ 49 | 0% | Paga pela barbearia |
| Pro | R$ 99 | 0% | Paga pela barbearia |

- A taxa do gateway é cobrada pelo Asaas, não é gerida pela Navalha e existe em todos os planos.
- O card do plano Free no Cadastro precisa mostrar "8% por atendimento".
- O valor que a barbearia vê na carteira é sempre líquido, já sem as taxas.

## Fluxo do dinheiro

O valor nunca passa pela conta da Navalha: fica retido na subconta da barbearia, e a Navalha recebe só a taxa, por transferência, no evento final. É o mesmo modelo da Uber, que cobra a comissão quando a corrida acaba e não quando ela é pedida.

&#91;embedded content: fluxo do dinheiro · pagamento, retenção e 3 desfechos\]

Como nada é dividido antes do evento final, nunca é preciso desfazer um repasse: cada cenário tem uma única ação de liquidação.

## Cenários de liquidação

Cada agendamento termina em exatamente um destes cinco eventos, e cada evento tem uma única regra de divisão. Exemplo com um serviço de R$ 100 e retenção configurada em 50%. G é a taxa do gateway (Asaas).

| Evento final | Cliente recebe de volta | Barbearia fica com | Navalha fica com | Quem paga G |
| --- | --- | --- | --- | --- |
| Concluído · Free | R$ 0 | R$ 92 − G | R$ 8 | Barbearia |
| Concluído · Basic/Pro | R$ 0 | R$ 100 − G | R$ 0 | Barbearia |
| Cliente cancela no prazo | R$ 100 | R$ 0 | R$ 0 | Ninguém no cartão. No Pix, o cliente, se escolher reembolso em vez de crédito |
| Cliente cancela fora do prazo ou no-show | R$ 50 | R$ 40, limpo | R$ 10 − G | Navalha |
| Barbearia ou barbeiro cancela | R$ 100 | − custo do estorno | R$ 0 | Barbearia |

Regras que valem pra tabela inteira:

- No cancelamento tardio e no no-show, a taxa de 8% do Free **não** se aplica. Vale só a divisão 80/20 do valor retido.
- A barbearia nunca vê G no cancelamento tardio: o valor dela chega limpo.
- Quando a barbearia cancela, ela paga o custo do estorno, não uma multa.

## Política de cancelamento

Cada barbearia configura a própria política, e a Navalha fica sempre com 20% do valor retido. A barbearia fica com os outros 80%, limpos.

O que a barbearia configura no Admin:

- **Prazo de cancelamento grátis:** por exemplo, 2 horas antes do horário.
- **% de retenção** no cancelamento tardio e no no-show, de 0% a 100%.
- **Tolerância de atraso:** por exemplo, 15 minutos. Passou disso, conta como no-show.

Como a divisão funciona com outros percentuais (serviço de R$ 100):

| Retenção configurada | Cliente recebe de volta | Barbearia (80%) | Navalha (20%) |
| --- | --- | --- | --- |
| 100% | R$ 0 | R$ 80 | R$ 20 |
| 80% | R$ 20 | R$ 64 | R$ 16 |
| 50% | R$ 50 | R$ 40 | R$ 10 |
| 30% | R$ 70 | R$ 24 | R$ 6 |
| 0% | R$ 100 | R$ 0 | R$ 0 |

A taxa do gateway sai da parte da Navalha. A tela de configuração deve mostrar ao dono a frase "Você recebe 80% do valor retido". O checkout do cliente mostra os valores dessa barbearia, nunca um texto fixo.

## Outras regras

| Tema | Regra |
| --- | --- |
| Agendamento | Instantâneo. Pagou, está confirmado. Não existe aprovação nem recusa pelo barbeiro |
| Pix | Pago na hora. Não existe "Pix pré-autorizado": o valor fica retido no Escrow e, se for o caso, é estornado |
| Cartão | Aparece como "a receber" na carteira até o Asaas liquidar. Sem antecipação no lançamento |
| Antecipação (futuro) | Opcional. 1,99% fixo por antecipação à vista, cobrado da barbearia |
| Fidelidade | Opcional, ligada pela barbearia. O serviço grátis tem custo 100% da barbearia: sem taxa Navalha e sem repasse. Se o cliente faltar, o prêmio é consumido |
| Cupons | Criados por cada barbearia e válidos só nela. Não existe cupom de rede. O desconto sai do valor da barbearia |
| Comissão do barbeiro | Paga pela barbearia, fora da Navalha. A Navalha só mostra no relatório quanto cada barbeiro produziu no período |

Com cupom, a taxa de 8% do Free e a retenção de cancelamento são calculadas sobre o valor efetivamente pago, já com desconto.

## Implementação no Asaas

A cobrança é criada na subconta da barbearia, **sem split**, e a taxa da Navalha entra por transferência só no evento final. O split foi descartado porque executa no momento do pagamento e não serve pra repasse que depende de um evento posterior ([FAQ do split](https://docs.asaas.com/docs/duvidas-frequentes-split)).

**Setup por barbearia**

1. No Cadastro, criar a subconta Asaas via API e guardar o `walletId` e a chave de API dela.
2. Habilitar a Conta Escrow nessa subconta. A retenção vale só pras cobranças recebidas depois de habilitada ([Conta Escrow](https://docs.asaas.com/docs/introducao-conta-escrow)).

**Ações do backend por evento**

| Gatilho | Ação |
| --- | --- |
| `PAYMENT_RECEIVED` (Pix) ou `PAYMENT_CONFIRMED` (cartão) | Marca o agendamento como confirmado e o valor como retido. No cartão, a captura da pré-autorização acontece quando o prazo grátis acaba |
| Atendimento finalizado (evento do app) | Libera o Escrow. Se for Free, transfere 8% pra conta Navalha |
| Cliente cancela no prazo / barbearia cancela | Estorno integral |
| Cancelamento tardio / no-show | Estorno parcial ao cliente → libera o restante → transfere 20% do retido, menos G, pra Navalha |
| `PAYMENT_REFUNDED` | Confirma o estorno, atualiza o status e notifica o cliente |

O estorno só conta como devolvido quando o status for `DONE` ([Estornos](https://docs.asaas.com/docs/estornos)).

**Custos fixos da Navalha:** a Conta Escrow tem mensalidade de R$ 99,90 na conta principal.

**Validar com o Asaas antes de codar**

- [ ] Dá pra transferir da subconta pra conta principal via API, usando a chave da subconta?
- [ ] Dá pra fazer estorno parcial de um valor que ainda está retido no Escrow?
- [ ] Qual é a ordem correta: liberar o Escrow antes ou depois do estorno parcial?
- [ ] No estorno de Pix e de cartão, a tarifa original volta ou é perdida?

## Telas que mudam no Figma

| Área | Tela | Mudança |
| --- | --- | --- |
| Barbeiro | 02c Início (carteira), 04 Ajustes | Sai Carteira, Sacar e Chave Pix. Entra "Meus ganhos" com a produção do período |
| Barbeiro | 06, 06b, 06c Solicitações · 02b, 03b Pendentes · 07b Detalhe pendente | Remover. O agendamento é instantâneo |
| Barbeiro | 07 a 07e Detalhe | Sai o bloco Repasse e a Taxa Navalha. Fica só o valor do serviço |
| Barbeiro | 12 Notificações | Sai "Pix recebido · retido" e "Repasse liberado" |
| Admin | Financeiro (nova) | Carteira com saldo retido, a receber (cartão), disponível e saque. Extrato por agendamento, com as taxas |
| Admin | Configurações (nova) | Política de cancelamento (prazo, % retido, tolerância) e Fidelidade (liga/desliga, nº de cortes, serviço grátis) |
| Admin | 02j Cancelar agendamento | Avisar que o custo do estorno sai da carteira da barbearia |
| Admin | Menu lateral | Sai "Solicitações" |
| Acessos | Cadastro 03 Plano | O card Free mostra "8% por atendimento" |
| Cliente | 10c Checkout (política), 15 e 15b Cancelar | Valores dinâmicos da política de cada barbearia |
| Cliente | 10 Checkout | Adicionar campo de cupom |
| Cliente | 20, 20b Promoções · 19 Notificações | Cupom vale só na barbearia que o criou. Tirar "qualquer barbearia parceira" |
| Cliente | 01 Home | Fidelidade aparece por barbearia, só se ela tiver ativado |
| Todas | Dados mockados | Padronizar endereço, dono, preços e receitas da Barbearia do Zé |

## Decisões

Decididas em 21/10:

| Tema | Decisão |
| --- | --- |
| Base dos 8% no Free | Valor bruto pago pelo cliente. Em R$ 100: R$ 8,00 no bruto, contra R$ 7,84 no líquido do Pix |
| Cupom | A taxa de 8% e a retenção são calculadas sobre o valor com desconto |
| Cancelamento no prazo · cartão | Pré-autoriza no agendamento e só captura quando o prazo grátis acaba. Cancelou antes disso, não há taxa |
| Cancelamento no prazo · Pix | O cliente escolhe entre crédito de 100% na barbearia ou reembolso descontando o custo do Pix. Barbearia e Navalha não pagam nada |
| No-show no corte grátis | O prêmio da fidelidade é consumido |
| Antecipação de cartão | 1,99% fixo por antecipação à vista, cobrado da barbearia |
| Saque | Manual, mínimo de R$ 50. Taxa de transferência do Asaas, se houver, paga pela barbearia |
| Dono que atende | Um login só, usado no painel web e no app de barbeiro |

Confirmar com o Asaas, porque afeta essas decisões:

- [ ] Uma pré-autorização de cartão que não é capturada tem algum custo?
- [ ] Dá pra estender o prazo da pré-autorização além dos 3 dias padrão, pra agendamentos feitos com antecedência?
- [ ] Qual é a tarifa de transferência ou saque a partir de uma subconta?
