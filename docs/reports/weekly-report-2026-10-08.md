# Relatório Semanal de Desenvolvimento

**Projeto:** Runnex (código ainda nomeado "Veloxy" em vários pontos, ex.: `FastAPI(title="Veloxy API")`)
**Período:** 01/10/2026 → 08/10/2026
**Branch:** `claude/trusting-pascal-ey624i` (= `main`, commit `2aabfb4`) + branch `controle-tenis` (commit `00c938c`, PR [CodeBreakers-Runnex/Runnex#1](https://github.com/CodeBreakers-Runnex/Runnex/pull/1), aberto)
**Commits analisados:** 2 (1 snapshot sem histórico em `main` + 1 commit de funcionalidade em `controle-tenis`)

> **Aviso de método.** O script de coleta olha só a branch atual e encontrou 1 commit, com diffstat vazio, porque esse commit é a **raiz** do repositório (não tem pai para comparar). Foi o snapshot "Runnex beta 2.0" (02/10), descrito na própria mensagem como *"Snapshot do commit abe26b8 da branch beta-2.0 de SolinaDev/Veloxy, sem o historico anterior"*. Por isso não dá para separar, pelo Git, o que mudou entre 28/08 (último relatório) e 02/10: tudo aparece como "+43.050 linhas em 245 arquivos". A única mudança que dá para medir de verdade é o commit `00c938c` em `controle-tenis`, que foi analisado no diff completo. Onde este relatório compara com agosto, a comparação é feita **contra o texto do relatório anterior**, não contra o Git.

## 1. Resumo Executivo

Duas coisas aconteceram na semana. (1) Em 02/10 o projeto ganhou um repositório novo na organização `CodeBreakers-Runnex`, criado a partir de um snapshot da branch `beta-2.0` do repositório pessoal `SolinaDev/Veloxy`. O histórico anterior foi descartado. O estado importado é bem diferente do descrito em agosto: há um backend FastAPI + PostgreSQL com Alembic (`backend/`), um chatbot, e pet, atividades, grupos e eventos já passam pela API própria. Há também CI no GitHub Actions com 3 jobs (frontend, backend com Postgres, regras do Firestore no emulador). (2) Em 08/10, `mhh09` entregou o **controle de tênis** no PR [CodeBreakers-Runnex/Runnex#1](https://github.com/CodeBreakers-Runnex/Runnex/pull/1): tabela `shoes`, vínculo opcional corrida→tênis, API privada, tela "Meus tênis", seleção do tênis na corrida e alertas de desgaste. São +1.465/-9 linhas em 23 arquivos, com 10 testes de backend e testes de frontend. A entrega é sólida tecnicamente e o CI passou nos 3 jobs, mas **ainda não está em `main`**. O estado geral do projeto é estável e com CI verde. O ponto fraco da semana é de processo, não de código: a rastreabilidade se perdeu com o snapshot, e só uma pessoa entregou funcionalidade.

## 2. Principais Entregas

### Migração para o repositório da organização (snapshot "Runnex beta 2.0")

**O que foi feito:** foi criado o commit raiz `2aabfb4` em `CodeBreakers-Runnex/Runnex`, com 245 arquivos e +43.050 linhas. Ele contém o frontend React/Vite/Capacitor, o backend FastAPI (`backend/app`, 7 routers, 4 migrations Alembic), o CI (`.github/workflows/ci.yml`), testes de frontend (`src/test`), de backend (`backend/tests`, 15 arquivos) e das regras do Firestore (`firestore-tests/`). Também traz os relatórios anteriores e a análise técnica `docs/reports/analise-tecnica-2026-09-30.docx`.

**Por que foi feito:** Confirmado, pela mensagem do commit: é um snapshot do commit `abe26b8` da branch `beta-2.0` de `SolinaDev/Veloxy`, sem o histórico anterior. Inferência: a ideia provavelmente foi mover o projeto para um repositório do grupo, onde os outros integrantes (ex.: `mhh09`) podem abrir PRs.

**Impacto:** o grupo passou a ter um repositório comum com CI automático em toda branch e PR. Em troca, `git log`, `git blame` e `git bisect` não alcançam nada antes de 02/10.

**Arquivos principais:** todo o repositório. Os mais relevantes para entender o estado atual são `backend/app/routers/*.py`, `backend/alembic/versions/*`, `.github/workflows/ci.yml` e `src/services/*Api.ts`.

**Status:** Concluído

### Controle de tênis (quilometragem, desgaste e vínculo às corridas)

**O que foi feito:** a funcionalidade vai do banco à tela. Detalhes na seção 4.

**Por que foi feito:** Confirmado pela mensagem do commit e por `docs/PLANO_CONTROLE_TENIS.md`: o corredor passa a acompanhar a quilometragem dos tênis e é avisado quando o uso se aproxima do limite que ele mesmo escolheu.

**Impacto:** é uma funcionalidade nova visível para o usuário, e a primeira entregue por outro integrante via PR no repositório novo.

**Arquivos principais:** `src/pages/app/Shoes.tsx` (+623), `src/pages/app/RunTracking.tsx` (+78/-~9), `backend/tests/test_shoes.py` (+132), `src/test/shoes.test.tsx` (+159), `backend/app/routers/shoes.py` (+53), `backend/alembic/versions/f6b8c3d9e102_add_running_shoes.py` (+49), `backend/app/services/shoes.py` (+43), `docs/PLANO_CONTROLE_TENIS.md` (+120).

**Status:** Necessita revisão (PR aberto, CI verde, ainda não incorporado a `main`)

## 3. Bugs Corrigidos

Os dois itens abaixo vieram junto do commit de tênis em `RunTracking.tsx`. A mensagem do commit não os declara como correção.

### Corrida pendente recuperável por outra conta no mesmo aparelho

- **Problema:** o snapshot de corrida em andamento (`localStorage`, usado para recuperar treino após o Android fechar o app) não guardava o dono. Se outra conta entrasse no mesmo aparelho, poderia recuperar e salvar a corrida de outra pessoa.
- **Causa provável:** o `ActiveRunSnapshot` não tinha `userId`.
- **Solução aplicada:** o snapshot agora grava `userId` (e `shoeId`), e a recuperação ignora snapshots de outro `uid` (`if (snapshot.userId && snapshot.userId !== user.uid) return;`).
- **Arquivos envolvidos:** `src/pages/app/RunTracking.tsx`
- **Impacto da correção:** evita que uma corrida seja atribuída à conta errada em aparelho compartilhado. O backend já recusava `userId` diferente do token, mas o app usa sempre o `uid` atual, então o risco real era a corrida de A ser salva como de B.
- **Possíveis riscos de regressão:** snapshots antigos, sem `userId`, continuam recuperáveis por qualquer conta. É compatível de propósito, e o efeito some depois de uma corrida.

### Duplo clique em "Finalizar" podia disparar dois salvamentos

- **Problema:** `handleFinish` não verificava se já havia um salvamento em andamento, e o GPS e o cronômetro continuavam rodando durante o salvamento.
- **Causa provável:** faltava guarda de reentrância.
- **Solução aplicada:** `if (!user || isSaving) return;`, mais `setIsPaused(true)` antes de salvar e o botão de pausa desabilitado durante o salvamento.
- **Arquivos envolvidos:** `src/pages/app/RunTracking.tsx`
- **Impacto da correção:** reduz o risco de corrida duplicada, e com ela XP e km duplicados. O backend também limita a 10 criações a cada 10 minutos.
- **Possíveis riscos de regressão:** se o salvamento falhar, a corrida fica pausada, como documentado no comentário do código. O usuário precisa retomar ou tentar de novo manualmente.

## 4. Novas Funcionalidades

### Controle de tênis

- **Objetivo:** acompanhar o uso acumulado de cada tênis e avisar quando ele se aproxima do limite.
- **Funcionamento:** o usuário cadastra o tênis com nome, marca, modelo, data de compra, km anterior ao app e limite (padrão 600 km). Uso total = `initial_km` + soma das corridas vinculadas, calculada **na hora da consulta** (`list_shoes`), sem contador persistido. Assim, excluir ou reassociar uma corrida nunca dessincroniza o total. Os estados são calculados em `shoe_rules.py`:
  - `good`: abaixo de 80% do limite;
  - `attention`: a partir de 80%;
  - `worn`: a partir de 100% ou quando o usuário marca desgaste manual;
  - `retired`: aposentado.

  Só pode haver um tênis padrão por usuário. Isso é garantido por um índice único parcial no Postgres (`uq_shoes_default_per_user ... WHERE is_default`) e por um `SELECT ... FOR UPDATE` no usuário (`lock_owner`). A CHECK `NOT (retired AND is_default)` impede um tênis aposentado de ser o padrão.
- **Principais componentes envolvidos:** `Shoes.tsx` (tela "Meus tênis" com formulário, progresso e correção do tênis das últimas 50 corridas), `ShoeStatusBadge.tsx`, o seletor de tênis em `RunTracking.tsx` (pré-seleciona o padrão e só deixa trocar com a corrida pausada), entrada no `Profile.tsx` e no `SideNav.tsx`, e a rota `/tenis` em `App.tsx`.
- **Integração com backend/API/banco:** `GET/POST /shoes`, `PUT /shoes/{id}`, `PUT /activities/{id}/shoe` e o campo opcional `shoeId` em `POST /activities`. Nova tabela `shoes`, coluna `activities.shoe_id` com FK `ON DELETE SET NULL` e migration `f6b8c3d9e102`. A posse do tênis é validada no servidor (`owned_shoe` filtra por `user_id`), e as escritas exigem e-mail verificado.
- **Estado atual:** implementado e testado na branch, com CI verde. **Não está em produção nem em `main`.**
- **O que ainda falta:**
  - revisão e merge do PR;
  - rodar a migration no banco de produção (o `render-start.sh` já faz isso no deploy);
  - excluir um tênis cadastrado por engano. Não existe `DELETE /shoes/{id}`, só aposentar, e o plano trata isso como decisão de design;
  - paginação para corrigir corridas além das 50 mais recentes (citada no próprio plano como evolução futura).

## 5. Refatorações e Melhorias Técnicas

- **Uso calculado por agregação, não por contador** (`backend/app/services/shoes.py`): é a decisão técnica mais acertada da entrega. O comentário no código explica o motivo, e os testes `test_saved_runs_add_only_to_selected_shoe_and_deletion_recomputes` e `test_reassignment_is_idempotent_and_keeps_xp` comprovam. Elimina uma classe inteira de bugs de dessincronia. O custo é uma agregação por listagem, irrelevante no volume esperado por usuário.
- **Integridade empurrada para o banco:** CHECK constraints de faixa (`initial_km`, `limit_km`), índice único parcial e FKs com `CASCADE`/`SET NULL`. Os mesmos limites também estão no Pydantic (`ShoeInput`, `extra="forbid"`, `allow_inf_nan=False`). É validação em duas camadas, com a camada do banco como garantia final.
- **Efeito no snapshot de corrida:** a dependência `[user?.uid]` foi adicionada aos efeitos de recuperação e gravação do snapshot (ver seção 3).

## 6. Banco de Dados e Backend

- **Nova tabela `shoes`** (migration `f6b8c3d9e102`, `down_revision = d48faef56a35`), com índices `ix_shoes_user_id` e `uq_shoes_default_per_user` (parcial).
- **Nova coluna `activities.shoe_id`** (nullable, FK `ON DELETE SET NULL`, indexada). A migration não faz backfill: corridas antigas ficam sem tênis de propósito, e o teste `test_only_one_default_per_user_and_no_automatic_historical_assignment` cobre isso.
- **A migration não é destrutiva.** O `downgrade` remove a tabela e a coluna, ou seja, perderia os dados de tênis se fosse executado.
- **Novos endpoints:**
  - `GET /shoes` (autenticado);
  - `POST /shoes` (e-mail verificado, 30 por hora);
  - `PUT /shoes/{id}` (60 por minuto);
  - `PUT /activities/{id}/shoe` (60 por minuto, `FOR UPDATE` na atividade).
- **`ActivityOut` ganhou `shoeId`.** Isso afeta todas as rotas que devolvem atividades, inclusive `/activities/feed` e `/activities/by-users`, que mostram corridas de outros usuários (ver seção 8).
- **Contexto do snapshot (não é mudança desta semana, mas é o estado atual):** o backend tem 4 migrations anteriores e routers de `users`, `activities`, `groups`, `events`, `pet`, `products` e `chatbot`. O frontend ainda é **híbrido**: `groupsApi.ts`, `usersApi.ts`, `eventsApi.ts`, `auth.ts`, `feed-utils.tsx` e `user-photo.ts` ainda importam `firebase/firestore`, ao lado das chamadas à API própria.

## 7. Frontend e UI/UX

- **Nova tela "Meus tênis"** (`/tenis`): cadastro e edição, barra de progresso, estados com badge colorido, marcação do padrão, aposentar e reativar, e a seção "Tênis das corridas recentes" para corrigir vínculos. Tem estados de carregamento e erro (`Loader2`, `RefreshCw`, `errorMessage`).
- **Seletor na tela de corrida:**
  - mostra o tênis padrão pré-selecionado, o badge de estado e "X / Y km";
  - avisa quando o tênis está em "atenção" ou "gasto" antes do treino;
  - só permite trocar com a corrida pausada;
  - mostra mensagem clara quando a lista de tênis falha, e a corrida continua possível sem vínculo;
  - o botão Iniciar fica desabilitado enquanto os tênis carregam.
- **Aviso pós-corrida:** se o tênis vinculado passou para "atenção" ou "gasto", aparece um toast de 8 s. Falhas nessa consulta são engolidas de propósito, para não transformar uma corrida salva em erro.
- **Navegação:** entrada em Perfil e no menu lateral do desktop. **Não há entrada na `BottomNav` (celular).** No celular só se chega pela tela de Perfil ou pelo atalho na tela de corrida. Inferência: parece decisão consciente, dado o número de itens da barra inferior.

## 8. Segurança

🟢 **Baixo (vazamento de metadado):** `ActivityOut.shoe_id` é devolvido também em `/activities/feed` e `/activities/by-users`, que listam corridas de outros usuários. O plano declara os tênis como "privados". Hoje só vaza o **ID numérico** do tênis, não nome nem marca, porque `GET /shoes` só lista os do próprio usuário (testado em `test_shoes_and_assignments_are_private`). O impacto prático é mínimo, mas contradiz a regra declarada e permite inferir quantos tênis existem no sistema, já que os IDs são sequenciais. Recomendação: omitir `shoeId` quando a atividade não é do usuário autenticado, ou usar um schema separado para o feed.

Pontos confirmados como **corretos** no diff:

- todas as escritas exigem `require_verified_email`;
- a posse do tênis e da atividade é validada no servidor, com filtro por `user_id`;
- há rate limit nos 4 endpoints novos;
- `extra="forbid"` no input;
- excluir a conta remove os tênis, por cascade, testado em `test_deleting_all_runs_keeps_initial_km_and_account_deletion_cascades`.

## 9. Dependências e Configurações

- **Commit de tênis:** nenhuma dependência nova, nem no `package.json` nem no `requirements.txt`.
- **Snapshot (estado atual, não é uma diferença mensurável):** o CI tem 3 jobs.
  - Frontend: Node 22, `npm ci`, lint, test, build.
  - Backend: Python 3.12 com Postgres 16, `alembic upgrade head`, **`alembic check`** (falha se faltar migration) e `pytest`.
  - Firestore: regras testadas no emulador, com Java 21.
- **Aviso no CI:** *"Node.js 20 is deprecated… actions/checkout@v4, actions/setup-python@v5"*. Hoje é só aviso. Atualizar para versões das actions baseadas em Node 24 evita quebra futura.
- **Script `android:apk`:** usa `gradlew.bat`, ou seja, só funciona no Windows. Já existia antes, mas vale anotar para quem buildar em Linux ou macOS.

## 10. Testes e Qualidade

**Execução local nesta análise: não foi possível.** O container não tem `node_modules` nem as dependências Python (`fastapi` ausente), e a skill proíbe instalar dependências. A suíte de backend também exige um Postgres com "test" no nome do banco (`conftest.py` aborta caso contrário). Nenhum resultado abaixo veio de execução local.

**Evidência usada: GitHub Actions** (consultado via API nesta análise):

| Run | Commit | Branch / evento | Frontend (lint+test+build) | Backend (migrations+check+pytest) | Regras Firestore |
|---|---|---|---|---|---|
| #5 (37772168843) | `00c938c` | controle-tenis / PR #1 | ✅ | ✅ | ✅ |
| #4 | `00c938c` | controle-tenis / push | ✅ | ✅ | ✅ |
| #2 | `2aabfb4` | main / push | ✅ | ✅ | ✅ |
| #6 | `2aabfb4` | controle-de-sono / push | ✅ | ✅ | ✅ |

**Testes adicionados nesta semana (commit de tênis):**

- `backend/tests/test_shoes.py`: 10 funções, algumas parametrizadas. Cobrem:
  - autenticação e exigência de e-mail verificado;
  - dados inválidos;
  - limites exatos de 80% e 100%;
  - desgaste manual e aposentadoria;
  - padrão único;
  - ausência de vínculo retroativo;
  - soma e recálculo após exclusão;
  - reassociação idempotente sem duplicar XP;
  - privacidade entre contas;
  - cascade na exclusão de conta.
- `src/test/shoes.test.tsx` (+159 linhas): testes da interface.

A cobertura dessa entrega é boa, acima da média do resto do projeto. **Lacuna:** a lógica nova de `RunTracking.tsx` (recuperação de snapshot por usuário, guarda de duplo salvamento, preservação do tênis ao recuperar) não tem teste dedicado. Não existe `RunTracking.test.tsx`.

## 11. Git e Histórico

- **2 commits no período**, de 2 autores:
  - `2aabfb4`: snapshot, empurrado por `SolinaDev` em 02/10 e gerado numa sessão do Claude;
  - `00c938c`: controle de tênis, de `mhh09`, em 08/10.
- **Branches remotas:**
  - `main`, `controle-de-sono` e `claude/trusting-pascal-ey624i` apontam todas para o snapshot;
  - `controle-tenis` está 1 commit à frente.
- **`controle-de-sono` existe, mas não tem nenhum commit próprio.** Foi criada e empurrada em 08/10 (run #6), mas o trabalho ainda não foi enviado.
- **Commit gigante:** o snapshot (+43.050 linhas, 245 arquivos) é, por definição, impossível de revisar como diff. Isso é consequência do achatamento de histórico, não um problema de código.
- **O commit de tênis é exemplar como unidade de entrega:** uma funcionalidade, mensagem descritiva no corpo, plano de ação em `docs/`, migration, testes nas duas camadas e PR aberto antes do merge.

## 12. Problemas Encontrados

🟡 **Moderado: histórico do projeto descartado no repositório da organização.**
- **Evidência:** `2aabfb4` é o commit raiz, e a mensagem diz "sem o historico anterior".
- **Impacto:**
  - `git blame` e `git bisect` não chegam a nada antes de 02/10;
  - a autoria individual de cada integrante antes de outubro sumiu deste repositório, o que pesa se a avaliação do trabalho em grupo olhar contribuições no GitHub;
  - este relatório não consegue medir o que mudou entre 28/08 e 02/10.
- **Recomendação:** garantir que `SolinaDev/Veloxy` continue preservado, sem ser apagado, como fonte do histórico. Se a autoria importar para a banca, citar esse repositório no README.

🟡 **Moderado (inferência, precisa de verificação): perfil pode ser criado com nome "Corredor".**
- **Evidência:** `lock_owner` em `backend/app/routers/shoes.py` chama `get_or_create_user(db, uid, "Corredor", None)`. Quando o usuário ainda não existe no Postgres, o registro é criado com `display_name="Corredor"` e sem foto. Depois disso, `get_or_create_user` nunca atualiza o nome de um usuário que já existe.
- **Cenário:** uma conta Google que cadastra um tênis antes da primeira corrida ou antes de criar o perfil fica no banco como "Corredor".
- **Impacto:** nome genérico em qualquer tela que leia `users.display_name` (ex.: membros de grupo). Não verifiquei se o fluxo de perfil (`POST /users`) sobrescreve esse valor depois.
- **Recomendação:** testar o cenário. Se confirmado, usar o nome do token Firebase ou fazer o fluxo de perfil atualizar o registro.

🟡 **Moderado: componentes de tela muito grandes.**
- **Evidência:** `RunTracking.tsx` tinha 959 linhas e passa de ~1.030 com o PR; `Profile.tsx` tem 886, `Group.tsx` 831 e o novo `Shoes.tsx` 623.
- **Impacto:** revisão difícil e chance maior de conflito de merge, agora que mais de uma pessoa mexe no repositório (o PR de tênis tocou `RunTracking.tsx` e `Profile.tsx`).
- **Recomendação:** extrair o seletor de tênis de `RunTracking` para um componente próprio na próxima mudança nessa tela.

🟢 **Baixa prioridade:** `shoeId` exposto no feed público (ver seção 8).

🟢 **Baixa prioridade: não é possível excluir um tênis cadastrado por engano.**
- **Evidência:** não existe rota DELETE. Aposentar é a única saída, e o tênis continua na lista.

🟢 **Baixa prioridade: actions do CI em Node 20 descontinuado** (ver seção 9).

## 13. Pontos de Atenção

- **PR [CodeBreakers-Runnex/Runnex#1](https://github.com/CodeBreakers-Runnex/Runnex/pull/1) aberto e sem revisão registrada.** A funcionalidade só "existe" depois do merge e do deploy na ordem certa: backend com migration primeiro, depois o frontend, como diz o próprio plano.
- **Branch `controle-de-sono` vazia.** Há trabalho anunciado sem nenhum código no remoto. Não foi possível avaliar o andamento.
- **Arquitetura de dados híbrida (Firestore + Postgres).** Seis arquivos do frontend ainda usam Firestore diretamente. Duas fontes de verdade aumentam o custo de cada funcionalidade nova e a superfície de regras de segurança: o projeto mantém `firestore.rules` com 340 linhas **e** autorização no FastAPI.
- **Nome inconsistente ("Runnex" × "Veloxy")** no código, no título da API e nos nomes de banco (`veloxy_test`). Não é bug, mas confunde quem chega ao projeto.
- **Lógica nova de `RunTracking` sem teste** (ver seção 10).

## 14. Recomendações

🔴 **Prioridade alta**

- Revisar e fazer merge do PR [CodeBreakers-Runnex/Runnex#1](https://github.com/CodeBreakers-Runnex/Runnex/pull/1). O CI está verde e a entrega está bem testada. Deixá-lo parado só aumenta a chance de conflito em `RunTracking.tsx` e `Profile.tsx`.
- Antes do merge, verificar o caso "Corredor" (seção 12). É barato de testar e evita dado ruim persistido em produção.

🟡 **Prioridade média**

- Remover `shoeId` das respostas de atividades de terceiros, para alinhar o código à regra "tênis são privados".
- Preservar `SolinaDev/Veloxy` e referenciá-lo no README como origem do histórico.
- Escrever teste para a recuperação de snapshot por usuário e para a guarda de duplo salvamento em `RunTracking`.

🟢 **Prioridade baixa**

- Atualizar `actions/checkout` e `actions/setup-python` para versões em Node 24.
- Decidir se o tênis precisa de "excluir" além de "aposentar".
- Extrair o seletor de tênis de `RunTracking.tsx` para um componente.

## 15. Próximos Passos

1. **Revisar e incorporar o PR de controle de tênis**
   - Motivo: é a única entrega da semana e está pronta, com CI verde.
   - Impacto esperado: a funcionalidade chega a `main`, e as próximas branches partem de uma base que já tem a tabela `shoes`. **Isso desbloqueia o passo 2.**
2. **Deploy na ordem: backend com migration, depois frontend e app Android**
   - Motivo: o frontend novo envia `shoeId` e chama `/shoes`. Sem o backend atualizado, a tela de corrida mostra erro ao carregar os tênis. O app trata o erro, mas a funcionalidade fica inutilizável.
   - Impacto esperado: funcionalidade disponível para os usuários reais.
3. **Empurrar o trabalho de `controle-de-sono`, mesmo incompleto, como PR em rascunho**
   - Motivo: a branch existe vazia. Trabalho que fica só na máquina de alguém não tem CI nem revisão e se perde.
   - Impacto esperado: visibilidade do andamento e detecção cedo de conflito com o PR de tênis.

## 16. Evolução do Projeto

*Avaliação técnica aproximada, não uma métrica objetiva. "Início" é o estado de `main` em 02/10 (snapshot). "Final" é `main` + PR de tênis. Não há base Git para comparar com agosto.*

| Dimensão | Início da semana | Final da semana | Observação |
|---|---|---|---|
| Funcionalidades | 4 | 4-5 | Tênis é adição real, mas ainda não está em `main` |
| Estabilidade | 4 | 4 | CI verde em todos os runs. Duas correções pequenas em `RunTracking` |
| Arquitetura | 3 | 3 | Backend próprio com migrations é um salto em relação a agosto, mas o frontend segue híbrido (Firestore + API) |
| Segurança | 4 | 4 | Autorização no servidor, rate limit e e-mail verificado. Vazamento menor de `shoeId` no feed |
| Qualidade do código | 4 | 4 | Entrega de tênis bem estruturada. Componentes de tela continuam grandes |
| UX/UI | 4 | 4 | Tela nova com estados de erro e carregamento bem tratados |
| Testes | 4 | 4 | Backend com Postgres real no CI e `alembic check`. Tênis bem coberto, `RunTracking` não |
| Performance | 3 | 3 | Sem mudança relevante. Agregação de km por listagem é aceitável no volume atual; não medido |

## 17. Resumo para Apresentação

**Esta semana**
- ✅ Controle de tênis completo (banco, API, tela, seleção na corrida, alertas de 80% e 100%), com PR aberto e CI verde
- ✅ Corrida recuperada após o app fechar não vaza mais entre contas no mesmo aparelho; duplo salvamento bloqueado
- 🔧 Projeto migrado para o repositório da organização com CI de 3 jobs (frontend, backend + Postgres, regras Firestore)
- 🎨 Nova tela "Meus tênis" e seletor de tênis na tela de corrida
- 🛡️ API de tênis com posse validada no servidor, e-mail verificado e rate limit

**Próxima semana**
- 🎯 Merge e deploy do controle de tênis (backend com migration antes do frontend)
- 🎯 Primeiro PR do controle de sono
- 🎯 Corrigir os dois pontos pequenos de tênis (nome "Corredor" e `shoeId` no feed)

---

## Comparação com semanas anteriores

Com base nos relatórios de 17/08 e 28/08. A comparação é contra o texto deles, porque o Git não tem histórico antes de 02/10.

**Resolvido desde 28/08**

- 🔴 **Bug de permissão ao adotar pet** (crítico em 28/08): **tornou-se irrelevante.** `src/services/petApi.ts` não usa mais Firestore. `choosePet`, `purchasePetAccessory` e `equipPetAccessory` agora chamam `POST/PUT /users/{id}/pet/*` no backend próprio, e o bug era de regra do Firestore. Não dá para afirmar que a causa original foi entendida, só que o caminho de código onde ela acontecia não existe mais.
- 🟠 **"Nenhuma das funcionalidades novas (grupo, pet) tem teste":** resolvido. Existem `src/test/groupsApi.test.ts`, `src/test/pet.test.ts`, `backend/tests/test_groups.py` e `backend/tests/test_pet.py`.
- **Push direto do Claude ao GitHub:** resolvido. O snapshot foi empurrado a partir de uma sessão do Claude, e o fluxo de cópia manual de arquivos citado em agosto não aparece mais.
- **Reaceite de termos:** resolvido. `TermsGate.tsx` compara `profile.termsVersion` com `LEGAL_VERSION` e pede reaceite com `reason: "update"`.
- **Aviso `exhaustive-deps` em `Pet.tsx`:** resolvido. `purchasedAccessoryIds` agora usa `useMemo` (`Pet.tsx:172`).

**Padrões recorrentes**

- **Componentes de tela grandes:** apontado em agosto (`Group.tsx`, `Pet.tsx`) e ainda presente (`RunTracking.tsx`, `Profile.tsx`, `Group.tsx` acima de 800 linhas, e mais um de 623 entrando).
- **Rastreabilidade fraca:** em agosto, um commit chamado "67" e um arquivo apagado por engano. Agora, histórico inteiro descartado. O problema mudou de forma, mas é o mesmo: o histórico do Git não tem sido tratado como algo a preservar. O commit de tênis de `mhh09` é o contraexemplo, e vale usá-lo como padrão do grupo.

**Mudança de patamar não registrada.** Entre 28/08 e 02/10 o projeto saiu de "Firebase puro" para "FastAPI + Postgres + Alembic + CI com 3 jobs". É a maior mudança arquitetural do projeto, e nenhum relatório semanal a documentou. A análise técnica `docs/reports/analise-tecnica-2026-09-30.docx` provavelmente cobre parte disso, mas não foi lida nesta análise.
