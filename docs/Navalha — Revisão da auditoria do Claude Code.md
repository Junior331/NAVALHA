# Navalha — Revisão da auditoria do Claude Code

Oct 22, 2026 · @Jaja

A auditoria de UX do Claude Code (cognitive walkthrough do cliente e Nielsen do Admin) é boa, mas ele leu só 1 dos 3 docs de regras. Três pontos caem, quatro entram no backlog, e os docs viram base fixa do projeto.

## O que a auditoria errou

O Claude Code leu só o doc de ajustes de taxas. Sem os outros dois, três achados não se sustentam:

| Achado da auditoria | Por que cai | O que fica |
| --- | --- | --- |
| "No cartão, a taxa de R$ 3,48 não volta no cancelamento no prazo" | O cartão é pré-autorizado e só capturado quando o prazo grátis acaba. Cancelou no prazo, nada foi cobrado | A tela 10c muda só no Pix: crédito de 100% ou reembolso descontando o custo do Pix |
| "A pré-autorização de 3 dias não cobre agendamento de uma semana" | Já está resolvido pelo fluxo (c), com a janela de 72h e o status Reservado | Nada a fazer |
| Item 10 do Admin: "Status inicial: Confirmado / Pendente" sem explicação | O agendamento é instantâneo. O status Pendente sai do produto | Remover a opção da tela 02g |

## Achados novos que entram no backlog

- [ ] **Tirar o "até 3x sem juros" do checkout (10b).** O parcelado custa mais no Asaas, e "sem juros" significa que a barbearia absorve esse custo. O modelo não prevê isso, e num ticket de R$ 50–100 o parcelamento quase não muda a conversão.
- [ ] **Separar no-show de cancelamento no Admin (02j).** "Cliente não compareceu" não é motivo de cancelamento: é um evento próprio, com retenção 80/20, e precisa de uma ação própria.
- [ ] **Corrigir os relatórios e criar Financeiro/Carteira.** O "líquido" hoje ignora os 8% da Navalha e a taxa do cartão, e não separa "a receber" de "recebido". Isso confirma a tela de Financeiro/Carteira que já estava na lista do Figma.
- [ ] **Criar o estado "Ativar recebimentos" no Admin.** Sem ele, não dá pra aplicar a regra da subconta criada só na ativação. O interruptor "Aceitar agendamentos online" do Perfil passa a depender desse estado.

## Como deixar os docs como base fixa

Pra toda sessão do Claude Code já começar sabendo das regras:

1. Exportar os três docs em Markdown pra uma pasta `docs/` na raiz do projeto Navalha: regras de negócio, cartão pré-autorizado e ajustes de taxas.
2. Criar um `CLAUDE.md` na raiz com o texto abaixo.

```markdown
# Navalha

As regras de negócio estão em `docs/`. Quando dois docs conflitarem, vale esta ordem:

1. `docs/ajustes-taxas.md`
2. `docs/cartao-pre-autorizado.md`
3. `docs/regras-de-negocio.md`

- O agendamento é instantâneo. Não existe status Pendente.
- No-show é um evento próprio, separado de cancelamento.
- Sem parcelamento no cartão no MVP.
```
