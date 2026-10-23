# Navalha — Ajustes após as taxas reais do Asaas

Oct 21, 2026 · @Jaja

As taxas da conta Asaas mudam três pontos do modelo: a subconta passa a ser criada só quando a barbearia ativa os recebimentos, a taxa da Navalha vai por Pix grátis, e as contas usam o preço cheio do cartão, não o promocional.

## Subconta criada só na ativação dos recebimentos

Cada subconta custa R$ 12,90 pra conta principal. No plano Free, a Navalha só recupera esse valor depois de cerca de R$ 161 em atendimentos (R$ 12,90 ÷ 8%). Por isso a regra muda: **a subconta não é criada no cadastro, e sim quando a barbearia ativa os recebimentos.**

- **Gatilho:** um passo "Ativar recebimentos" no onboarding, com dados bancários e KYC, ou o primeiro agendamento pago, o que vier primeiro.
- **Antes da ativação,** a barbearia já consegue configurar perfil, equipe, serviços e horários, mas não recebe agendamentos pagos.
- **Resultado:** barbearia inativa custa R$ 0. O custo de R$ 12,90 aparece só pra quem já está perto de gerar receita.

## Transferência da taxa via Pix enviado

Na conta Asaas, o Pix enviado é grátis e ilimitado, enquanto a TED custa R$ 5,00. Então a subconta manda a taxa por **Pix pra chave da Navalha**, em vez de usar a transferência interna pelo `walletId`, que não tem tarifa publicada.

- O lote semanal continua, agora mais pela conciliação do que pela economia: um registro por barbearia por semana.
- Essa regra só funciona se a subconta tiver a mesma tabela da conta principal. Isso está na lista do suporte.

## G com preço cheio

O modelo de negócio usa o preço cheio do Asaas, pra não depender de promoção. Valores pra um serviço de R$ 100:

| Meio | Taxa | G em R$ 100 | Recebimento |
| --- | --- | --- | --- |
| Cartão de crédito à vista (até 29/12/2026) | 1,99% + R$ 0,49 | R$ 2,48 | 32 dias |
| **Cartão de crédito à vista (preço cheio, usar no modelo)** | 2,99% + R$ 0,49 | **R$ 3,48** | 32 dias |
| Cartão de débito | 1,89% + R$ 0,35 | R$ 2,24 | 3 dias |
| Pix recebido | Não aparece nas Vendas. A confirmar | R$ 0 se for grátis | Na hora |

Se o Pix recebido for grátis, duas regras mudam:

- **Base dos 8%:** bruto e líquido viram a mesma coisa no Pix. A diferença continua só no cartão, e a decisão pelo bruto se mantém.
- **Cancelamento no prazo via Pix:** o reembolso pode voltar a ser 100%, sem descontar nada do cliente. Pra isso, o estorno do Pix também precisa ser grátis.

## Perguntas pro suporte do Asaas

As taxas acima são da conta principal, e parte delas é promocional. Estas quatro respostas fecham o modelo:

- [ ] A subconta herda a tabela da conta principal, inclusive as promoções? Dá pra negociar?
- [ ] O Pix recebido é grátis? E o estorno ou devolução de Pix?
- [ ] Uma pré-autorização de cartão que expira ou é cancelada tem custo?
- [ ] Existe exceção ao limite de 3 dias de pré-autorização pro MCC de barbearia ou salão?

A dúvida sobre a tarifa de transferência pelo `walletId` saiu da lista, porque a taxa da Navalha passa a ir por Pix.
