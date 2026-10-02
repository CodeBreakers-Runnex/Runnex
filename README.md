# Runnex (Veloxy)

Aplicativo gamificado de corrida que combina tracking de atividades, comunidade, grupos com chat em tempo real, eventos e recompensas ligadas ao desempenho do corredor.

> "Runnex" é o nome do produto/app; "Veloxy" é o nome do repositório e do pacote npm — os dois aparecem na base de código.

## Visão Geral

O Runnex foi criado para transformar treinos em uma experiência mais social e orientada por dados. A aplicação permite registrar corridas com GPS real, acompanhar estatísticas, evoluir em níveis, participar de grupos e eventos e adotar um mascote virtual (pet) que evolui com os treinos e ganha acessórios comprados com a moeda do app (RunCoin).

## Funcionalidades

- Autenticação com e-mail/senha (com confirmação obrigatória de e-mail) e login com Google
- Registro de corrida com GPS real (foreground e background no Android), distância, tempo, ritmo, calorias e anti-cheat básico
- Feed de atividades da comunidade
- Dashboard com resumo de desempenho e gráfico semanal
- Sistema de XP, níveis e ranking global
- Grupos de corrida com feed de publicações e chat em tempo real (WebSocket)
- Eventos de corrida por localidade
- Perfil do usuário com foto, bio, localização e estatísticas
- Sistema de conquistas (achievements) calculadas a partir do histórico real de corridas
- Pet virtual gamificado: escolha de espécie, moeda própria (RunCoin) e loja de acessórios
- Treinador virtual: chatbot de corrida que responde com base nas corridas e na meta semanal do usuário
- PWA instalável e build nativo Android via Capacitor

> Marketplace/loja com checkout está fora do escopo deste ciclo — ver "Fora de escopo" no Roadmap.

## Stack

**Frontend**
- React 18 + Vite + TypeScript
- Tailwind CSS (com um pequeno conjunto de componentes shadcn/ui + Radix UI)
- React Router
- Firebase Authentication
- Cloud Firestore (uso residual — ver "Backend e migração" abaixo)
- Capacitor (build Android nativo) + vite-plugin-pwa
- Vitest + Testing Library

**Backend** (`backend/`)
- FastAPI + PostgreSQL (SQLAlchemy + Alembic)
- Verificação de token do Firebase Auth sem o Admin SDK (JWKS direto do Google)
- WebSocket para chat/feed/comentários de grupo em tempo real

Detalhes de setup e arquitetura do backend em [backend/README.md](backend/README.md).

## Estrutura

```text
src/
  assets/       Imagens e arquivos estaticos
  components/   Componentes reutilizaveis (inclui components/ui, base do design system)
  config/       Configuracoes externas, como Firebase
  content/      Conteudo estatico (termos de uso, politica de privacidade)
  hooks/        Contextos e hooks React
  lib/          Utilitarios e regras de negocio (gamificacao, conquistas, pet, etc.)
  pages/        Telas da aplicacao (auth/ e app/)
  services/     Acesso a dados, dividido por dominio (usersApi, activitiesApi,
                groupsApi, eventsApi, petApi, productsApi) + apiClient e groupSocket.
                database.ts e' um barrel que reexporta os arquivos acima, mantido
                para compatibilidade de import.
  test/         Setup e testes automatizados
  types/        Tipos compartilhados

backend/
  app/
    routers/    Endpoints da API, um arquivo por dominio (users, activities,
                groups, events, pet, products)
    models/     Modelos SQLAlchemy (schema Postgres)
    services/   Logica de negocio compartilhada entre routers
    auth.py     Verificacao do ID token do Firebase Auth
  alembic/      Migracoes do banco
```

Mais detalhes em [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) e [backend/README.md](backend/README.md).

## Backend e migração

O login é 100% Firebase Auth — o backend só valida o ID token recebido
(`backend/app/auth.py`), nunca emite ou gerencia sessão. Usuários, atividades,
grupos, eventos, pet e catálogo de produtos já são servidos pelo backend próprio
(`src/services/*Api.ts` chamando `apiClient.ts`). O que resta do Firestore no
frontend é pontual: leitura de campos legados de perfil (`usersApi.ts`) e
persistência de "entrar/sair" para os grupos e eventos de demonstração/fallback
(hardcoded, sem linha real no Postgres) em `groupsApi.ts`/`eventsApi.ts`. Não há
mais nenhuma leitura em tempo real via Firestore (`onSnapshot`) no projeto — o
feed usa polling contra o backend e o chat/feed de grupo usa WebSocket
(`groupSocket.ts` ↔ `backend/app/ws_manager.py`).

Esse estado muda com o tempo — para confirmar o que um domínio específico usa,
leia o `src/services/<dominio>Api.ts` correspondente em vez de confiar só neste
parágrafo.

## Como Rodar

### Frontend

1. Instale as dependências:

```bash
npm install
```

2. Crie o arquivo `.env.local` com base no `.env.example`.

3. Inicie o ambiente de desenvolvimento:

```bash
npm run dev
```

4. Acesse o endereço exibido no terminal.

### Backend

O frontend funciona parcialmente sem o backend rodando (login/Firebase continuam ativos), mas atividades, estatísticas, grupos, eventos e pet dependem dele. Setup completo em [backend/README.md](backend/README.md):

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env  # ajustar DATABASE_URL e FIREBASE_PROJECT_ID
.venv/bin/alembic upgrade head
.venv/bin/uvicorn app.main:app --reload
```

### Build Android (Capacitor)

1. Baixe o `google-services.json` do projeto no [console do Firebase](https://console.firebase.google.com/) (Configurações do projeto → Seus apps → app Android) e coloque em `android/app/google-services.json` (use `android/app/google-services.json.example` como referência do formato). Esse arquivo não é versionado.

```bash
npm run android:sync   # build web + sincroniza com o projeto Android
npm run android:apk    # idem, e ja gera o APK debug (Windows/gradlew.bat)
```

## Scripts

```bash
npm run dev          # inicia o app localmente
npm run typecheck    # checagem de tipos TypeScript
npm run build        # typecheck + build de producao
npm run preview      # previsualiza o build
npm run lint         # eslint + typecheck
npm run test         # executa testes (vitest)
npm run test:watch   # executa testes em modo observacao
npm run android:sync # build + sincroniza com o projeto Android (Capacitor)
npm run android:apk  # idem + gera APK debug
```

## Variáveis de Ambiente

Frontend (`.env.local`, ver `.env.example`):

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_API_URL          # URL do backend proprio (ex.: http://localhost:8000)
```

Nenhum desses valores é secreto — são identificadores de cliente do Firebase, protegidos pelas regras do Firestore/Storage e pelas restrições de domínio/pacote do próprio Firebase. Sem `VITE_API_URL` o app sobe, mas todas as chamadas que já usam o backend falham (ver "Backend e migração" acima).

Backend (`backend/.env`, ver `backend/.env.example`):

```text
DATABASE_URL
FIREBASE_PROJECT_ID
```

## Testes

```bash
npm run test                 # frontend: 52 testes (Vitest)
cd backend && pytest         # backend: 82 testes contra Postgres (ver backend/README.md)
```

Frontend cobre o cliente da API, grupos (incluindo o fallback de demonstração e o
WebSocket), pet, rota/GPS, gamificação, feed e autenticação. Backend cobre cada
domínio da API (permissões, privacidade, rate limit, exclusão de conta), as regras
de plausibilidade de corrida e a paridade das constantes duplicadas entre front e back.

O CI (`.github/workflows/ci.yml`) roda lint, testes e build do frontend e, no
backend, aplica as migrations num Postgres novo, confere `alembic check` e roda o pytest
a cada push.

O que só dá para testar num aparelho físico (GPS em segundo plano, login Google nativo,
recuperação após o Android matar o app) está em [`docs/TESTE_ANDROID.md`](docs/TESTE_ANDROID.md).

## Roadmap

- [x] Autenticação (e-mail/senha com confirmação obrigatória, e Google)
- [x] Estrutura base do app
- [x] Feed e dashboard inicial
- [x] Gamificação base (XP, níveis, conquistas)
- [x] Tracking real com GPS (foreground e background no Android)
- [x] Backend próprio (FastAPI + PostgreSQL) para usuários, atividades, grupos, eventos e pet
- [x] Grupos com feed de publicações e chat em tempo real (WebSocket)
- [x] Sistema de pet virtual (RunCoin, acessórios)
- [x] XP calculado no servidor, com validação de plausibilidade da corrida (velocidade, rota, limite diário)
- [x] Testes automatizados e CI (frontend e backend)
- [ ] Histórico avançado de atividades

### Fora de escopo (decisão do time)

- **Marketplace/loja com checkout e engine de descontos** — a proposta segue válida e é apresentada como trabalho futuro, mas foi retirada do escopo deste ciclo por falta de recursos (tempo/infra) para concluir com qualidade. Não é uma pendência por atraso, é um corte deliberado. Argumentação para a banca em [`docs/BANCA_TRABALHOS_FUTUROS.md`](docs/BANCA_TRABALHOS_FUTUROS.md).

## Equipe

- Cauã Morais Lima
- Joao Vitor da Silva Santos
- Marcelo Henrique Martins de Andrade
- Raphael Henrique Paiva Solina

## Orientadores

- Renato de Mattos Onofre
- Douglas de Cassio Quinzani Gaspar
