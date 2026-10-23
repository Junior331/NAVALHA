# Navalha — Fluxo do dono até o cliente agendar

Oct 22, 2026 · @Jaja

O cliente baixa um app só, chamado Navalha, na App Store ou no Google Play, e encontra a barbearia dentro dele. Não existe app por barbearia: a Navalha publica uma vez e cada barbearia aparece lá dentro, sem nenhum passo de publicação pro dono.

## Fluxo do dono

1. **Criar a conta** no painel web (`navalha.app`) ou no próprio app.
2. **Configurar a barbearia:** nome, endereço, fotos, horário de funcionamento, serviços com preço e duração, barbeiros e política de cancelamento. A barbearia já existe, mas ainda não recebe agendamentos pagos.
3. **Ativar recebimentos:** dados bancários e verificação. É aqui que a subconta Asaas é criada, e a partir daí a barbearia fica visível e aceita agendamentos.
4. **Divulgar** o link e o QR code que o painel gera.

## Como o cliente chega

| Canal | O que acontece |
| --- | --- |
| Link no WhatsApp ou Instagram (`navalha.app/barbearia-do-ze`) | Com o app instalado, abre direto na página da barbearia dentro dele. Sem o app, abre a página web, onde o cliente agenda e paga sem baixar nada |
| QR code no balcão ou no espelho | Mesmo comportamento do link |
| Busca dentro do app | Quem já usa o Navalha encontra a barbearia por "perto de mim" ou pelo nome |

Depois do primeiro agendamento pela web, a tela de sucesso sugere baixar o app pra remarcar e receber lembretes. É assim que o cliente migra pro app sem precisar ser convencido antes.

O detalhe técnico são os links universais (Universal Links no iOS, App Links no Android): o mesmo endereço abre o app quando ele está instalado e a página web quando não está. Com Expo + Next.js isso é configuração, não um projeto à parte.
