# Relatório Semanal de Desenvolvimento

**Projeto:** Runnex (CodeBreakers-Runnex/Runnex)
**Período:** 13/10/2026 → 23/10/2026
**Branch:** main
**Commits analisados:** 25 (todos em 15 e 16/10; nenhum commit entre 17 e 23/10)

> **Sobre o período:** começa logo depois do relatório de auditoria de 12/10 (`relatorio-semanal-2026-10-12.md`). Esse relatório não segue o padrão de nome `weekly-report-*` e, por isso, o script da skill não o reconhece; o período foi definido à mão para não deixar lacuna. Parte do código que entrou na `main` foi escrita entre 08 e 09/10 em branches de feature. Ela aparece aqui porque só chegou à `main` neste período, via PR #7.

## 1. Resumo Executivo

O período foi de **integração, não de desenvolvimento novo**. Sete features que estavam paradas em branches separadas foram juntadas na branch `beta-2.1`, testadas em conjunto e mergeadas na `main` pelo PR #7 (16/10): tênis, sono, calendário de treinos, evolução, recordes, zonas cardíacas por sensor BLE e importação de corridas do relógio via Health Connect. No caminho foram corrigidos dois problemas que quebrariam a produção: migrações do Alembic com várias "versões finais" (`alembic upgrade head` falharia no deploy) e três bugs na importação do relógio, dois deles envolvendo XP e RunCoins. O backend foi publicado no Render em 16/10 e as migrações rodaram no Neon, depois de um ensaio numa cópia do banco. Volume líquido: **120 arquivos, +7.170/−34 linhas**. **De 17 a 23/10 não houve nenhum commit.** Continuam em aberto: o teste em aparelho Android (pendente desde 12/10), a confirmação de que o frontend web foi publicado e vários itens de desempenho e segurança da auditoria anterior.

## 2. Principais Entregas

### Integração das features em uma única versão (beta 2.1 → main)

**O que foi feito:** 5 merges na `beta-2.1` (15/10), na ordem: integração tênis/sono/calendário (`avaliacao-integracao-20261008`), `feature/evolucao-corredor`, `fix/calculo-recordes`, `feature/zonas-cardiacas` e `health-connect-fixes` (16/10). Em seguida, o merge na `main` pelo PR #7 (`e277585`). Os conflitos com a auditoria de 12/10 foram resolvidos mantendo os dois lados:
- `activities.py`: apagar uma corrida estorna RunCoins/km de grupo e também reabre o treino do calendário.
- `AndroidManifest.xml`: `allowBackup="false"` junto com as regras de extração do sono.
- `RunTracking.tsx`: a correção de GPS (`acceptGpsPoint`) convive com tênis, treino planejado e amostras de performance.
- `package.json`: versões da auditoria mais `@capacitor-community/bluetooth-le`.

**Por que foi feito:** Confirmado (PR #7 e relatório de 08/10). As branches estavam paralelas desde 08/10, com PRs #1–#4 abertos e sem merge, e todas conflitavam com a `main` depois da auditoria.

**Impacto:** a `main` passou a ter todas as features. Os PRs #1–#4 foram fechados como substituídos, as branches antigas foram apagadas e só restam `main` e `beta-2.1` no remoto.

**Arquivos principais:** `src/pages/app/RunTracking.tsx`, `backend/app/routers/activities.py`, `android/app/src/main/AndroidManifest.xml`, `package.json`/`package-lock.json`.

**Status:** Concluído

### Cadeia única de migrações do banco

**O que foi feito:** a migração `e4b7c2a9d150_merge_performance_heads.py` une o head da integração (`d8a6c3f9012b`) ao de performance (`a81f2c4d903e`). A migração do relógio (`b76d2b3a11fe`) foi colocada em cima dela. A CI (`.github/workflows/ci.yml`) agora testa o upgrade a partir de produção (`d48faef56a35`) e de cada head intermediário.

**Por que foi feito:** Confirmado. Com a cadeia antiga, `alembic upgrade head` terminava em "Multiple head revisions", e o deploy no Render (`render-start.sh` roda essa migração) falharia.

**Impacto:** o deploy de 16/10 aplicou as 7 migrações em sequência sem erro (logs do Render, 13:16 UTC). Produção ficou em `b76d2b3a11fe`, com os 10 usuários e a corrida existente preservados.

**Arquivos principais:** `backend/alembic/versions/e4b7c2a9d150_merge_performance_heads.py` (11), `.github/workflows/ci.yml` (+8), `docs/REVISAO_INTEGRACAO.md`, `docs/PERFORMANCE.md`.

**Status:** Concluído

### Importação de corridas do relógio (Health Connect), com correções

**O que foi feito:** port da branch `integracao-relogios` do mhh09 para cima da `beta-2.1` (16 commits em cerca de 30 s, 16/10). Depois, três correções minhas (`75a1701`), cada uma com teste. Detalhes nas seções 3 e 4.

**Por que foi feito:** Confirmado (`docs/integracao-relogios.md` na branch original): importar corridas do Galaxy Watch e de relógios Wear OS.

**Impacto:** o usuário pode importar no histórico as corridas dos últimos 30 dias, sem ganhar XP.

**Arquivos principais:** `RunnexHealthConnectPlugin.kt` (134), `ConnectedDevices.tsx` (98), `routers/health_imports.py` (90), `tests/test_health_imports.py` (93), `services/healthConnect.ts` (45).

**Status:** Necessita revisão (nunca testado em aparelho; decisões de produto em aberto, ver seção 13)

### Deploy do backend em produção

**O que foi feito:** antes do merge, criei no Neon um backup de produção (`backup-pre-beta-2.1-2026-10-16`) e uma cópia de ensaio. Nela apliquei o SQL das migrações, gerado com `alembic upgrade --sql`, no Postgres 18 e com os dados reais. Depois veio o merge e o deploy automático no Render. A cópia de ensaio foi apagada; o backup foi mantido.

**Por que foi feito:** Confirmado. Os testes rodam em Postgres 16 e produção usa Postgres 18; o ensaio eliminou essa diferença antes de tocar no banco real.

**Impacto:** produção com o backend 2.1 desde 16/10.

**Status:** Concluído para o backend. Para o frontend web (Firebase Hosting), não foi possível confirmar (ver seção 12).

## 3. Bugs Corrigidos

### Corridas importadas ganhavam XP quando outra corrida era apagada

- **Problema:** importar corridas do relógio (`xp_gained=0`) e apagar qualquer corrida fazia o usuário ganhar o XP cheio das importadas. No teste: 1600 de XP total em vez de 300.
- **Causa provável:** `_recompute_user_totals` usava `activity.xp_gained or calculate_xp(...)`, e `0` contava como "não informado". A correção existia na versão antiga da branch (`5478c81`) e se perdeu no port.
- **Solução aplicada:** `xp_gained if xp_gained is not None else calculate_xp(...)`.
- **Arquivos envolvidos:** `backend/app/routers/activities.py:307`.
- **Impacto da correção:** importar corridas não gera XP indireto.
- **Possíveis riscos de regressão:** uma corrida antiga com `xp_gained=0` gravado querendo dizer "desconhecido" deixaria de ser recalculada. O app sempre grava o valor calculado, então o risco é baixo. Não foi possível verificar se dados migrados do Firestore têm `0`.

### Apagar corrida importada estornava RunCoins e km de grupo que ela nunca deu

- **Problema:** o estorno da auditoria de 12/10 (`revert_activity_effects`) descontava as moedas e o km de grupo de toda corrida apagada, inclusive das importadas, que não creditam nada. No teste: moedas de 5 para 0.
- **Causa provável:** a importação nasceu depois do estorno, e ninguém ligou uma coisa à outra.
- **Solução aplicada:** `revert_activity_effects` ignora as atividades que têm registro em `health_imports`.
- **Arquivos envolvidos:** `backend/app/services/activity_effects.py`.
- **Impacto da correção:** o saldo de moedas e o ranking de grupos não são afetados por corridas importadas.
- **Possíveis riscos de regressão:** baixo; uma consulta extra por exclusão.

### Erro 500 com distância abaixo de 0,5 m na importação

- **Problema:** `distance_meters` aceitava qualquer valor acima de 0. Com `km = round(m/1000, 3) = 0`, o cálculo do ritmo dividia por zero.
- **Causa provável:** a validação só exigia `gt=0`.
- **Solução aplicada:** `ge=100` no backend (422) e o mesmo filtro em `ConnectedDevices.tsx`.
- **Arquivos envolvidos:** `backend/app/routers/health_imports.py`, `src/pages/app/ConnectedDevices.tsx`.
- **Impacto da correção:** uma sessão curta não derruba mais o lote de importação.
- **Possíveis riscos de regressão:** sessões legítimas com menos de 100 m deixam de ser importadas, o que é intencional.

### Migrações com vários heads (deploy quebraria)

- **Problema:** tênis, sono, calendário e performance partiram todos de `d48faef56a35`.
- **Causa provável:** branches desenvolvidas em paralelo, sem coordenação sobre migrações.
- **Solução aplicada:** migração de junção `e4b7c2a9d150` (seção 2).
- **Arquivos envolvidos:** `backend/alembic/versions/`.
- **Impacto da correção:** o deploy de 16/10 funcionou.
- **Possíveis riscos de regressão:** nenhum identificado; a CI agora testa cada caminho de upgrade.

### Nome de índice divergente entre modelo e migração (`health_imports`)

- **Problema:** `alembic check` falhava (`ix_health_imports_user` × `ix_health_imports_user_id`), e a CI da branch original estava vermelha.
- **Solução aplicada:** commits `2f032e7` e `bc5e076` (mhh09) alinharam o nome.
- **Arquivos envolvidos:** `backend/alembic/versions/b76d2b3a11fe_health_connect_imports.py`.
- **Impacto da correção:** CI verde.
- **Possíveis riscos de regressão:** nenhum.

## 4. Novas Funcionalidades

As seis primeiras foram escritas entre 08 e 09/10 e descritas no relatório de 08/10. **Neste período elas chegaram à `main` e à produção.**

### Controle de tênis
- **Objetivo:** controlar a quilometragem e o desgaste de cada tênis.
- **Funcionamento:** cadastro com limite em km; a corrida pode ser vinculada a um tênis; aviso de desgaste.
- **Principais componentes envolvidos:** `src/pages/app/Shoes.tsx` (634), `ShoeStatusBadge.tsx`, `backend/app/routers/shoes.py`, `services/shoes.py`.
- **Integração com backend/API/banco:** tabela `shoes` e coluna `activities.shoe_id`.
- **Estado atual:** em produção (backend); testes `test_shoes.py`, `shoes.test.tsx` e `runShoeIntegration.test.tsx`.
- **O que ainda falta:** validação em aparelho.

### Sono e recuperação
- **Objetivo:** registrar sono, manualmente ou pelo Health Connect, e usá-lo como indicador de recuperação.
- **Funcionamento:** formulário manual, check-in de qualidade e fadiga, e importação pelo plugin nativo `SleepHealthConnectPlugin.kt` (271 linhas).
- **Principais componentes envolvidos:** `src/pages/app/Sleep.tsx`, `routers/recovery.py`, `services/sleep.py`.
- **Integração com backend/API/banco:** tabelas `sleep_sessions`, `sleep_checkins`, `sleep_import_exclusions` e `recovery_preferences`.
- **Estado atual:** em produção (backend). O plugin nativo só foi testado com unit test (`SleepDurationTest.kt`).
- **O que ainda falta:** teste em aparelho com o Health Connect real.

### Calendário de treinos
- **Objetivo:** planejar treinos e vinculá-los à corrida realizada.
- **Principais componentes envolvidos:** `TrainingCalendar.tsx`, `components/training/*`, `routers/training.py`.
- **Integração com backend/API/banco:** tabela `planned_workouts`. Apagar a corrida reabre o treino (`clear_activity_links`).
- **Estado atual:** em produção (backend); `test_training.py`, `training.test.tsx` e `runTrainingIntegration.test.tsx`.
- **O que ainda falta:** validação em aparelho.

### Evolução, recordes e zonas cardíacas
- **Objetivo:** mostrar a evolução semanal e mensal com pace ponderado, os recordes (1/5/10/21/42 km) e o tempo em cada zona Z1–Z5 com sensor BLE.
- **Funcionamento:** a corrida passa a gravar `performance_samples` e `heart_rate_samples`; `GET /activities/performance/me` calcula tudo a partir do histórico do usuário.
- **Principais componentes envolvidos:** `backend/app/performance.py` (97), `hooks/useRunSamples.ts`, `hooks/useHeartRateSensor.ts`, `components/performance/*`.
- **Integração com backend/API/banco:** 4 colunas novas em `activities`.
- **Estado atual:** em produção (backend); `test_performance.py` e testes de frontend.
- **O que ainda falta:** revisão de código por outra pessoa (nunca teve PR próprio); sensor BLE real.

### Importação de corridas do relógio
- **Objetivo:** trazer corridas do Galaxy Watch e de relógios Wear OS pelo Health Connect.
- **Funcionamento:** o plugin `RunnexHealthConnectPlugin.kt` lê as sessões do tipo corrida dos últimos 30 dias, com a distância da mesma origem. A tela "Dispositivos conectados" (acesso pelo Perfil) envia lotes de até 100 para `POST /health-imports`, que deduplica por `(user_id, source, external_id)` e cria a atividade sem XP.
- **Principais componentes envolvidos:** seção 2.
- **Integração com backend/API/banco:** tabela `health_imports`.
- **Estado atual:** em produção (backend); 6 testes de API e 5 de validação.
- **O que ainda falta:**
  - Evitar duplicar corrida gravada no app e no relógio ao mesmo tempo.
  - Impedir que uma corrida importada apagada volte na sincronização seguinte (a FK com `ON DELETE CASCADE` apaga o registro de importação).
  - Indicar a origem "relógio" no card da corrida.
  - Teste em aparelho.

## 5. Refatorações e Melhorias Técnicas

- **Consolidação do fluxo de branches:** 9 branches paralelas e 4 PRs abertos viraram uma `main` única. Benefício: novas features passam a partir de uma base que já tem todas as outras, o que elimina a classe de problema "migrações paralelas" vista nesta semana.
- **Teste de upgrade de migração por caminho na CI:** o loop agora cobre produção e todos os heads intermediários. Benefício: um novo head paralelo ou um upgrade quebrado é detectado no PR, não no deploy.
- **Documentação sincronizada:** `PERFORMANCE.md` e `REVISAO_INTEGRACAO.md` descrevem a cadeia real de migrações. Os planos do tênis e o relatório de 08/10 foram preservados antes de apagar as branches de origem.

## 6. Banco de Dados e Backend

- **7 tabelas novas:** `shoes`, `sleep_sessions`, `sleep_checkins`, `sleep_import_exclusions`, `recovery_preferences`, `planned_workouts` e `health_imports`.
- **5 colunas novas em `activities`:** `shoe_id` (FK `ON DELETE SET NULL`), `performance_samples`, `heart_rate_samples`, `heart_rate_max_bpm` e `is_simulated`.
- **Nenhuma migração destrutiva.** Confirmado no SQL gerado (`alembic upgrade d48faef56a35:head --sql`): não há nenhum `DROP` nem `DELETE` de dados; os únicos `DELETE` são em `alembic_version`, a tabela de controle do próprio Alembic.
- **Novos routers:** `shoes`, `recovery`, `training` e `health_imports`, além de `GET /activities/performance/me` e `PUT /activities/{id}/shoe`.
- **Todos os novos endpoints de escrita** exigem `require_verified_email` e têm `rate_limit`, no mesmo padrão do resto do backend.
- **Produção:** Render (`runnex-api`, deploy automático da `main`) + Neon (Postgres 18, projeto `Runnex`). Desde 16/10 na versão `b76d2b3a11fe`.

## 7. Frontend e UI/UX

- **Novas telas:** `/tenis` (`Shoes.tsx`), `/sono` (`Sleep.tsx`), `/calendario-treinos` (`TrainingCalendar.tsx`) e `/dispositivos` (`ConnectedDevices.tsx`). As três primeiras ficam no menu lateral (`SideNav.tsx`); `/dispositivos` é acessada por um card no Perfil.
- **Tela de corrida:** seleção de tênis e de treino planejado, controle do sensor de frequência cardíaca e recuperação de uma corrida interrompida isolada por conta, sem misturar dados ao trocar de conta.
- **Dashboard:** evolução, recordes e frequência cardíaca, com estados de carregamento e de "tentar de novo".
- **Observação:** `ConnectedDevices.tsx` usa um estilo mais simples (`<main className="mx-auto max-w-2xl p-6">`, botões sem os componentes do design system) do que o resto do app. Inferência: foi feita com pressa. Não verificado visualmente.

## 8. Segurança

- 🟢 **Baixo:** novas permissões Android `READ_EXERCISE` e `READ_DISTANCE` (relógio), além de `READ_SLEEP` (sono). São coerentes com as features, mas aumentam o que o app pede ao usuário. O Google Play exige justificativa de uso para permissões de saúde.
- 🟢 **Baixo:** os dados de saúde ficam isolados por usuário. Um teste confirma que um usuário não vê nem apaga as importações de outro (`test_imports_are_isolated_per_user`).
- 🟢 **Baixo (melhoria):** os tokens do Health Connect do sono não vão para backup em nuvem nem para transferência entre aparelhos (`sleep_data_extraction_rules.xml`), e `allowBackup="false"` foi mantido.
- ⚪ Nenhuma vulnerabilidade nova confirmada. As pendências de segurança da auditoria anterior estão na seção 12.

## 9. Dependências e Configurações

- `@capacitor-community/bluetooth-le ^8.3.0` adicionado (sensor de FC). Lockfile regenerado com `npm install`; em relação à `main` anterior, a única diferença é esse pacote.
- Android: dependência `androidx.health.connect:connect-client:1.1.0`, `HealthPermissionsActivity` e as duas `queries`/permissões do Health Connect.
- CI: workflow `android.yml` novo (build e testes Android) e loop de migração ampliado em `ci.yml`.
- **Versão não foi alterada:** `package.json` e `android/app/build.gradle` continuam em `0.1.4` / `versionCode 2`, os mesmos de 12/10, apesar de 7 features novas. Ver seção 12.

## 10. Testes e Qualidade

Executado nesta análise, na `main` (`e277585`):

| Verificação | Resultado |
|---|---|
| `npm run lint` (eslint + typecheck) | ✅ passou, sem avisos |
| `npx vitest run` | ✅ 25 arquivos, **144 testes** passaram (eram 72 em 12/10) |
| `npx vite build` | ✅ passou |
| `alembic upgrade head` do zero (Postgres 16) | ✅ um único head, `b76d2b3a11fe` |
| `alembic check` | ✅ sem diferença entre modelos e migrações |
| `pytest` | ✅ **240 testes** passaram (eram 131 em 12/10) |

- **Testes adicionados no período:** `test_shoes.py`, `test_sleep.py`, `test_training.py`, `test_feature_integration.py`, `test_performance.py`, `test_health_imports.py`, `test_health_import_validation.py`, e no frontend `shoes`, `sleep`, `sleepHealthConnect`, `training`, `plannedRun`, `runShoeIntegration`, `runTrainingIntegration`, `records`, `evolution`, `heartRate*` e `runSamples`.
- **Sem cobertura automatizada:**
  - Os plugins nativos `RunnexHealthConnectPlugin.kt` e `SleepHealthConnectPlugin.kt` (só `SleepDurationTest.kt` testa uma função auxiliar).
  - A tela `ConnectedDevices.tsx`.
  - A combinação tênis + treino + sensor numa mesma corrida (testada só por partes).
- **Não executado nesta análise:** CI Android e regras do Firestore. Ambos passaram na CI do PR #7 em 16/10, mas não foram rodados aqui.

## 11. Git e Histórico

- **25 commits** no período, todos em 15 e 16/10:
  - 5 merges de integração meus (15–16/10).
  - 16 commits do mhh09 portando o Health Connect (16/10, das 08:58 às 09:06).
  - 1 commit de correções do Health Connect e 2 de docs/CI meus.
  - O merge do PR #7.
- **Padrão a corrigir:** os 16 commits do mhh09 foram feitos em cerca de 30 s, com mensagens repetidas ("port Health Connect implementation onto beta-2.1" 6×, "wire native and web integration" 6×). É típico de envio arquivo por arquivo pela interface web do GitHub. Foi nesse tipo de port que a correção de XP (`5478c81`) se perdeu.
- **Áreas que mais mudaram** (por número de arquivos): `backend/app/` (14%), `src/components/` (12%), `src/test/` (11%), `src/` (10%), `android/` (12% somando `android/` e `android/app/src/main/`).
- **Maiores arquivos tocados:** `Shoes.tsx` (634), `SleepHealthConnectPlugin.kt` (271), `Sleep.tsx` (259), `recovery.py` (189). `RunTracking.tsx` chegou a **1.064 linhas**, o maior arquivo do frontend.
- **Branches:** o remoto ficou com `main` e `beta-2.1`. A `beta-2.1` foi apagada por engano em 16/10 e restaurada no mesmo commit (`c3989f0`).
- **17 a 23/10: nenhum commit em nenhuma branch.**

## 12. Problemas Encontrados

| Classificação | Problema | Evidência | Impacto | Recomendação |
|---|---|---|---|---|
| 🟠 Importante | App Android 2.1 nunca testado em aparelho | `docs/TESTE_ANDROID_RESULTADOS.md` ainda tem os campos em branco ("preencher no aparelho"); pendente desde 12/10 (P1-03) | Health Connect (sono e relógio), BLE e GPS podem falhar no uso real, e ninguém saberia | Gerar o APK da `main` e preencher o roteiro |
| 🟠 Importante | Não há como confirmar se o frontend web 2.1 foi publicado | Firebase Hosting (`firebase.json`) não tem deploy automático na CI nem no Render; daqui não há acesso ao Firebase | Se não foi publicado, quem usa pelo navegador não vê nenhuma feature nova, embora o backend já esteja na 2.1 | Rodar `npm run build` + `firebase deploy --only hosting:veloxyMain` e registrar a data |
| 🟡 Moderado | Versão do app não foi incrementada | `package.json` 0.1.4, `build.gradle` `versionCode 2`, iguais a 12/10 | O APK novo não se distingue do anterior; publicar na Play Store exige `versionCode` maior | Subir para 0.2.0 / `versionCode 3` |
| 🟡 Moderado | Importação do relógio duplica corridas e reimporta as apagadas | `health_imports.py` só deduplica por `external_id`; FK `ON DELETE CASCADE` | Corrida gravada no app e no relógio conta duas vezes; corrida apagada volta | Decidir e implementar a Fase 2 (checagem de sobreposição de horário; `ON DELETE SET NULL`) |
| 🟡 Moderado | Dois plugins nativos de Health Connect com fluxos de permissão separados | `SleepHealthConnectPlugin.kt` e `RunnexHealthConnectPlugin.kt` | Possível pedido de permissão duplicado; código duplicado | Validar no aparelho; avaliar unificar |
| 🟡 Moderado | Pendências de desempenho da auditoria anterior | Não existe endpoint de estatísticas agregadas (P2-03); fotos em base64 continuam no feed (P2-04) | Lentidão que cresce com o uso | Manter no backlog com prioridade |
| 🟡 Moderado | `GET /activities/performance/me` recalcula a partir do histórico inteiro a cada chamada | `docs/PERFORMANCE.md`: "históricos muito grandes podem exigir agregação/cache" | Fica mais lento para quem tem muitas corridas | Medir quando houver dados; cache ou agregação |
| 🟢 Baixa | Token do WebSocket na URL (S5) | `src/services/groupSocket.ts:19` | Token aparece nos logs do proxy | Enviar na primeira mensagem |
| 🟢 Baixa | Verificação de e-mail ausente em `chatbot` e `events` (S7 parcial) | `require_verified_email` em 7 routers, mas não em `chatbot.py` nem `events.py` | Conta não verificada consegue usar esses endpoints | Aplicar a dependência |
| 🟢 Baixa | `storage.rules` sem uso (S9) e 70 ocorrências de `text-[8px]`/`text-[9px]` (P3-08) | arquivo presente; busca em `src` | Manutenção e acessibilidade | Ajustes pontuais |

## 13. Pontos de Atenção

- **Código de performance sem revisão de outra pessoa:** as branches de recordes, zonas e evolução nunca tiveram PR próprio. Só passaram pelos testes e pela minha revisão durante a integração.
- **`RunTracking.tsx` com 1.064 linhas** concentra GPS, tênis, calendário, performance, FC e recuperação de corrida. Cada nova feature mexe nesse arquivo, e foi o maior foco de conflito do período.
- **`ConnectedDevices.tsx`** destoa visualmente do resto do app (seção 7) e não tem teste.
- **A `main` não está protegida.** Inferência: não há evidência de regra de branch. O fluxo da semana teve PRs de 7 mil linhas e commits pela interface web.
- **Backup no Neon** (`backup-pre-beta-2.1-2026-10-16`): mantenha até confirmar que a 2.1 está estável em uso real.
- Nenhum `TODO`/`FIXME` e nenhum `any` foram adicionados no período.

## 14. Recomendações

🔴 **Prioridade alta**
- Testar o APK da `main` num aparelho Android e preencher `docs/TESTE_ANDROID_RESULTADOS.md`.
- Confirmar ou fazer o deploy do frontend no Firebase Hosting.

🟡 **Prioridade média**
- Subir a versão do app para 0.2.0 / `versionCode 3`.
- Proteger a `main` (exigir PR e CI verde).
- Decidir a Fase 2 do relógio (duplicata, reimportação, selo de origem).
- Pedir revisão do código de performance a outra pessoa da equipe.

🟢 **Prioridade baixa**
- Itens S5, S7, S9 e P3-08.
- Dividir `RunTracking.tsx` em hooks e componentes.
- Alinhar `ConnectedDevices.tsx` ao design system.

## 15. Próximos Passos

1. **Publicar o frontend web 2.1 e testar no navegador**
   - Motivo: o backend já está na 2.1; o site provavelmente não.
   - Impacto esperado: as features ficam visíveis para quem usa pela web, e os erros de integração aparecem enquanto o backup do Neon ainda serve.
2. **Gerar o APK da `main` (com a versão incrementada) e rodar o roteiro Android**
   - Motivo: pendência desde 12/10, agora com o risco maior de três integrações nativas.
   - Impacto esperado: evidência real de que sono, relógio, BLE e GPS funcionam. Depende de subir a versão antes.
3. **Definir e implementar a Fase 2 do relógio**
   - Motivo: duplicata e reimportação afetam os números do usuário.
   - Impacto esperado: histórico confiável. Depende do teste em aparelho para ver os dados reais do relógio.
4. **Proteger a `main` e combinar o fluxo de PR com a equipe**
   - Motivo: evitar repetir os problemas desta semana (migrações paralelas, correção perdida).
   - Impacto esperado: problemas pegos no PR, não na integração.

## 16. Evolução do Projeto

Avaliação técnica aproximada, não uma métrica objetiva. "Início" = `main` em `a50ae57` (após a auditoria de 12/10); "final" = `e277585`.

| Dimensão | Início da semana | Final da semana | Observação |
|---|---|---|---|
| Funcionalidades | 3 | 4 | 7 features novas na `main` e no backend de produção |
| Estabilidade | 3 | 3 | Mais superfície, nada validado em aparelho; o backend subiu sem erro |
| Arquitetura | 3 | 3–4 | Migrações consolidadas e testadas por caminho; `RunTracking.tsx` cresceu e há dois plugins de Health Connect |
| Segurança | 3 | 3 | Novos endpoints seguem o padrão (e-mail verificado, rate limit, isolamento); pendências antigas continuam |
| Qualidade do código | 3 | 3 | Lint limpo, sem `any`; partes sem revisão de outra pessoa |
| UX/UI | 3 | 3–4 | 4 telas novas; não verificado visualmente |
| Testes | 3 | 4 | Frontend 72→144, backend 131→240; plugins nativos sem teste |
| Performance | 3 | 3 | Não medido; novo endpoint de performance sem cache |

## 17. Resumo para Apresentação

**Esta semana**
- ✅ Beta 2.1 na `main` e no backend de produção: tênis, sono, calendário, evolução, recordes, zonas cardíacas e importação do relógio
- ✅ Três bugs da importação do relógio corrigidos, dois deles sobre XP e RunCoins
- 🔧 Cadeia única de migrações; deploy precedido de backup e ensaio na cópia do banco
- 🎨 4 telas novas (Tênis, Sono, Calendário, Dispositivos conectados)
- 🛡️ Dados de saúde isolados por usuário; tokens do sono fora do backup em nuvem

**Próxima semana**
- 🎯 Publicar o frontend web 2.1 e testar no navegador
- 🎯 APK 0.2.0 testado em aparelho, com o roteiro preenchido
- 🎯 Fase 2 do relógio e proteção da `main`

---

## Comparação com semanas anteriores

**Em relação à auditoria de 12/10:**
- **Resolvidos antes deste período**, no próprio dia 12/10 (PR #5): P1-01 (GPS), P1-02 (dependências), P2-01 (farm de RunCoins), P2-02 (comentários entre grupos), P2-06 (aviso e histórico do treinador) e P3-09 (`allowBackup`). Neste período, essas correções sobreviveram à integração; os testes de cada uma continuam passando.
- **Resolvido, conferido agora:** S4 (compra concorrente) já usa `with_for_update` (`pet.py:108`).
- **Parcial:** S7, e-mail verificado em 7 routers, sem `chatbot` e `events`.
- **Continua pendente:**
  - **P1-03 (teste Android em aparelho), há duas semanas.** Agora é mais arriscado, porque o app ganhou três integrações nativas.
  - P2-03 e P2-04 (desempenho), P2-05 (`async`), S5, S6, S9 e P3-08.
- A **nota projetada de 8,0** dependia de fechar P1-03, que não foi feito.

**Em relação a 08/10:** o relatório pedia para integrar as branches de tênis, sono e calendário. Isso foi feito, junto com as três branches de performance que surgiram no dia seguinte.

**Padrões recorrentes:**
- O trabalho chega em rajadas (08–09/10, 15–16/10), com uma semana inteira sem commits depois.
- Branches desenvolvidas em paralelo sem base comum geram conflitos e migrações paralelas.
- O teste em aparelho fica sempre para depois.
