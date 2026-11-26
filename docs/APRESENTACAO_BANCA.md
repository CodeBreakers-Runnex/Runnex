# Runnex: preparação para a banca

Objetivo: chegar **apresentável**, não perfeito. A banca vê uma demonstração de poucos minutos e faz perguntas. O que derruba uma apresentação é falha ao vivo e resposta insegura, não funcionalidade faltando.

## 1. Regra principal: congelar o escopo

- Do dia do teste em diante, **nada novo entra**. Só correção do que o teste mostrar.
- **Grupo privado e a loja escondida não são necessários para a banca.** Se não foram testados em aparelho até a véspera, **não mergear**. Funcionalidade nova sem teste em celular é risco sem retorno.
- Mergear antes da banca só o que já tem teste em aparelho.

## 2. Pré-requisitos (nesta ordem)

| # | O que | Por quê |
|---|---|---|
| 1 | Mergear o PR #31 e confirmar o deploy do backend | Sem isso o app novo fica sem chat em tempo real |
| 2 | No Render: `/health` ok, `/docs` 404, `COIN_MOCK_PURCHASES` **não** é `true` | Segurança e coerência com o que será dito |
| 3 | Gerar o APK 0.2.1 localmente (`npm run android:apk`), com a URL da API de produção e o `google-services.json` | O APK do CI não serve: tem URL de exemplo |
| 4 | Rodar `docs/ROTEIRO_TESTE_BETA_2_3.md` no celular que vai ser usado na banca | Descobrir falha antes da banca, não durante |
| 5 | Resolver todo item P1 do teste | P1 impede de usar ou perde dado |

## 3. Riscos da demonstração e como reduzir

| Risco | Reduzir |
|---|---|
| **Servidor dormindo.** O Render pode dormir após cerca de 15 minutos parado e a primeira chamada demora. | Abrir o app e fazer uma ação **5 a 10 minutos antes** de entrar, e de novo logo antes. Tenha a tela "Conectando ao servidor…" na cabeça: ela é esperada. |
| **Internet da sala falha.** | Hotspot do celular como reserva. Ter **vídeo gravado** da demonstração completa para o pior caso. |
| **GPS dentro da sala não funciona.** | **Não corra ao vivo.** Mostre uma corrida já salva e a gravação de uma corrida real. Se quiser mostrar o fluxo, use o vídeo. |
| **Conta de demonstração vazia.** Feed e ranking sem dados parecem app quebrado. | Preparar 2 ou 3 contas com corridas salvas, um grupo com membros e mensagens, e o pet com acessórios. |
| **Grupos de demonstração falsos** (ex.: "Sao Paulo Runners", 128 membros) aparecem quando não há grupo real. | Ter ao menos um grupo real criado, para a lista não cair nos de demonstração. Se perguntarem, dizer que são conteúdo de exemplo. |
| **Login com Google no aparelho da banca.** | Já entrar com a conta **antes**, e não depender de digitar senha ao vivo. |
| **Tela bloqueada e cronômetro.** | Só afirme que o cronômetro foi corrigido **depois** de medir os 10 minutos no seu celular (item 1 do roteiro). |

## 4. Roteiro de demonstração (cerca de 6 a 7 minutos)

1. **Problema e público (30 s).** Corredor amador que quer constância e comunidade.
2. **Início e estatísticas (1 min).** Dados reais, recordes, evolução.
3. **Uma corrida salva (1 min).** Mostrar o resultado, o tênis usado e como aparece no Feed. Se não for correr ao vivo, dizer isso de forma natural.
4. **Social (1,5 min).** Feed com curtida, ranking, grupo com chat em tempo real (dois aparelhos, se possível).
5. **Pet e conquistas (1 min).** Gamificação: XP, RunCoins ganhos correndo, acessórios.
6. **Treinador (1 min).** Perguntar "o que devo comer depois da corrida?" e mostrar a resposta com o aviso de que não substitui nutricionista.
7. **Fechamento (30 s).** Testes automatizados, segurança revisada, o que fica como trabalho futuro.

Se algo travar, **siga em frente** e volte depois. Não tente consertar ao vivo.

## 5. Perguntas difíceis e respostas honestas

**"Vocês vendem RunCoins? Como é o pagamento?"**
Modelamos a venda de pacotes (catálogo, crédito sem duplicar, histórico), com modo simulado para teste. A cobrança real não foi ativada porque exige empresa, nota fiscal e, no Android, o faturamento da loja de aplicativos, e isso saiu do escopo. *Não diga que a compra funciona.* Ver `docs/MONETIZACAO.md`.

**"Há estorno de compra?"**
A função existe e é testada, mas não há webhook que a aciona, então não é automático.

**"O que acontece se o servidor cair?"**
O app mostra erro com "Tentar de novo" em vez de uma conta zerada, e as chamadas têm tempo limite. Corridas salvas sem internet ficam guardadas no celular e são enviadas depois, uma vez só.

**"Como garantem que o cronômetro está certo com a tela bloqueada?"**
Passou a usar o relógio do aparelho em vez de contar tiques. *Só responda assim se você mediu.* Caso contrário: "foi corrigido e coberto por teste automatizado; a medição em aparelho está no roteiro de teste".

**"Segurança: o que foi feito?"**
Revisão completa com auditoria documentada (`docs/reports/auditoria-refatoracao.md`): limites de entrada, token do chat fora da URL, nome e foto da corrida vindos do servidor, dependência com falha conhecida atualizada, documentação da API fechada em produção, limite de tentativas.

**"Como testaram?"**
Testes automatizados no frontend e no backend (centenas de casos), banco recriado do zero a cada rodada, e roteiro de teste em aparelho Android. *Os números exatos mudam; confira antes de falar.*

**"Por que sono, relógio e sensor cardíaco não aparecem?"**
Foram desligados de propósito nesta versão e documentados em `src/config/features.ts`; o código continua no projeto.

**"Por que ainda há Firestore se vocês têm backend próprio?"**
Restou apenas para os grupos e eventos de demonstração; o resto migrou para o backend próprio. Remover depende de decidir sobre esses dados. É trabalho futuro conhecido.

**"As fotos ficam onde?"**
No banco, em base64. Funciona, mas não escala bem; mover para armazenamento de arquivos é trabalho futuro.

## 6. O que não dizer

- "A compra de moedas funciona" ou "tem estorno automático".
- "O cronômetro está corrigido em aparelho", se não mediu.
- Números de teste de cabeça. Rode e leia antes.
- Que algo é "100% seguro". Diga "revisado e corrigido o que a auditoria encontrou".

## 7. Dia anterior

- [ ] Carregar celular e levar carregador e cabo.
- [ ] Hotspot testado.
- [ ] Vídeo da demonstração completa gravado e aberto fora do app.
- [ ] Contas de demonstração conferidas, já logadas.
- [ ] APK 0.2.1 instalado e versão conferida (0.2.1).
- [ ] Render: `/health` ok, `COIN_MOCK_PURCHASES` desligado.
- [ ] Nenhuma mudança nova depois do último teste.
