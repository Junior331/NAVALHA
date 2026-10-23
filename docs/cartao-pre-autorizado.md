# Navalha — Cartão pré-autorizado e transferência da taxa

Oct 21, 2026 · @Jaja

Recomendação: opção (c) pro cartão, com pré-autorização criada 72h antes do fim do prazo grátis, e taxa da Navalha transferida em lote semanal. A opção (b) foi descartada porque devolve o custo do gateway ao cancelamento no prazo.

## Cartão: opção (c) com janela de 72h

A pré-autorização do Asaas vale no máximo 3 dias pra barbearia. Estender até 25 dias só é permitido pros MCCs 4121, 7011, 4411 e 7512 ([config de pré-autorização](https://docs.asaas.com/reference/salvar-ou-atualizar-configuracao-de-pre-autorizacao)). Como a maioria dos agendamentos de barbearia é feita pra mesma semana, a pré-autorização direta cobre o caso comum, e os agendamentos mais distantes seguem estes passos:

1. **No agendamento,** o app tokeniza o cartão e valida que ele está ativo.
2. **O sistema cria a pré-autorização sozinho** quando o agendamento entra na janela de 72h antes do fim do prazo grátis, e não 72h antes do horário. Assim ela continua válida na hora da captura.
3. **Se a pré-autorização falhar,** o cliente recebe uma notificação e tem 12h pra trocar o cartão ou pagar com Pix. Se não fizer nada, o horário é liberado e ninguém paga taxa.
4. **A captura acontece** quando o prazo de cancelamento grátis acaba.

| Status no app | Quando aparece |
| --- | --- |
| Reservado | Cartão tokenizado, pré-autorização ainda não criada ou pendente |
| Confirmado | Pré-autorização aprovada, ou Pix pago |
| Liberado | Pré-autorização falhou e o cliente não regularizou em 12h |

## Fluxo do cartão

```
Cliente agenda com cartão
  └─ Mais de 72h até o fim do prazo grátis?
       ├─ não → pré-autoriza na hora ──────────────┐
       └─ sim → tokeniza o cartão (status Reservado)│
                 → cria a pré-autorização ao entrar │
                   na janela de 72h ────────────────┤
                                                    ▼
                                             Aprovada?
       ├─ sim → Confirmado (captura no fim do prazo grátis)
       └─ não → cliente tem 12h pra trocar cartão ou pagar Pix
                 ├─ regularizou → Confirmado
                 └─ não regularizou → horário liberado, ninguém paga taxa
```

Os dois caminhos se juntam na mesma checagem de aprovação, então o backend trata a falha de um jeito só, não importa a antecedência do agendamento.

## Transferência da taxa Navalha em lote semanal

O backend acumula as taxas de cada barbearia e faz uma única transferência por semana, em vez de uma por atendimento. Assim a resposta do suporte sobre a tarifa deixa de ser bloqueante.

- **São cerca de 4 transferências por mês por barbearia.** Mesmo que haja tarifa, o custo fica diluído, e cabe nos 30 Pix grátis por mês da tabela PJ se essa cota valer pra subconta ([preços Asaas](https://www.asaas.com/precos-e-taxas)).
- **O risco não aumenta,** porque a taxa continua bloqueada no saldo da barbearia até a transferência.
- **A carteira mostra o saldo disponível já descontado:** disponível = saldo − taxas a transferir. A barbearia não consegue sacar o valor da taxa.
- **O saque mínimo de R$ 50 é verificado sobre o disponível,** não sobre o saldo bruto.

## Perguntas pro suporte do Asaas

A documentação não responde estas cinco perguntas. Nenhuma delas bloqueia o desenho acima, mas todas mudam o custo.

- [ ] Uma pré-autorização que expira ou é cancelada tem algum custo?
- [ ] Existe exceção ao limite de 3 dias de pré-autorização pro MCC de barbearia ou salão?
- [ ] Qual é a tarifa de transferência entre a subconta e a conta principal pelo `walletId`, e ela entra nos 30 Pix grátis do mês?
- [ ] A subconta usa a tabela de taxas da conta principal? Dá pra negociar?
- [ ] Quando a pré-autorização é feita na subconta, a tarifa do cartão capturado é cobrada da subconta ou da conta principal?

Fontes: [prazo estendido de pré-autorização](https://docs.asaas.com/changelog/configura%C3%A7%C3%A3o-de-prazo-estendido-para-pr%C3%A9-autoriza%C3%A7%C3%A3o) · [capturar cobrança pré-autorizada](https://docs.asaas.com/reference/capturar-cobranca-com-pre-autorizacao) · [criar cobrança com pré-autorização](https://docs.asaas.com/changelog/criar-cobran%C3%A7a-do-cart%C3%A3o-de-cr%C3%A9dito-com-pr%C3%A9-autoriza%C3%A7%C3%A3o) · [FAQ de transferências](https://docs.asaas.com/docs/faq-de-transfer%C3%AAncias)
