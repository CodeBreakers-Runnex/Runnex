# Roteiro de teste da beta 2.3 (app 0.2.1)

Cobre tudo que mudou na `beta-2.3` (PR #31): as correções dos PRs #13 a #30 e o chatbot (#32). Este roteiro vem **junto** do `docs/TESTE_ANDROID.md`, que continua valendo para o que não mudou (login nativo, permissões de GPS, botão voltar).

Marque ✅ passou · ❌ falhou · ⚠️ passou com ressalva · ⚪ não testei. Qualquer ❌ ou ⚠️ vira feedback (seção 12).

---

## 0. Antes de começar

### Ordem obrigatória: servidor primeiro, app depois

O PR #22 muda o protocolo do chat em tempo real. O app novo conecta **sem token na URL**, e o servidor antigo não entende isso: o chat fica sem tempo real até o servidor ser atualizado (as mensagens ainda chegam em até 60 s pelo polling). O inverso funciona: o servidor novo aceita o app antigo.

**Caminho recomendado:**

1. Mergear o PR #31 na `main`. O Render publica o backend sozinho.
2. Conferir no navegador: `https://<sua-api>.onrender.com/health` mostra `{"status":"ok"}` e `.../docs` mostra **404** (agora é de propósito).
3. Gerar o APK novo (abaixo).

**Voltar atrás, se der problema:** no painel do Render, em *Deploys*, use *Rollback* para o deploy anterior (volta o servidor em um minuto). Para o código: `git revert -m 1 <hash do merge>` na `main`.

**Sem mergear (só para conferir telas no computador, sem GPS nem APK):** rodar o backend da `beta-2.3` na sua máquina.

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements-dev.txt
alembic upgrade head
uvicorn app.main:app --port 8001
```

No `.env.local` do frontend: `VITE_API_URL=http://localhost:8001`, e depois `npm run dev`. Precisa do `backend/.env` com `DATABASE_URL` e `FIREBASE_PROJECT_ID`. Para abrir o `/docs` localmente, ponha `API_DOCS=true` nesse `.env`.

### Gerar e instalar o APK

```bash
git switch beta-2.3
git pull
npm ci
npm run android:apk
```

O arquivo sai em `android\app\build\outputs\apk\debug\app-debug.apk`. Use o mesmo `.env.local` e o mesmo `google-services.json` das versões anteriores. Antes de gerar, confira que o `VITE_API_URL` aponta para a API de produção.

Depois de instalar, em **Configurações do Android → Apps → Runnex**, a versão tem que ser **0.2.1**. Se ainda mostrar 0.2.0, o APK antigo continua instalado.

### O que você precisa ter à mão

- 2 contas de teste (A e B): uma de e-mail e senha já confirmada e uma Google.
- 2 aparelhos, ou 1 celular + o navegador do computador, para os itens de grupo.
- Se ainda tiver o **APK 0.2.0**, guarde-o: o item 1 e o 6.3 comparam o antigo com o novo.

---

## 1. Cronômetro com a tela bloqueada (o mais importante) — PR #24

Medir se o tempo da corrida bate com o relógio quando o Android segura o app. Faça **primeiro no APK 0.2.0** (se tiver) e **depois no 0.2.1**.

| # | Passo | Esperado | Resultado |
|---|---|---|---|
| 1.1 | Iniciar uma corrida (pode ser caminhando). Anotar a hora do celular. Bloquear a tela por **10 minutos**, sem mexer. | — | |
| 1.2 | Desbloquear e olhar o tempo da corrida. Comparar com a hora do celular. | **0.2.1: diferença de no máximo 2 s.** | |
| 1.3 | Repetir com a **economia de bateria ligada**. | Mesmo resultado. Se falhar, anote o fabricante do celular. | |
| 1.4 | Pausar por 2 minutos e retomar. | O tempo pausado **não** entra. | |

**Anote os dois números (app e relógio) em cada versão.** Se o 0.2.0 já mostrava o tempo certo, ótimo: o problema não existia nesse aparelho, e a correção só garante que não vai aparecer. Se mostrava menos, esse é o número para a banca.

## 2. Corrida, salvamento e recuperação — PRs #21, #23, #24, #27

| # | Passo | Esperado | Resultado |
|---|---|---|---|
| 2.1 | Iniciar, andar ~500 m e finalizar. | "Corrida salva"; aparece no Início e no Feed. | |
| 2.2 | No Feed, ver o nome e a foto da sua corrida. | O nome é o do seu **perfil** (PR #21). | |
| 2.3 | Antes de iniciar, trocar o tênis e abrir "Meus tênis". | O seletor mostra o tênis padrão; aposentados não aparecem. | |
| 2.4 | Iniciar, andar 200 m e **forçar o fechamento** do app. Reabrir. | "Corrida não finalizada" com a distância. **Continuar** retoma de onde parou; **Descartar** apaga. | |
| 2.5 | Finalizar uma corrida com o **modo avião** ligado. | "Guardada no celular". Ao ligar a internet, ela é enviada **uma vez só**. | |
| 2.6 | Com internet muito ruim (opcional), finalizar. | Em até 60 s vira "guardada no celular" ou salva; nunca fica travada. | |
| 2.7 | Uma corrida **mais longa que 99 min** (pode ser simulada em desenvolvimento). | Salva normalmente. | |

## 3. Perfil e foto — PRs #14, #18, #25

| # | Passo | Esperado | Resultado |
|---|---|---|---|
| 3.1 | **Conta Google:** Perfil → editar → trocar a foto → salvar. Fechar o app pelo multitarefa e reabrir. | **A foto escolhida continua** (Perfil, Feed, corrida nova). Antes voltava a do Google. | |
| 3.2 | Conta Google nova, sem foto no perfil. | Aparece a foto do Google. | |
| 3.3 | Abrir Configurações, alternar tema claro/escuro, fechar. | Tudo legível nos dois temas. | |
| 3.4 | Editar o perfil: digitar um nome com mais de 80 caracteres. | O campo para de aceitar no 80º. | |

## 4. Servidor fora ou dormindo — PRs #17, #20, #23

| # | Passo | Esperado | Resultado |
|---|---|---|---|
| 4.1 | Ligar o **modo avião** e abrir o Perfil. | Tela de erro com **"Tentar de novo"**; não mostra XP 0 nem histórico vazio. | |
| 4.2 | Mesmo modo avião: Início, Estatísticas, Pet, Conquistas. | Aviso ou tela de erro em cada uma, nunca uma conta zerada calada. | |
| 4.3 | Modo avião: Feed, e dentro de um grupo as abas de publicações e chat. | Mensagem de erro com botão; **não fica carregando para sempre**. | |
| 4.4 | Modo avião: Social → **Grupos**. | Aviso de erro; **não** aparecem os grupos de demonstração no lugar. | |
| 4.5 | Desligar o modo avião e tocar **"Tentar de novo"**. | Os dados voltam. | |
| 4.6 | Deixar o app **15 minutos ou mais** sem usar (o Render dorme) e abrir. | "Conectando ao servidor…" e depois carrega normalmente, sem conta zerada. | |

## 5. Feed — PR #16

Precisa de 2 contas: B salva uma corrida enquanto A olha o Feed.

| # | Passo | Esperado | Resultado |
|---|---|---|---|
| 5.1 | A curte uma corrida. | O coração muda **na hora**. | |
| 5.2 | A toca em "Ver mais atividades" e curte uma corrida antiga. | O coração muda (antes nunca mudava). | |
| 5.3 | B salva uma corrida nova. A arrasta o Feed para baixo e solta. | A corrida nova aparece e depois "Feed atualizado!". | |
| 5.4 | A puxa para atualizar com o **modo avião**. | Mensagem de erro; a lista continua na tela. | |

## 6. Grupos e chat em tempo real — PRs #13, #15, #20, #22, #23, #26

| # | Passo | Esperado | Resultado |
|---|---|---|---|
| 6.1 | A cria um grupo. B toca em **"Entrar" duas vezes rápido**. | B entra **uma vez**, sem erro. Membros = 2. | |
| 6.2 | A e B (APK novo nos dois) trocam mensagens no chat. | Aparecem no outro **sem recarregar**. | |
| 6.3 | **A com o APK 0.2.0 e B com o 0.2.1** (ou B no navegador). Trocar mensagens nos dois sentidos. | Funciona nos dois sentidos. | |
| 6.4 | A abre e fecha a tela do grupo várias vezes enquanto B manda mensagens. | **Nenhuma mensagem duplicada** e nenhum "não foi possível enviar". | |
| 6.5 | A publica **só uma foto**, sem texto. | Publica (antes sempre dava erro). | |
| 6.6 | A publica um texto, B curte e comenta. | Contadores atualizam nos dois. | |
| 6.7 | Desligar e ligar o Wi-Fi dentro do chat algumas vezes. | O tempo real volta sozinho em até 30 s. | |
| 6.8 | B sai do grupo pelas opções. | Volta para a lista de grupos. | |

## 7. Agenda de treinos e eventos — PRs #15, #30

| # | Passo | Esperado | Resultado |
|---|---|---|---|
| 7.1 | Agenda: criar um treino, editar, marcar como concluído, apagar. | Tudo funciona; o resumo da semana confere. | |
| 7.2 | **Conta Google nova** que abre a agenda antes de qualquer outra coisa e cria um treino. Depois olhar o Feed ou o Ranking. | Aparece "Corredor" ou o nome da conta, **nunca um código**. | |
| 7.3 | Eventos: abrir a lista, salvar um evento, tocar duas vezes rápido. | Salva uma vez, sem erro. | |

## 8. Treinador (chatbot) — PR #32

Conta **com** pelo menos uma corrida salva. Em cada resposta de nutrição tem que aparecer **"Orientação geral, não substitui nutricionista."** e **nenhum** valor em litros, ml, calorias ou peso.

| # | Pergunta | Esperado | Resultado |
|---|---|---|---|
| 8.1 | `o que devo comer depois da corrida?` | Começa com "Pela sua última corrida (X km em Y min, …)" e dá uma orientação. | |
| 8.2 | `corri 2h30, o que beber depois?` | Fala em carboidrato por hora e diz que em esforços muito longos "podem ser maiores". | |
| 8.3 | `corri 40 minutos, o que comer depois?` | Orientação curta, **sem** carboidrato por hora. | |
| 8.4 | `como me hidratar?` | Diz que é individual e repor o que suou. **Sem** "2-3 litros" nem "150-300 ml". | |
| 8.5 | `quero saber mais` (logo depois do 8.4) | Versão detalhada da hidratação. | |
| 8.6 | `devo tomar gel na meia maratona?` | Fala de carboidrato por hora (não responde sobre meia maratona). | |
| 8.7 | `o que comer depois da corrida?` numa conta **sem corridas** | Pede a duração ou a distância. | |
| 8.8 | `quanto tempo depois da corrida devo comer?` | Responde sobre comer, **não** pede seu pace. | |
| 8.9 | Regressão: `minhas estatísticas`, `meus recordes`, `minhas últimas corridas`, `oi`, `ajuda` | Respondem como antes. A `ajuda` menciona "depois de correr". | |

Anote qualquer resposta estranha, ou que soe como conselho médico demais.

## 9. Login e conta — PRs #18, #28, #29

| # | Passo | Esperado | Resultado |
|---|---|---|---|
| 9.1 | Sair e entrar com e-mail e senha. | Entra normalmente. | |
| 9.2 | Sair e entrar com Google (seletor nativo). | Entra; foto do Google aparece. | |
| 9.3 | Criar uma conta nova e confirmar o e-mail. | Fluxo igual ao anterior. | |
| 9.4 | Entrar com Google numa rede que bloqueie o Firestore (opcional). | Entra sem travar. | |

## 10. Conferências no servidor (precisa de acesso ao Render)

| # | Passo | Esperado | Resultado |
|---|---|---|---|
| 10.1 | `.../health` e `.../docs` no navegador. | `{"status":"ok"}` e **404**. | |
| 10.2 | Variáveis do serviço no painel do Render. | `COIN_MOCK_PURCHASES` **não** está `true`: com ela ligada, qualquer usuário ganha RunCoins de graça. | |
| 10.3 | Logs do Render depois do teste do chat. | As conexões novas aparecem como `/groups/<id>/ws` **sem** `?token=`. | |

## 11. Passada rápida de regressão (10 minutos)

Abrir cada tela uma vez e ver se algo quebrou ou mudou de lugar: Início, Social (Feed, Ranking, Grupos, Eventos), Estatísticas (recordes e evolução), Perfil, Pet (loja de acessórios e pacotes de RunCoins), Tênis, Conquistas, Treinador. Em cada uma: botão voltar do Android, rotação da tela, tema claro e escuro.

---

## Fora do que foi testado aqui (para não reportar como bug)

- **Sono, Health Connect, sensor cardíaco e música estão desligados de propósito** (`src/config/features.ts`).
- **Os grupos e eventos de demonstração ainda existem.** Removê-los depende de decisão sua.
- **O GPS não foi alterado.** Só o cronômetro (item 1) e a parte visual da tela de corrida (tênis e aviso de corrida não finalizada).
- **A compra de pacote de RunCoins é simulada** e só funciona se o servidor tiver `COIN_MOCK_PURCHASES=true`.

---

## 12. Como me passar o feedback

Pode ser uma mensagem por problema, ou uma tabela como esta:

| Item | Resultado | Aparelho / Android | O que esperava | O que aconteceu | Prioridade |
|---|---|---|---|---|---|
| 6.4 | ❌ | Moto G / 14 | Sem duplicar | Duplicou uma vez | P1 |

- **Prioridade:** P1 impede de usar ou perde dado; P2 atrapalha mas tem jeito de contornar; P3 detalhe ou estética.
- **Print ou vídeo** ajuda muito, principalmente para o chat e para o cronômetro.
- **O que passou também interessa**, principalmente os números do item 1 e os itens 2.4, 2.5 e 6.3, que são os melhores argumentos para a banca.
- Se o app **fechar sozinho** (crash), diga o que estava fazendo na tela.
