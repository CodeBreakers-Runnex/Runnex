# Banca: marketplace como trabalho futuro

Material de apoio para a apresentação. A ideia central: **o marketplace foi um
corte de escopo deliberado, não uma entrega atrasada**. Falar disso com segurança
conta a favor; parecer que "não deu tempo" conta contra.

## Fala sugerida (~1 min)

> "A proposta original do Runnex incluía um marketplace: o corredor trocaria o
> desempenho dele por descontos em produtos de parceiros. Durante o projeto a gente
> avaliou o que isso exige para ser feito com qualidade: integração com um gateway de
> pagamento, tratamento de dados financeiros, parceiros reais com estoque e preço,
> e as obrigações do Código de Defesa do Consumidor numa venda online. Com uma equipe
> acadêmica e sem orçamento, a gente teria um checkout de fachada, e preferimos não
> entregar isso.
>
> Então priorizamos o núcleo: tracking com GPS confiável, validação das corridas
> no servidor, comunidade em tempo real e a economia interna do pet. Essa economia,
> a RunCoin, já é o embrião do marketplace: moeda ganha por quilômetro, preços
> definidos pelo servidor e compra atômica no banco. O marketplace seria o
> próximo passo natural sobre essa base."

## O que já existe e sustenta o argumento

Tudo isto está no código e é verificável:

- **Moeda interna (RunCoin)**: creditada pelo servidor a cada corrida salva, 1 por km
  (`backend/app/gamification.py`, `routers/activities.py`).
- **Loja do pet com preço definido no servidor**: o app só diz *o que* quer comprar;
  o preço vem de `backend/app/pet_catalog.py` e a compra é uma transação única no
  Postgres. É o mesmo modelo que um checkout real exigiria.
- **Anti-fraude do "dinheiro" do app**: a RunCoin só vale alguma coisa porque as
  corridas são validadas no servidor (velocidade, rota, limite diário), com rate
  limit por usuário. Sem isso, um marketplace seria fraudável no primeiro dia.
- **Catálogo de produtos**: a tabela `products` e o endpoint somente-leitura
  `GET /products` já existem no backend, sem tela no app.

## Como seria construído (se perguntarem)

1. **Parceiros e catálogo**: painel administrativo para cadastrar produtos, preço e
   estoque (hoje o catálogo é só leitura).
2. **Cupons por desempenho**: a RunCoin vira desconto (ex.: 500 RunCoins = 10% num
   parceiro). O cupom é gerado e validado pelo servidor, com uso único.
3. **Pagamento**: checkout hospedado por um gateway (redirecionamento), para que o
   app **nunca** toque em dados de cartão. A confirmação chega por webhook assinado,
   que só então marca o pedido como pago.
4. **Pedidos**: tabelas de pedido e itens, com status (criado → pago → enviado), e
   estorno das RunCoins se o pagamento falhar.
5. **Obrigações**: política de troca e arrependimento (CDC, 7 dias em compra online),
   termos de uso atualizados e dados de pagamento fora do nosso banco (LGPD).

## Perguntas prováveis e respostas curtas

**"Por que não fizeram pelo menos um checkout simulado?"**
Porque um checkout simulado demonstraria tela, não engenharia. Preferimos investir
no que tinha risco técnico real: GPS em segundo plano, validação no servidor e
tempo real.

**"A RunCoin não é fácil de fraudar?"**
As corridas são validadas no servidor: média de até 30 km/h, distância coerente com
a rota GPS enviada e no máximo 24h de corrida em 24h, além de limite de requisições.
Isso barra fraude simples. Um cliente adulterado que invente uma rota coerente ainda
passa, e é por isso que, antes de a moeda valer dinheiro de verdade, seria preciso
detecção de anomalias (ex.: padrões de ritmo impossíveis) ou verificação com dados
de sensores.

**"Quanto tempo levaria?"**
Não temos uma estimativa validada. A parte técnica (catálogo, cupons, webhook) é o
menor pedaço. O que mais pesa é o não técnico: parceiros, contratos e suporte ao
cliente.

## O que evitar dizer

- "Não deu tempo." Soa como falha de planejamento.
- Prometer data ou valores de taxa de gateway sem ter pesquisado.
- Mostrar a tabela `products` como se fosse funcionalidade: ela é base, não produto.
