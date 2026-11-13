# Mapa do projeto Runnex

Para que serve cada pasta e cada arquivo, e se ele está em uso. Gerado lendo o código em 13/11/2026 (`main` em `b7ba335`). Quando um arquivo novo entrar, acrescente uma linha aqui.

**Status usado nas tabelas**

| Status | Significa |
|---|---|
| **Em uso** | Faz parte do app que roda hoje. |
| **Desligado** | Recurso pronto, mas escondido de propósito em `src/config/features.ts` (sono, Health Connect, sensor cardíaco, música). Não apagar. |
| **Sem tela** | Existe no backend, mas nenhuma tela do app usa. |
| **Morto** | Ninguém usa. Pode ser apagado. |
| **Legado** | Sobra do Firestore ou de versões antigas, mantido por compatibilidade. |
| **Fora do app** | Não é código do aplicativo (marketing, arte, ferramenta da equipe). |

> **"Veloxy" = nome antigo do projeto.** Aparece em `package.json`, no nome do banco de teste (`veloxy_test`), no projeto Firebase (`veloxy-20b42`), no domínio (`veloxy-run.web.app`) e nas chaves do `localStorage` (`veloxy_active_run_v1`, `veloxy-theme`...). **Não renomeie as chaves do `localStorage`:** quem já tem o app instalado perde a corrida em andamento, o tema e o histórico do Treinador.

---

## 1. Como as peças se encaixam

```text
Celular (APK Capacitor) ou navegador (PWA)
  │
  │  src/pages/*            telas
  │  src/components/*       pedaços de tela reaproveitados
  │  src/hooks/*            estado compartilhado (login, GPS, voltar do Android)
  │  src/lib/*              regras puras, sem rede (XP, rota, pet, datas)
  │  src/services/*Api.ts   uma função por chamada ao backend
  │  src/services/apiClient.ts  coloca o token do Firebase e faz o fetch
  │
  ├── Firebase Auth (Google)        login, cadastro, confirmação de e-mail
  ├── Firestore (Google)            LEGADO: só grupos/eventos de demonstração
  │
  ▼  HTTPS + token do Firebase no cabeçalho      WebSocket (chat do grupo)
backend/app/main.py  (FastAPI, no Render)
  │  routers/*.py      uma rota por URL; checa login, dono e membro
  │  schemas*.py       valida o que chega e formata o que sai
  │  services/*.py     regras que mexem no banco (XP, tênis, exclusão de conta)
  │  models/*.py       tabelas
  ▼
Postgres (Neon) — estrutura criada pelas migrações em backend/alembic/versions/
```

**Exemplo: salvar uma corrida.**

1. `RunTracking.tsx` grava os pontos de GPS.
2. Ao finalizar, chama `saveActivity` (`services/activitiesApi.ts`), que manda um `POST /activities`.
3. No backend, `routers/activities.py` recebe a corrida e `schemas.py` + `activity_rules.py` recusam corrida impossível (acima de 30 km/h, distância incompatível com a rota).
4. `services/activity_effects.py` soma XP, km do mês, RunCoins e km semanal dos grupos.
5. Sem internet, `services/offlineRuns.ts` guarda a corrida no celular e `components/OfflineRunSync.tsx` reenvia depois.

---

## 2. Onde fica cada regra (para responder na banca)

| Pergunta | Arquivo |
|---|---|
| Como o XP e o nível são calculados? | `backend/app/gamification.py` (o servidor decide); `src/lib/gamification.ts` é a cópia para exibir. `backend/tests/test_parity.py` falha se as duas divergirem. |
| Quanto vale cada RunCoin? | `backend/app/gamification.py` (`KM_PER_RUNCOIN`), creditado em `services/activity_effects.py`. |
| Como impedem corrida falsa? | No celular: `src/pages/app/RunTracking.tsx` (ignora trecho acima de 30 km/h) e `src/lib/route.ts` (filtra ruído do GPS). No servidor: `backend/app/activity_rules.py` (velocidade e rota) e `routers/activities.py` (no máximo 24 h de corrida em 24 h). Mais o limite de requisições em `backend/app/rate_limit.py`. |
| Como protegem a casa de quem corre? | `backend/app/route_privacy.py`: os outros não veem os primeiros nem os últimos 200 m da rota. |
| Perfil privado | `backend/app/listing.py` (`visible_to`), usado no feed, ranking e listas. |
| Quem pode postar no grupo? | `backend/app/routers/groups.py` (`_require_member`). |
| Chat em tempo real | `backend/app/ws_manager.py` ↔ `src/services/groupSocket.ts`. |
| Loja do pet (preço) | `backend/app/pet_catalog.py`: o preço vem do servidor, nunca do app. |
| Compra de pacote de RunCoins | `backend/app/services/coin_purchases.py`. Hoje só existe compra **simulada**, ligada por `COIN_MOCK_PURCHASES` (`backend/app/config.py`, nunca ligar em produção). |
| LGPD: baixar e excluir meus dados | Exportação: `backend/app/data_export.py` + `src/services/dataExport.ts`. Exclusão: `backend/app/services/account_deletion.py` + `src/services/auth.ts` (`deleteCurrentAccount`). Página pública exigida pelo Google Play: `public/excluir-conta/index.html`. |
| Termos e privacidade | Texto: `src/content/legalContent.ts`. Pedido de aceite: `src/components/TermsGate.tsx`. |
| Treinador virtual | Lógica: `backend/app/chatbot_logic.py`. Rota: `routers/chatbot.py`. Tela: `src/pages/app/Coach.tsx`. |
| Recursos ligados e desligados | `src/config/features.ts` |

---

## 3. Raiz do repositório

| Arquivo | Para que serve | Status |
|---|---|---|
| `README.md` | Apresentação e como rodar. Cita `productsApi.ts`, que não existe mais. | Em uso (corrigir) |
| `package.json` / `package-lock.json` | Dependências e comandos do frontend (`npm run dev`, `lint`, `test`, `build`, `android:apk`). | Em uso |
| `index.html` | Página que carrega o app; título, ícones e prévia de link (`og-image`). | Em uso |
| `vite.config.ts` | Build do frontend e configuração do PWA (ícones, manifesto). Lista `firebase/storage` num chunk, mas o Storage não é usado. | Em uso |
| `vitest.config.ts` | Configuração dos testes do frontend. | Em uso |
| `tsconfig*.json` | Configuração do TypeScript. `noUnusedLocals` ligado: import morto quebra o `npm run lint`. | Em uso |
| `eslint.config.js` | Regras do lint. Regra de variável sem uso desligada. | Em uso |
| `tailwind.config.ts`, `postcss.config.js` | Tailwind v3 (cores e fontes do app). | Em uso |
| `components.json` | Configuração do shadcn/ui (gerador de componentes de `src/components/ui`). | Em uso (só ao gerar componente) |
| `capacitor.config.ts` | Configuração do app Android (id `br.com.runnex.app`, login Google nativo). | Em uso |
| `firebase.json`, `.firebaserc` | Hospedagem no Firebase Hosting e onde ficam as regras do Firestore. | Em uso |
| `firestore.rules` | Regras de segurança do Firestore. Hoje só liberam o documento `users/{uid}` do próprio dono. | Legado |
| `.env.example` | Modelo das variáveis do frontend (Firebase, URL do backend, chave do mapa). | Em uso |
| `.gitignore`, `.vscode/settings.json` | Arquivos fora do git; configuração do editor. | Em uso |

---

## 4. Frontend (`src/`)

### Entrada

| Arquivo | Para que serve | Status |
|---|---|---|
| `main.tsx` | Ponto de partida: já começa a acordar o servidor e desenha o `App`. | Em uso |
| `App.tsx` | Todas as rotas (URLs) do app; telas protegidas por login; aplica o tema. | Em uso |
| `index.css` | Estilos globais, cores dos temas claro/escuro, animações. | Em uso |
| `vite-env.d.ts`, `types/assets.d.ts` | Avisos ao TypeScript (variáveis de ambiente, importar imagens). | Em uso |

### `config/` e `content/`

| Arquivo | Para que serve | Status |
|---|---|---|
| `config/features.ts` | Liga/desliga sono, Health Connect, sensor cardíaco e música. | Em uso |
| `config/firebase.ts` | Inicializa o Firebase Auth e o Firestore. | Em uso (o Firestore é legado) |
| `content/legalContent.ts` | Texto dos Termos e da Política de Privacidade, e a versão (`LEGAL_VERSION`). | Em uso |
| `content/sleepContent.ts` | Texto do consentimento de dados de sono. | Desligado |

### `pages/` — as telas

| Arquivo | URL | Para que serve | Status |
|---|---|---|---|
| `auth/Login.tsx` | `/login` | Entrar com e-mail/senha ou Google. | Em uso |
| `auth/Register.tsx` | `/register` | Criar conta; manda o e-mail de confirmação. | Em uso |
| `auth/VerifyEmail.tsx` | `/verificar-email` | "Confirme seu e-mail"; bloqueia o app até confirmar. | Em uso |
| `auth/AuthAction.tsx` | `/auth/action` | Abre o link do e-mail (confirmar conta, trocar senha). | Em uso |
| `auth/CompleteProfile.tsx` | `/complete-profile` | Nome e foto logo após confirmar o cadastro. | Em uso |
| `auth/Legal.tsx` | `/termos-e-privacidade` | Mostra os termos. | Em uso |
| `app/Home.tsx` | `/` e `/home` | Início: resumo da semana, última corrida, próximo treino. | Em uso |
| `app/Social.tsx` | `/social` e `/feed` | Abas Feed, Grupos e Ranking; criar grupo. | Em uso |
| `app/Feed.tsx` | (dentro de Social) | Feed global de corridas, curtidas, "ver mais". Só é usado embutido na tela Social. | Em uso |
| `app/Group.tsx` | `/grupo/:id` | Tela de um grupo: posts, comentários, chat. | Em uso |
| `app/RunTracking.tsx` | `/run` | Gravar a corrida com GPS: GPS, cronômetro, salvamento e recuperação (o arquivo mais importante e o maior: ~1.030 linhas). | Em uso |
| `app/Dashboard.tsx` | `/dashboard` e `/stats` | Estatísticas, recordes e evolução. | Em uso |
| `app/Events.tsx` | `/events` | Provas de corrida; salvar no perfil. | Em uso |
| `app/Profile.tsx` | `/profile` | Perfil, edição, configurações, tema, excluir conta. | Em uso |
| `app/Pet.tsx` | `/pet` | Mascote, loja de acessórios, loja de RunCoins. | Em uso |
| `app/Achievements.tsx` | `/conquistas` | Conquistas. | Em uso |
| `app/Coach.tsx` | `/treinador` | Conversa com o treinador virtual. | Em uso |
| `app/Shoes.tsx` | `/tenis` | Cadastro e desgaste dos tênis. | Em uso |
| `app/TrainingCalendar.tsx` | `/calendario-treinos` | Agenda de treinos. | Em uso |
| `app/Sleep.tsx` | `/sono` | Sono e recuperação. | Desligado |
| `app/ConnectedDevices.tsx` | `/dispositivos` | Importar corridas do relógio (Health Connect). | Desligado |
| `NotFound.tsx` | qualquer outra | Página 404. | Em uso |

### Subpastas de telas grandes

Telas que passavam de 800 linhas foram divididas (movimentação pura, ver PRs #25, #26 e #27):

| Arquivo | Para que serve | Status |
|---|---|---|
| `pages/app/profile/SettingsModal.tsx` | Modal de configurações do Perfil. | Em uso |
| `pages/app/profile/EditProfileModal.tsx` | Modal de edição do Perfil (nome, foto, bio, meta). | Em uso |
| `pages/app/profile/theme.ts` | Tema claro/escuro. | Em uso |
| `pages/app/group/GroupFeedPanel.tsx` | Feed do grupo: publicar, curtir, comentar. | Em uso |
| `pages/app/group/GroupChatPanel.tsx` | Chat do grupo. | Em uso |
| `pages/app/group/GroupOptionsModal.tsx` | Dados do grupo e "Sair do grupo". | Em uso |
| `pages/app/group/GroupStateScreens.tsx` | Carregando e telas de erro do grupo. | Em uso |
| `pages/app/run/ShoePicker.tsx` | Seletor de tênis da tela de corrida. | Em uso |
| `pages/app/run/RecoverRunDialog.tsx` | Aviso de corrida não finalizada. | Em uso |
| `pages/app/run/MusicSheet.tsx` | Atalhos de música da corrida. | Desligado |
| `components/LoadRetry.tsx` | Mensagem "não carregou" com "Tentar de novo". | Em uso |

### `components/` — pedaços de tela

| Arquivo | Usado em | Para que serve | Status |
|---|---|---|---|
| `PrivateRoute.tsx` | App | Manda para o login quem não entrou, e para "confirme o e-mail" quem não confirmou. | Em uso |
| `ServerWakeGate.tsx` | PrivateRoute | "Conectando ao servidor...": espera o Render acordar. | Em uso |
| `TermsGate.tsx` | App | Pede aceite dos termos quando a versão muda. | Em uso |
| `OfflineRunSync.tsx` | App | Reenvia corridas guardadas sem internet. | Em uso |
| `AndroidBackButton.tsx` | App | Botão voltar do Android (fecha modal, volta tela, sai do app na Home). | Em uso |
| `BottomNav.tsx` / `SideNav.tsx` | App | Menu de baixo (celular) / menu lateral (computador). | Em uso |
| `ErrorBoundary.tsx` | App | Tela de erro se algo quebrar, em vez de tela branca. | Em uso |
| `ActivityCard.tsx` | Feed | Card de uma corrida no feed. | Em uso |
| `RouteSVGPreview.tsx` | ActivityCard | Desenho da rota no card. | Em uso |
| `RunHistoryRow.tsx` | Home, Perfil | Linha do histórico de corridas. | Em uso |
| `SafeAvatar.tsx` | várias | Foto da pessoa, com iniciais se a foto falhar. | Em uso |
| `GlassCard.tsx` | quase todas | Estilo padrão de cartão. | Em uso |
| `ScreenTitle.tsx` | quase todas | Título padrão das telas. | Em uso |
| `ShoeStatusBadge.tsx` | Corrida, Tênis | Etiqueta "bom / atenção / gasto". | Em uso |
| `CoinShopSheet.tsx` | Pet | Loja de pacotes de RunCoins (compra simulada). | Em uso |
| `DeleteAccountSection.tsx` | Perfil | Excluir conta (digitar EXCLUIR + senha/Google). | Em uso |
| `ExportDataButton.tsx` | Perfil | Baixar meus dados (LGPD). | Em uso |
| `auth/ForgotPasswordModal.tsx` | Login | "Esqueci minha senha". | Em uso |
| `performance/PersonalRecords.tsx` | Dashboard | Melhores tempos em 1, 5, 10, 21 e 42 km. | Em uso |
| `performance/EvolutionInsights.tsx` | Dashboard | Evolução por semana e por mês. | Em uso |
| `performance/PerformanceState.tsx` | os dois acima | Mensagens de "carregando" e erro dessas seções. | Em uso |
| `performance/HeartRateControls.tsx` | Corrida | Conectar sensor cardíaco. | Desligado |
| `performance/HeartRateInsights.tsx` | Dashboard | Zonas cardíacas. | Desligado |
| `sleep/SleepEntryForm.tsx`, `sleep/SleepCheckInForm.tsx` | Sono | Formulários de sono. | Desligado |
| `training/*.tsx` (5 arquivos) | Agenda, Home | Calendário, formulário, detalhes e card "próximo treino". | Em uso |
| `ui/sonner.tsx`, `ui/tooltip.tsx`, `ui/skeleton.tsx` | App, Feed, Dashboard | Avisos (toast), dicas e "esqueleto" de carregamento (shadcn/ui). | Em uso |

### `hooks/` — estado compartilhado

| Arquivo | Para que serve | Status |
|---|---|---|
| `AuthContext.tsx`, `auth-context.ts`, `useAuth.ts` | Quem está logado, para todas as telas. Também sincroniza a foto do Google. | Em uso |
| `useBackHandler.ts` | Faz um modal fechar com o botão voltar do Android. | Em uso |
| `useRunSamples.ts` | Guarda as amostras de tempo × distância da corrida (para os recordes). | Em uso |
| `usePerformanceSummary.ts` | Busca recordes e evolução. | Em uso |
| `usePullToRefresh.ts` | "Puxar para atualizar" no feed. | Em uso |
| `useHeartRateSensor.ts` | Conexão Bluetooth com o sensor cardíaco. | Desligado |

### `lib/` — regras puras (sem rede)

| Arquivo | Para que serve | Status |
|---|---|---|
| `gamification.ts` | Níveis e XP (cópia do backend, para exibir). | Em uso |
| `achievements.ts` | Lista de conquistas e quando cada uma é liberada. | Em uso |
| `pet.ts` | Espécies, acessórios, preços (cópia do backend), imagens. | Em uso |
| `coins.ts` | Pacotes de RunCoins (vitrine; o crédito vem do backend). | Em uso |
| `route.ts` | Distância entre pontos de GPS, filtro de ruído, redução de rota longa. | Em uso |
| `mapTiles.ts` | Qual mapa usar (CARTO com chave, senão Esri). | Em uso |
| `feed-utils.tsx` | Datas "há 2 h", iniciais do nome, selos das corridas. | Em uso |
| `user-photo.ts` | Escolhe a foto do Google; grava nome/foto no Firestore (ninguém lê esse dado). | Em uso (parte legada) |
| `image-resize.ts` | Reduz a foto escolhida para 400 px e converte para base64. | Em uso |
| `settings.ts` | Preferências locais (km ou milhas, perfil privado). | Em uso |
| `backButton.ts` | Pilha de ações do botão voltar. | Em uso |
| `coachHistory.ts` | Histórico da conversa com o treinador, guardado só no celular. | Em uso |
| `firebaseAuthErrors.ts` | Traduz os erros de login do Firebase. | Em uso |
| `training.ts`, `trainingRunSelection.ts` | Nomes das categorias de treino; treino escolhido para a próxima corrida. | Em uso |
| `performance.ts` | Formata duração (1:02:03). | Em uso |
| `utils.ts` | `cn()`: junta classes do Tailwind. | Em uso |
| `sleep.ts` | Textos de status do sono. | Desligado |

### `services/` — conversa com o backend

| Arquivo | Para que serve | Status |
|---|---|---|
| `apiClient.ts` | Toda chamada ao backend passa aqui: token, cache de 10 s, mensagens de erro. | Em uso |
| `serverWake.ts` | Chama `/health` até o Render acordar. | Em uso |
| `database.ts` | Só reexporta os `*Api.ts` (compatibilidade de imports antigos). | Em uso |
| `usersApi.ts` | Perfil, ranking, excluir conta. **Ainda lê o Firestore** a cada leitura de perfil. | Em uso (parte legada) |
| `activitiesApi.ts` | Salvar, apagar, curtir corrida; feed; estatísticas. | Em uso |
| `groupsApi.ts` | Grupos, posts, comentários, chat. Tem 3 **grupos de demonstração** falsos gravados no Firestore. | Em uso (parte legada) |
| `groupSocket.ts` | WebSocket do grupo (avisa quando chega mensagem). | Em uso |
| `eventsApi.ts` | Provas. Tem 3 **eventos de demonstração** falsos gravados no Firestore. | Em uso (parte legada) |
| `petApi.ts`, `coinsApi.ts` | Pet e pacotes de RunCoins. | Em uso |
| `shoesApi.ts`, `trainingApi.ts`, `plannedRun.ts` | Tênis, agenda, vincular corrida a treino. | Em uso |
| `chatbotApi.ts` | Mensagem para o treinador. | Em uso |
| `offlineRuns.ts` | Fila de corridas salvas sem internet. | Em uso |
| `auth.ts` | Login Google (web e Android), excluir conta. | Em uso |
| `dataExport.ts` | Monta e entrega o arquivo "meus dados". | Em uso |
| `recoveryApi.ts`, `sleepHealthConnect.ts` | Sono. | Desligado |
| `healthConnect.ts` | Importar corridas do relógio. | Desligado |
| `heartRateSensor.ts` | Lê o sensor cardíaco Bluetooth. | Desligado |

### `types/`

| Arquivo | Para que serve | Status |
|---|---|---|
| `index.ts` | Formatos dos dados (perfil, corrida, grupo...). Datas ainda tipadas como `Timestamp` do Firestore, mas chegam como texto. | Em uso |
| `training.ts` | Formatos da agenda. | Em uso |
| `sleep.ts` | Formatos do sono. | Desligado |

### `assets/`

| Pasta | Para que serve |
|---|---|
| `LogoNova-login.png` | Logo da tela de login. |
| `pets/*.webp` (6) | Ilustração de cada espécie. |
| `accessories/*.webp` (21) | Arte dos acessórios já desenhados (os outros aparecem como ícone). |

### `test/` — testes do frontend (37 arquivos)

O nome do arquivo diz o que ele testa: `feedPage.test.tsx` testa a tela do feed, `offlineRuns.test.ts` a fila offline, e assim por diante. `setup.ts` prepara o ambiente de teste. Rodar com `npx vitest run`.

---

## 5. Backend (`backend/`)

### Raiz

| Arquivo | Para que serve | Status |
|---|---|---|
| `requirements.txt` / `requirements-dev.txt` | Dependências de produção / dos testes. | Em uso |
| `render-start.sh` | O que o Render roda: aplica as migrações e sobe o servidor. | Em uso |
| `alembic.ini`, `alembic/env.py`, `alembic/script.py.mako` | Configuração das migrações. | Em uso |
| `alembic/versions/*.py` (14) | Cada mudança na estrutura do banco, em ordem. **Nunca editar uma que já está em produção.** | Em uso |
| `pytest.ini` | Configuração dos testes. | Em uso |
| `.env.example` | Modelo das variáveis (banco, projeto Firebase). | Em uso |
| `README.md` | Como rodar o backend. | Em uso |

### `app/` — núcleo

| Arquivo | Para que serve | Status |
|---|---|---|
| `main.py` | Cria a API, libera o CORS e monta todas as rotas. | Em uso |
| `config.py` | Lê as variáveis de ambiente. | Em uso |
| `database.py` | Conexão com o Postgres. | Em uso |
| `auth.py` | Confere o token do Firebase em cada requisição. | Em uso |
| `rate_limit.py` | Limite de ações por usuário (anti-spam). | Em uso |
| `ws_manager.py` | Conexões abertas do chat de grupo. | Em uso |
| `listing.py` | Tamanho máximo de página e filtro de perfil privado. | Em uso |
| `validators.py` | Confere se a imagem enviada é mesmo JPEG/PNG/WebP. | Em uso |
| `activity_rules.py` | Regras anti-fraude da corrida. | Em uso |
| `route_privacy.py` | Esconde o começo e o fim da rota para os outros. | Em uso |
| `gamification.py` | XP, nível e RunCoins. | Em uso |
| `pet_catalog.py` | Espécies, acessórios e preços do pet; pacotes de RunCoins. | Em uso |
| `shoe_rules.py` | Cálculo de desgaste do tênis. | Em uso |
| `user_stats.py` | Totais, sequência de dias, gráfico da semana. | Em uso |
| `performance.py` | Recordes, evolução e zonas cardíacas. | Em uso |
| `chatbot_logic.py` | Cérebro do treinador (≈300 linhas de textos + regras). | Em uso |
| `data_export.py` | Exportação LGPD (percorre todas as tabelas com dados do usuário). | Em uso |
| `time_utils.py` | `utcnow()` com fuso (evita data errada no banco). | Em uso |
| `purge_sleep.py` | Apaga dados de sono com mais de 90 dias. Não há agendamento no repositório. | Desligado |
| `schemas.py`, `schemas_*.py` | Formato de entrada e saída de cada rota. | Em uso |

### `app/routers/` — as URLs

| Arquivo | URLs | Status |
|---|---|---|
| `users.py` | `/users/...` perfil, ranking, exportar, excluir | Em uso |
| `activities.py` | `/activities/...` salvar, feed, curtir, apagar, estatísticas, recordes | Em uso |
| `groups.py` | `/groups/...` grupos, posts, comentários, chat, WebSocket | Em uso |
| `events.py` | `/events/...` provas e inscrição | Em uso |
| `pet.py` | `/users/{id}/pet/...` escolher, equipar, comprar | Em uso |
| `coins.py` | `/coins/...` pacotes e compra simulada | Em uso |
| `shoes.py` | `/shoes/...` | Em uso |
| `training.py` | `/training/...` agenda | Em uso |
| `chatbot.py` | `/chatbot/message` | Em uso |
| `products.py` | `/products` catálogo do marketplace | Sem tela (base do "trabalho futuro", ver `docs/BANCA_TRABALHOS_FUTUROS.md`) |
| `recovery.py` | `/recovery/...` sono | Desligado |
| `health_imports.py` | `/health-imports` corridas do relógio | Desligado |

### `app/services/` e `app/models/`

| Arquivo | Para que serve | Status |
|---|---|---|
| `services/activity_effects.py` | XP, RunCoins e km de grupo ao salvar/apagar corrida. **Regra auditada: não mexer sem teste.** | Em uso |
| `services/account_deletion.py` | Apaga tudo do usuário e passa os grupos dele para outro membro. | Em uso |
| `services/coin_purchases.py` | Crédito e estorno de pacotes de RunCoins. | Em uso |
| `services/shoes.py`, `services/training.py` | Regras de tênis e da agenda. | Em uso |
| `services/sleep.py` | Regras de sono. | Desligado |
| `models/*.py` | Uma classe por tabela: `user`, `activity`, `group` (grupos, membros, posts, comentários, mensagens), `event`, `shoe`, `training`, `chatbot`, `coin_purchase`, `product` (sem tela), `sleep` e `health_import` (desligados). | Em uso |

### `scripts/` — ferramentas para rodar à mão

| Arquivo | Para que serve | Status |
|---|---|---|
| `chatbot_cli.py` | Conversar com o treinador no terminal, sem banco. | Ferramenta |
| `copy_database.py` | Copiar o banco inteiro para outro (troca de região do Neon). | Ferramenta |
| `backup_db.ps1` | Backup do banco no Windows. | Ferramenta |
| `create_database.sql` | Estrutura do banco de 10/09: tem 10 tabelas, o banco real tem 19. **Desatualizado**; a fonte da verdade são as migrações. | Morto (ou mover para `docs/` como histórico) |

### `tests/` — testes do backend (29 arquivos)

`conftest.py` prepara o banco de teste (o nome precisa conter "test", porque a suíte apaga tudo entre os testes). `helpers.py` monta uma corrida válida. Os outros testam cada rota ou regra pelo nome: `test_groups.py`, `test_pet.py`, `test_parity.py` (confere backend = frontend em XP, pet e moedas). Rodar com `pytest`.

---

## 6. Android (`android/`)

Gerado pelo Capacitor; quase tudo é padrão. O que é do Runnex:

| Arquivo | Para que serve | Status |
|---|---|---|
| `app/build.gradle` | Versão do APK (`versionCode` / `versionName`) e dependências nativas. | Em uso |
| `app/src/main/AndroidManifest.xml` | Permissões (internet, GPS, notificação, serviço em segundo plano). | Em uso |
| `app/src/main/java/.../MainActivity.java` | Abre o app; registra os plugins do Health Connect. | Em uso |
| `RunnexHealthConnectPlugin.kt` | Lê corridas do relógio. | Desligado |
| `SleepHealthConnectPlugin.kt`, `SleepDuration.kt`, `HealthPermissionsActivity.java` | Lê sono do Health Connect; tela de permissão. | Desligado |
| `res/xml/sleep_backup_rules.xml`, `sleep_data_extraction_rules.xml` | Impedem o backup do Google de copiar dados do app. Valem para o app todo, apesar do nome. | Em uso |
| `res/xml/file_paths.xml` | Permite compartilhar o arquivo "meus dados". | Em uso |
| `res/values/*.xml`, `res/drawable*`, `res/mipmap*` | Nome do app, cores, ícone e tela de abertura. | Em uso |
| `app/src/test/.../SleepDurationTest.kt` | Teste do cálculo de sono. | Desligado |
| `app/src/test/.../ExampleUnitTest.java`, `app/src/androidTest/.../ExampleInstrumentedTest.java` | Testes de exemplo que vêm no modelo do Capacitor. | Morto |
| `google-services.json.example` | Modelo da configuração do Firebase no Android (o real fica fora do git). | Em uso |
| `gradlew`, `gradle/`, `*.gradle`, `gradle.properties`, `proguard-rules.pro` | Ferramenta de build do Android. | Em uso |

---

## 7. Outras pastas

| Pasta / arquivo | Para que serve | Status |
|---|---|---|
| `public/` | Ícones do PWA, `favicon.ico`, imagem de prévia de link e a página `excluir-conta/` (exigida pelo Google Play, abre sem login). | Em uso |
| `.github/workflows/ci.yml` | Roda lint, testes, build, migrações e testes das regras do Firestore a cada push. | Em uso |
| `.github/workflows/android.yml` | Compila o APK e roda os testes Android a cada push. | Em uso |
| `firestore-tests/` | Testes das regras do Firestore no emulador (projeto Node separado). Só existe por causa do Firestore legado. | Legado |
| `.claude/skills/weekly-report/` | Instruções para o Claude gerar o relatório semanal (`/weekly-report`). | Fora do app |
| `.claude/launch.json` | Atalho para o Claude subir o servidor de desenvolvimento. | Fora do app |
| `roteiros/` | Roteiros de uma série de vídeos curtos de divulgação (15 episódios) e a animação do EP 01 (`motion/ep01`, gerada com Playwright + ffmpeg). | Fora do app |

### `docs/`

| Arquivo | O que é | Ainda vale? |
|---|---|---|
| `MAPA_DO_PROJETO.md` | Este arquivo. | Sim |
| `ARCHITECTURE.md` | Arquitetura. Cita `productsApi.ts`, que não existe. | Sim (corrigir) |
| `TESTE_ANDROID.md` | Roteiro de teste em aparelho real. | Sim, **importante** |
| `TESTE_ANDROID_RESULTADOS.md` | Onde anotar o resultado do roteiro. **Ainda em branco.** | Sim, preencher |
| `BANCA_TRABALHOS_FUTUROS.md` | O que falar na banca sobre o marketplace. | Sim |
| `PERFORMANCE.md`, `CALENDARIO_TREINOS.md`, `CONTROLE_SONO.md` | Como funcionam recordes, agenda e sono. | Sim |
| `REVISAO_INTEGRACAO.md` | Como tênis, sono e agenda foram juntados (migrações). | Histórico |
| `PLANO_MELHORIAS.md` | Plano de 30/09 (mobile, LGPD, repositório). Várias partes já feitas. | Histórico |
| `PLANO_CALENDARIO_TREINOS.md` | Plano antes de fazer a agenda. | Histórico |
| `PLANO_CONTROLE_TENIS.md`, `controle-tenis-plano.md`, `reports/plano-controle-tenis-revisado.md` | **Três** planos do mesmo recurso (tênis), já entregue. | Histórico (pode juntar ou apagar dois) |
| `pet-arte-acessorios.md`, `pet-prompts-grades.md`, `preview-*.png` | Briefing e prévias da arte do pet. | Trabalho de arte em andamento |
| `reports/auditoria-refatoracao.md` | Auditoria de 12/11 (achados e plano de PRs). | Sim |
| `reports/weekly-report-*.md`, `relatorio-semanal-*`, `analise-tecnica-*.docx`, `prompt-plano-de-acao-*.md` | Relatórios semanais e análises antigas. | Histórico |

---

## 8. Resumo: o que é lixo e o que não é

**Morto (pode apagar sem mudar nada no app):**

- `backend/scripts/create_database.sql` (desatualizado)
- os dois testes de exemplo do Android

O `StatCard.tsx` e os imports sem uso já saíram no PR `chore/codigo-morto-e-lint`; os itens acima ficam para um PR separado (confirme antes se o documento do TCC usa o `create_database.sql`).

**Legado (sai junto, se vocês decidirem remover os grupos e eventos de demonstração):**

- o Firestore no frontend (`config/firebase.ts`, partes de `usersApi`, `groupsApi`, `eventsApi`, `user-photo`, `auth`, `dataExport`)
- `firestore.rules`
- `firestore-tests/`
- o job `firestore-rules` do CI

Depende da decisão de produto que está na auditoria (pergunta 2).

**Desligado (fica, por decisão de vocês):**

- sono, Health Connect, sensor cardíaco e música: telas, componentes, serviços, rotas do backend, plugins Android

Somam perto de 40 arquivos. São a maior parte dos "arquivos que ninguém sabe o que fazem".

**Fora do app (não atrapalha o app, mas confunde quem lê o repositório):**

- `roteiros/`
- `.claude/`
- a arte do pet em `docs/`
- relatórios antigos em `docs/reports/`

Sugestão: mover `roteiros/` e a arte para outro repositório ou pasta compartilhada; quem avalia o código do TCC vai abrir essa pasta e perguntar o que ela faz ali.
