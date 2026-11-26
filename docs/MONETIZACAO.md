# Venda de RunCoins: o que existe, o que não existe e por quê

Decisão do grupo: **não vender RunCoins nesta versão.** O projeto deixa a base pronta e documentada, mas não cobra nada de ninguém.

## O que existe no código

| Peça | Onde | Estado |
|---|---|---|
| Catálogo de pacotes (300, 1.100, 3.100 e 8.400 moedas) | `backend/app/pet_catalog.py` (`COIN_PACKS`), espelhado em `src/lib/coins.ts` e conferido por teste de paridade | Pronto |
| Crédito de pacote, **sem duplicar** a mesma transação, com o saldo travado (`FOR UPDATE`) contra compras simultâneas | `backend/app/services/coin_purchases.py` (`credit_purchase`) | Pronto, testado |
| Estorno que pode deixar o saldo negativo, para reembolso não render item de graça | mesmo arquivo (`refund_purchase`) | Função pronta e testada, **mas nenhuma rota a chama** |
| Histórico de compras do usuário | `GET /users/{uid}/coins/purchases` | Pronto |
| Compra **simulada** (credita sem cobrar) | `POST /users/{uid}/coins/mock-purchase` | Só funciona com `COIN_MOCK_PURCHASES=true` no servidor |
| Tela da loja | `src/components/CoinShopSheet.tsx` | Só aparece quando o servidor habilita a compra |

## O que **não** existe

- **Nenhuma cobrança real.** Não há integração com gateway de pagamento nem com o Google Play.
- **Nenhum webhook.** Sem ele, ninguém aciona o estorno e nada confirma um pagamento.
- **Nenhuma emissão de nota fiscal.**

## Como está em produção

- `COIN_MOCK_PURCHASES` é falso por padrão (`backend/app/config.py`). Ligado em produção, qualquer usuário ganharia moedas de graça. **Conferir no painel do Render que não está `true`.**
- Com a flag desligada, o app **não mostra a loja**: o saldo aparece sem o botão "+", e o aviso de saldo curto diz "Corra para ganhar mais: 1 km = 1 RunCoin". Antes, a loja abria com preços e todos os pacotes desabilitados.
- O usuário continua ganhando RunCoins correndo, e gasta no pet. Nada disso depende de compra.

## Por que ficou de fora

Para vender de verdade seria preciso, no mínimo, o seguinte. Os itens abaixo são o entendimento do grupo e **precisam ser confirmados com um contador ou orientador antes de serem apresentados como fato**:

1. **Quem vende.** Cobrar exige uma pessoa jurídica ou outro enquadramento legal; um projeto de TCC não tem.
2. **Nota fiscal e tributos** sobre a venda de itens digitais. O enquadramento (e o efeito da reforma tributária) não foi verificado pelo grupo.
3. **Loja de aplicativos.** No Android, item digital vendido dentro do app costuma ter que passar pelo Google Play Billing, e não por gateway próprio. Política atual **não verificada** neste projeto.
4. **Assinatura (plano VIP)** não resolve nada disso: traz os mesmos pontos, mais renovação, cancelamento e reembolso recorrentes.

## O que dizer na banca

Frase segura, que o código sustenta:

> "Modelamos a venda de pacotes de RunCoins: catálogo, crédito idempotente e histórico, com modo simulado para testes. Não ativamos a cobrança real porque exigiria empresa, emissão de nota fiscal e, no Android, o faturamento da loja de aplicativos, e isso saiu do escopo do TCC."

Evite:
- "Fizemos a compra" ou "a compra funciona": **não há cobrança real**.
- "Tem estorno automático": a função existe, mas não há webhook que a aciona.
- Afirmar regras fiscais ou da Play Store como certas sem ter confirmado.

## Para demonstrar na banca (opcional)

Ligar `COIN_MOCK_PURCHASES=true` no ambiente de **demonstração** faz a loja aparecer no app, com o aviso "Modo de teste: nenhuma cobrança é feita". Não precisa gerar APK novo, porque o app pergunta ao servidor. **Desligar de novo depois** e conferir no painel.

## Se um dia for vender

1. Definir o enquadramento legal e fiscal.
2. Integrar o Google Play Billing (ou o provedor escolhido) e validar a compra no servidor.
3. Criar o webhook que chama `credit_purchase` na confirmação e `refund_purchase` no reembolso.
4. Remover a compra simulada.
