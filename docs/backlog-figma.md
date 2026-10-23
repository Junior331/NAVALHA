# Navalha — Backlog de ajustes no Figma

Oct 22, 2026 · gerado pelo Claude Code

Achados do cognitive walkthrough do cliente, da auditoria Nielsen do Admin e da leitura dos três docs de `docs/`. Já sem os três achados derrubados em "Revisão da auditoria do Claude Code".

Severidade: **3** grave · **2** menor · **1** cosmético. Itens marcados com **[regra]** vêm da lista "Telas que mudam no Figma" de `docs/regras-de-negocio.md` e não têm severidade: são mudanças de regra de negócio, não achados de usabilidade.

---

## Todas as áreas

- [ ] **[regra]** Padronizar os dados mockados (endereço, dono, preços e receitas) da Barbearia do Zé. Divergências encontradas na auditoria:
  - Receita do Dashboard em 30 dias contra a semana em Relatórios.
  - Preço e duração de Corte + Barba (R$ 55 / 50 min no cliente, R$ 85 / 1h no Admin).
  - Endereço (Pinheiros-SP no cliente, Recife-PE no Admin).
  - Avaliações (128 contra 212).
  - Nome do dono (Zé Silva contra Zé Barbosa).
  - Receita no domingo, que consta como fechado.

---

## Acessos

### Cadastro 03 · Plano

- [ ] **[regra]** O card do plano Free mostra "8% por atendimento".

---

## Cliente

### Todas as telas

- [ ] **(3)** Botão principal preenchido com a cor da marca e desabilitado com baixo contraste. Hoje o "Continuar" desabilitado (cinza preenchido) parece mais forte que o habilitado (branco com contorno). Vale para 07b, 08b, 09b e todos os botões principais ("Agendar horário", "Pagar com Pix" etc.).

### 01 · Home

- [ ] **(2)** Dar rótulo ao "+" central ou colocar um botão "Agendar" visível. Hoje o único caminho claro para agendar é tocar numa barbearia da lista.
- [ ] **[regra]** A fidelidade aparece por barbearia, e só se ela tiver ativado.

### 03 · Barbearia (abas Sobre, Serviços, Barbeiros)

- [ ] **(2)** Usar um rótulo só para as três entradas do fluxo. Hoje são "Agendar horário", "Escolher horário" e "Ver agenda".
- [ ] **(2)** Se a pessoa já marcou serviços na aba Serviços, abrir o fluxo direto no passo 2 com esses serviços selecionados.

### 07 · Agendar · Passo 1 (serviços)

- [ ] **(3)** Ao detectar avulsos que formam um combo mais barato, sugerir a troca: "Troque pelo combo e economize R$ X". Ex.: Corte + Barba (R$ 55) + Sobrancelha (R$ 15) = R$ 70, contra o combo de R$ 65.
- [ ] **(2)** Bloquear ou avisar quando a pessoa marcar um combo junto com um avulso que ele já inclui.
- [ ] **(2)** Avisar já neste passo quando nenhum barbeiro faz a combinação escolhida. Hoje o erro só aparece no passo 2 (08b).
- [ ] **(1)** Pedir confirmação no "Trocar" barbearia, porque a seleção de serviços se perde.

### 08c · Agendar · Barbeiro (perfil)

- [ ] **(2)** Deixar claro se tocar num horário (16:30 etc.) já o escolhe, ou mostrar os horários só como informação. Hoje o botão é "Escolher Rafael".

### 09 / 09b / 09c · Agendar · Data e hora

- [ ] **(2)** Diferenciar visualmente horário que já passou de horário ocupado. Hoje os dois aparecem riscados e com pouco contraste.
- [ ] **(2)** Fazer a bolinha de disponibilidade da tira de dias bater com os horários. Hoje sex 09 tem bolinha, mas 09b diz "Sem horários nesse dia".
- [ ] **(2)** Marcar no calendário completo (09c) quais dias têm vaga.
- [ ] **(1)** 09b: usar seta → em "Próximo dia livre" e um ícone de pessoa em "Trocar de barbeiro" (hoje é o ícone de loja).

### 10 · Checkout (revisar e pagar)

- [ ] **(3)** Mostrar acima do botão de pagar uma linha com a política daquela barbearia: prazo grátis, % retido no cancelamento tardio ou no-show, tolerância de atraso. Os valores vêm de cada barbearia, nunca de texto fixo.
- [ ] **[regra]** Adicionar campo de cupom.
- [ ] **(1)** Deixar claro para onde leva o "Editar" do resumo.

### 10b · Checkout (cartão)

- [ ] **(3)** Remover o "Em até 3x sem juros" e o seletor de parcelas. Não há parcelamento no MVP.
- [ ] **(3)** Trocar "Pagar R$ 70,00" por algo como "Reservar com cartão" + "Cobrança em [data/hora do fim do prazo grátis]". Nada é cobrado no agendamento: o cartão é tokenizado ou pré-autorizado e só capturado no fim do prazo grátis.
- [ ] **(2)** Conferir com o gateway se são obrigatórios nome do titular e CPF. Hoje o formulário não tem esses campos.

### 10c · Checkout (política)

- [ ] **[regra]** Valores dinâmicos da política de cada barbearia. Hoje "50%" e "reembolso integral" estão fixos.
- [ ] **(3)** Cancelamento no prazo, por meio de pagamento:
  - **Cartão:** nada foi cobrado, então não há reembolso a fazer.
  - **Pix:** o cliente escolhe entre crédito de 100% na barbearia ou reembolso descontando o custo do Pix.

### 12 · Sucesso

- [ ] **(3)** Criar uma variação para cartão com status **Reservado** (pré-autorização ainda não criada), explicando quando o cartão será validado e cobrado. Hoje a tela só cobre "Confirmado · pago via Pix".

### 15 / 15b · Cancelar

- [ ] **[regra]** Valores dinâmicos da política de cada barbearia.

### 19 · Notificações / 20 / 20b · Promoções

- [ ] **[regra]** O cupom vale só na barbearia que o criou. Tirar "qualquer barbearia parceira".

### Telas novas

- [ ] **(3)** Falha na pré-autorização: notificação e tela para trocar o cartão ou pagar com Pix em até 12h, com o prazo visível.
- [ ] **(3)** Status **Liberado**: o agendamento foi liberado porque a pré-autorização falhou e não foi regularizada, e ninguém pagou nada.

### Conferir na próxima auditoria

- [ ] 13 Agendamentos, 14 Detalhe e 19 Notificações precisam prever os status Reservado, Confirmado e Liberado, e a notificação de falha na pré-autorização.

---

## Barbeiro

### 02c Início (carteira) / 04 Ajustes

- [ ] **[regra]** Saem Carteira, Sacar e Chave Pix. Entra "Meus ganhos", com a produção do período.

### 06 / 06b / 06c Solicitações · 02b / 03b Pendentes · 07b Detalhe pendente

- [ ] **[regra]** Remover essas telas. O agendamento é instantâneo.

### 07 a 07e · Detalhe

- [ ] **[regra]** Saem o bloco Repasse e a Taxa Navalha. Fica só o valor do serviço.

### 12 · Notificações

- [ ] **[regra]** Saem "Pix recebido · retido" e "Repasse liberado".

---

## Admin

### Todas as telas

- [ ] **(2)** Botão principal preenchido: Novo agendamento, Confirmar agendamento, Publicar promoção, Salvar alterações. Hoje ele tem o mesmo contorno de Filtros, Voltar e Cancelar.
- [ ] **(2)** Badges do menu só para pendências. Hoje misturam total (Barbeiros 4, Serviços 8) com pendências (Agenda 12).
- [ ] **(2)** Fazer o status bater com o relógio do cabeçalho (19:31): no Dashboard, "Próximas 3h · 15:45–18:45"; no Perfil, "Aberto agora · fecha às 19h".
- [ ] **(1)** Ajuda contextual nas telas financeiras e no primeiro acesso.

### Menu lateral

- [ ] **[regra]** Sai "Solicitações".

### 02 · Agenda (semana) / 02c · Dia

- [ ] **(3)** Legenda de cores e uma regra única de status: Reservado, Confirmado, Concluído, Cancelado, No-show. Sem Pendente. Hoje, às 19:31, horários de quarta entre 14h e 17h30 ainda aparecem verdes.
- [ ] **(3)** Separar por barbeiro (colunas, cores ou eventos lado a lado). Hoje há uma coluna por dia, e atendimentos simultâneos vão se sobrepor.
- [ ] **(2)** Todo card mostra serviço e barbeiro. Hoje "Bruno Alves" e "Davi Moreira" aparecem sem nenhum dos dois.
- [ ] **(2)** Mostrar a grade até o horário de fechamento, ou indicar que há rolagem. Hoje ela termina às 18h.
- [ ] **(2)** Agendamento cancelado libera o espaço visualmente. Hoje fica riscado e ocupando o horário.

### 02b · Agenda · Evento (popover)

- [ ] **(2)** Adicionar uma linha de pagamento: meio de pagamento e status (Reservado, Confirmado, a capturar em [data]).

### 02g · Novo agendamento · Revisão

- [ ] **(2)** Remover a opção "Status inicial: Confirmado / Pendente". O agendamento é instantâneo.

### 02j · Cancelar agendamento

- [ ] **[regra]** Avisar que o custo do estorno sai da carteira da barbearia. Mostrar os valores antes de confirmar: o cliente recebe 100% de volta, e o valor exato do custo do estorno.
- [ ] **(3)** Tirar "Cliente não compareceu" dos motivos de cancelamento. No-show é outra ação (ver abaixo).

### No-show (ação nova)

- [ ] **(3)** Ação própria no evento da agenda: aplica a retenção configurada pela barbearia (80% dela, 20% da Navalha) e mostra os valores antes de confirmar.

### 03c · Barbeiros · Menu da linha

- [ ] **(3)** Confirmação em "Remover da barbearia": dizer quantos agendamentos futuros existem e o que acontece com eles (reatribuir, ou cancelar com estorno) e avisar os clientes. Seguir o padrão de 05d.
- [ ] **(2)** "Pausar agenda" pede período e motivo e mostra os agendamentos afetados.

### 04 · Convidar barbeiro

- [ ] **(1)** Trocar "…para **ele** criar o próprio acesso" por "…para a pessoa criar o próprio acesso".

### 05 / 05b · Serviços

- [ ] **(2)** Um termo só: "Ativo/Inativo" ou "Visível/Oculto para os clientes".
- [ ] **(2)** No filtro de status, opção única: Todos / Ativos / Inativos. Hoje são caixas de seleção, e dá para marcar as duas.

### 07 · Nova promoção

- [ ] **(3)** Adicionar campo "Dias válidos" que gera o texto da descrição automaticamente. Hoje a descrição promete "aos sábados e domingos", mas o sistema não aplica essa regra.

### 07b · Promoções (lista)

- [ ] **(2)** Na promoção agendada, trocar o interruptor desligado por uma etiqueta "Começa em 18 out" com a opção "Pausar". Hoje ela parece igual à encerrada.
- [ ] **(1)** O aviso "Promoção agendada" corta o texto. Deixar o aviso crescer ou encurtar a frase.

### 08 · Relatórios

- [ ] **(3)** Remover "Comissão dos barbeiros" e o "Líquido" calculado a partir dela. A comissão é paga fora da Navalha: o relatório mostra só a produção de cada barbeiro no período. Os valores financeiros (líquido com os 8% do plano Free e a taxa do gateway, "a receber" e "recebido") ficam na tela Financeiro.

### 08b · Relatórios · Filtros

- [ ] **(2)** Listar todos os serviços no filtro (hoje são 3 de 8), com busca.
- [ ] **(1)** Deixar um só "Limpar". Hoje há um no topo e outro no rodapé.

### 09 · Perfil da barbearia

- [ ] **(3)** Pedir confirmação antes de desligar "Aceitar agendamentos online" e mostrar um aviso "Reservas pausadas" em todo o Admin.
- [ ] **(3)** O interruptor só pode ser ligado depois de "Ativar recebimentos".
- [ ] **(2)** Um único jeito de salvar. Hoje o botão "Salvar alterações" do topo convive com a barra de alterações não salvas (09b).

### Financeiro (tela nova)

- [ ] **[regra]** Carteira com saldo retido, a receber (cartão), disponível e saque. Extrato por agendamento, com as taxas.
- [ ] **(3)** Disponível = saldo − taxas da Navalha ainda não transferidas no lote semanal. O saque mínimo de R$ 50 vale sobre o disponível, não sobre o saldo.

### Configurações (tela nova)

- [ ] **[regra]** Política de cancelamento (prazo, % retido, tolerância) e Fidelidade (liga/desliga, nº de cortes, serviço grátis).

### Ativar recebimentos (estado novo)

- [ ] **(3)** Passo do onboarding com dados bancários e KYC, que cria a subconta. Antes disso a barbearia configura tudo, mas não recebe agendamentos pagos.
