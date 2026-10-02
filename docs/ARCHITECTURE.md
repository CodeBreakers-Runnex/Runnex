# Arquitetura

O Runnex e um aplicativo React/Vite com Firebase Authentication para login e um
backend proprio (FastAPI + PostgreSQL, em `backend/`) para usuarios, atividades,
grupos, eventos e pet. Cloud Firestore hoje e usado so para dados legados e para
os grupos/eventos de demonstracao (fallback). Ver "Backend e migracao" abaixo e
`backend/README.md` para detalhes.

## Organizacao

```text
src/
  assets/       Imagens e arquivos estaticos usados pela interface
  components/   Componentes compartilhados da aplicacao
  components/ui Componentes base do design system
  config/       Inicializacao de SDKs e configuracoes externas
  content/      Conteudo estatico (termos de uso, politica de privacidade)
  hooks/        Contextos e hooks React reutilizaveis
  lib/          Funcoes utilitarias e regras de dominio
  pages/        Telas agrupadas por area da aplicacao
  services/     Acesso a dados, um arquivo por dominio (usersApi, activitiesApi,
                groupsApi, eventsApi, petApi, productsApi) + apiClient e
                groupSocket. database.ts e' um barrel que reexporta os demais,
                mantido so por compatibilidade de import.
  test/         Setup e testes automatizados
  types/        Tipos TypeScript compartilhados
```

## Fluxo principal

1. `src/main.tsx` inicia a aplicacao.
2. `src/App.tsx` registra provedores globais e rotas.
3. `src/config/firebase.ts` centraliza as instancias do Firebase (Auth + Firestore residual).
4. `src/services/*Api.ts` concentra leitura e escrita de dados, um arquivo por
   dominio (`usersApi.ts`, `activitiesApi.ts`, `groupsApi.ts`, `eventsApi.ts`,
   `petApi.ts`, `productsApi.ts`), falando majoritariamente com o backend
   proprio (via `apiClient.ts`) e, pontualmente, com o Firestore — ver
   "Backend e migracao" abaixo.
5. `src/pages/*` monta as experiencias de login, feed, corrida, grupos, eventos,
   pet e perfil. (A loja/marketplace esta fora de escopo deste ciclo — ver
   Roadmap no README.)

## Backend e migracao

`backend/` e uma API propria (FastAPI + PostgreSQL + Alembic). O login continua
100% no Firebase Auth: o backend so valida o ID token recebido
(`backend/app/auth.py`), nao emite nem gerencia sessao.

Usuarios, atividades, grupos, eventos, pet e catalogo de produtos ja sao
servidos pelo backend proprio. Nao ha nenhuma leitura em tempo real via
Firestore (`onSnapshot`) no projeto atualmente — confirmado por busca direta
no codigo (`grep onSnapshot src/services`, sem resultados): o feed global faz
polling contra o backend (`GET /activities/feed`) e o feed/chat de grupo usa
WebSocket (`src/services/groupSocket.ts` <-> `backend/app/ws_manager.py`), nao
Firestore. O que resta de Firestore no frontend e pontual:

- `usersApi.ts`: leitura de `joinedGroupIds`/`enrolledEvents` legados, mesclados
  com os dados reais do backend em `getUserProfile`.
- `groupsApi.ts` / `eventsApi.ts`: `joinGroup`/`leaveGroup`/`joinEvent` gravam
  no Firestore só para os grupos/eventos de demonstracao (hardcoded, sem linha
  real no Postgres) — para os reais, vao direto no backend.
- `productsApi.ts` e `petApi.ts` ja sao 100% backend (nenhum import de Firestore).

Isso muda com o tempo — para saber o estado exato de um dominio, olhe o arquivo
`src/services/*Api.ts` correspondente em vez de confiar numa lista fixa aqui ou
no comentario do `.env.example` (nenhum dos dois e a fonte da verdade, so uma
pista).

O backend tambem expoe rotas para dominios que o frontend ainda nao teria motivo pra
usar (`backend/app/main.py`) — antes de mexer numa rota "sem uso aparente", confirme
com quem escreveu se e trabalho em andamento ou codigo esquecido.

Setup e mais detalhes: `backend/README.md`.

## Convencoes

- Use o alias `@/` para imports dentro de `src`.
- Crie integracoes externas em `src/services`.
- Crie regras puras de negocio em `src/lib`.
- Mantenha componentes reutilizaveis em `src/components`.
- Mantenha componentes especificos de uma tela perto da propria tela quando o volume crescer.
