# Veloxy API

Backend próprio (FastAPI + PostgreSQL) substituindo Firestore e Storage.
Firebase Auth e Hosting continuam — ver `docs/` do repo raiz para o plano completo de migração.

## Setup local

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env  # ajustar DATABASE_URL e FIREBASE_PROJECT_ID
.venv/bin/alembic upgrade head
.venv/bin/uvicorn app.main:app --reload
```

## Testes

```bash
createdb veloxy_test   # banco separado: a suite apaga os dados entre os testes
.venv/bin/pip install -r requirements-dev.txt
DATABASE_URL=postgresql+psycopg://postgres@localhost:5432/veloxy_test .venv/bin/pytest
```

A suíte (`tests/`) roda contra Postgres de verdade, com o schema criado pelas
migrations do Alembic, e se recusa a rodar se o nome do banco não contiver `test`.
Cobre a API de cada domínio (permissões, privacidade, rate limit, WebSocket do grupo,
exclusão de conta), as regras puras (plausibilidade de corrida, validação de imagem,
XP) e a paridade das constantes duplicadas entre `src/lib/*.ts` e o backend.
Roda no CI a cada push (`.github/workflows/ci.yml`), junto com `alembic check`.

## Estrutura

- `app/models/` — SQLAlchemy models (schema Postgres da Fase 0 do plano de migração).
- `app/auth.py` — valida o ID token do Firebase Auth direto contra o JWKS do Google, sem Admin SDK.
- `alembic/` — migrations versionadas do schema.

## Autenticação

A API não emite nem gerencia login — isso continua 100% no Firebase Auth do frontend.
Cada request autenticada envia `Authorization: Bearer <id_token>` e o middleware em
`app/auth.py` valida a assinatura e expiração. `require_verified_email` bloqueia
endpoints sensíveis para contas de email/senha que não confirmaram o email (Fase 1.5).

## Rate limit

Todo endpoint de escrita declara um limite por usuário via
`dependencies=[Depends(rate_limit("bucket", max_chamadas, janela_em_segundos))]`
(`app/rate_limit.py`). Estourar o limite devolve `429` com header `Retry-After`.
A contagem é por `uid` do Firebase (não por IP, que atrás do proxy do Render seria
o mesmo para todo mundo) e vive na memória do processo — funciona com uma única
instância; para escalar horizontalmente, o armazenamento precisa ir para Redis.

## Validação de corridas

`POST /activities` recusa com `422` (mensagem em texto) corridas implausíveis
(`app/activity_rules.py`): velocidade média acima de 30 km/h (mesmo limite do
anti-cheat de GPS do app), rota com menos de 2 pontos, distância maior que a rota
enviada (com folga de 30% + 200 m para a decimação de rotas longas) e mais de 24h
de corrida somadas nas últimas 24 horas. Isso limita o XP que um cliente
adulterado consegue gerar, mas não impede quem fabricar uma rota coerente.

## Treinador virtual (chatbot)

`POST /chatbot/message` responde perguntas de corrida com um motor de regras
(`app/chatbot_logic.py`, sem LLM nem chave de API). Estatísticas, histórico, recordes
e o pace usado em zonas e tempo estimado saem das corridas reais do usuário;
`meta: 20` grava a meta semanal do perfil (`users.weekly_goal_km`). Corridas não são
registradas pelo chat — só pelo GPS, para passar por `activity_rules.py`. Em
`chatbot_profiles` fica apenas a memória da conversa (pace informado, objetivo,
respostas ensinadas com `aprender:`). Para testar respostas no terminal, sem banco
nem login: `python scripts/chatbot_cli.py`.

## Exclusão de conta

`DELETE /users/{uid}` (só o próprio usuário) apaga do Postgres perfil, corridas, pet,
participações, posts, comentários, mensagens e a memória do treinador virtual
(`app/services/account_deletion.py`).
Grupos criados pelo usuário passam para o membro mais antigo e só são apagados se
ficarem vazios; o uid também sai das curtidas alheias. O login no Firebase Auth é
apagado pelo app logo depois (`deleteCurrentAccount` em `src/services/auth.ts`),
após reautenticar o usuário — o backend não usa Admin SDK.
