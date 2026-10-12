# PROMPT — PLANO DE AÇÃO DA SEMANA (base: auditoria de 12/10/2026)

Você é um engenheiro de software sênior trabalhando no projeto **Runnex** (pacote `veloxy`): frontend React 18 + Vite + TypeScript em `src/`, backend FastAPI + PostgreSQL (SQLAlchemy + Alembic) em `backend/`, app Android via Capacitor em `android/`.

Sua tarefa é executar o plano de ação abaixo, **na ordem**, corrigindo os problemas encontrados na auditoria `docs/reports/relatorio-semanal-2026-10-12.md`. Leia esse relatório antes de começar — ele tem a evidência de cada problema.

---

## 1. Regras obrigatórias

- **Antes de alterar qualquer arquivo, leia-o inteiro** e confirme que o problema descrito ainda existe. Se já estiver corrigido, registre isso e pule a tarefa.
- **Uma tarefa por vez.** Termine, teste e só então passe para a próxima.
- **Toda correção de bug vem com um teste automatizado** que falharia antes da correção e passa depois.
- **Não altere:** autenticação (Firebase Auth / `backend/app/auth.py`), rotas do React Router, schema do banco (nenhuma tarefa exige migration — se achar que precisa, pare e pergunte), integrações e variáveis de ambiente.
- **Não faça upgrades de versão major** (react-router 7, tailwind 4, React 19, firebase 13). Só atualizações dentro do semver atual.
- **Não refatore além do necessário** para a tarefa. Siga o estilo do código ao redor: comentários em português explicando o *porquê*, nomes e padrões já existentes (`_require_member`, `page_size`, `visible_to`, `get_or_create_user`, etc.).
- **Não faça commit, push ou merge sem autorização explícita.** Se autorizado: uma branch por tarefa (`fix/...`, `feat/...`, `chore/...`) e um commit por tarefa com mensagem descritiva em português.
- **Não invente resultados.** Se não conseguir rodar algum teste (ex.: sem PostgreSQL), diga claramente o que não foi executado.

### Verificações após cada tarefa

Frontend (sempre):
```bash
npm run lint
npm run test
npx vite build
```

Backend (sempre que tocar em `backend/`), com um banco cujo nome contenha `test`:
```bash
cd backend
DATABASE_URL=postgresql+psycopg://<usuario>:<senha>@localhost:5432/veloxy_test FIREBASE_PROJECT_ID=veloxy-test pytest
```
Se não houver banco disponível, rode ao menos os testes que não dependem dele e informe quais ficaram sem executar.

---

## 2. Tarefas — Correções críticas (P1)

### Tarefa 1 — Corrigir o filtro de pontos de GPS que "congela" a distância (P1-01)

**Problema:** em `src/pages/app/RunTracking.tsx`, um ponto só é aceito se estiver entre 5 m e 500 m do último ponto aceito (linhas ~292 e ~393). Se houver um salto maior que 500 m (túnel, pausar → andar → retomar, retomar corrida recuperada em outro lugar), o "último ponto" nunca é atualizado e **todos os pontos seguintes são descartados até o fim da corrida**. A mesma lógica está duplicada em dois lugares: `applyGpsPoint` (linhas ~260–300) e o watcher web (linhas ~364–400).

**O que fazer:**
1. Criar em `src/lib/route.ts` uma função pura, por exemplo:
   ```ts
   acceptGpsPoint(path: [number, number][], point: [number, number]): { path: [number, number][]; addedKm: number }
   ```
   Regras:
   - `path` vazio → `{ path: [point], addedKm: 0 }`.
   - distância < 5 m → ignora (`path` inalterado, `addedKm: 0`).
   - 5 m ≤ distância < 500 m → adiciona o ponto e soma a distância.
   - distância ≥ 500 m → **adiciona o ponto como nova âncora sem somar distância** (`addedKm: 0`), para que os próximos pontos voltem a ser aceitos.
   - Reaproveitar `haversineKm` já existente; manter os limites como constantes nomeadas.
2. Fazer o watcher web chamar `applyGpsPoint` (eliminando a duplicação) e `applyGpsPoint` usar `acceptGpsPoint`. Os filtros de precisão (> 50 m) e de velocidade (> 8,33 m/s) continuam em `applyGpsPoint`, como hoje.
3. Na mesma tela: remover o `console.log` que imprime latitude/longitude a cada ponto (linha ~367), corrigir o texto corrompido `"incompatÃ­vel"` (linha ~278) e corrigir `getPace()` para nunca exibir `5'60"` (arredondar o total de segundos por km antes de separar minutos/segundos, como `formatPace` em `src/services/activitiesApi.ts` já faz). Mostrar o aviso de "GPS fraco" no máximo uma vez a cada ~10 segundos, em vez de um toast por leitura.

**Testes (em `src/test/route.test.ts`):** ponto inicial; ruído < 5 m ignorado; ponto válido soma distância; salto > 500 m vira âncora sem somar distância; **depois do salto, os pontos seguintes voltam a ser aceitos e somados** (é o caso do bug); sequência pausa → deslocamento → retomada.

**Critério de conclusão:** existe uma única implementação do filtro, coberta por testes; não há `console.log` de coordenadas; lint, testes e build verdes.

---

### Tarefa 2 — Atualizar dependências vulneráveis dentro do semver (P1-02)

**Problema:** `npm audit --omit=dev` aponta 17 vulnerabilidades (1 crítica em `@capacitor/android` 8.4.0, altas em `firebase`/`@firebase/*` e `@capacitor-firebase/authentication`).

**O que fazer:**
1. Atualizar dentro da versão major atual: `@capacitor/core`, `@capacitor/android`, `@capacitor/cli` (8.5.x), `@capacitor-firebase/authentication` (8.5.x), `firebase` (12.x mais recente). Usar `npm install <pacote>@<versão>`, nunca `npm audit fix --force`.
2. Mover `@capacitor/cli` e `@types/leaflet` de `dependencies` para `devDependencies`.
3. Rodar `npm audit --omit=dev` de novo e registrar: o que foi resolvido, o que sobrou e se o que sobrou exige upgrade major (documentar, não executar).

**Critério de conclusão:** nenhuma vulnerabilidade **crítica** em produção; lint, testes e build verdes; tabela antes/depois no resumo final. Avisar que é preciso gerar um APK novo (`npm run android:sync`) e testá-lo no aparelho.

---

### Tarefa 3 — Preparar o app Android para a validação em aparelho (P1-03 / P3-09)

**O que fazer (código):**
1. `android/app/build.gradle`: atualizar `versionCode` para `2` e `versionName` para `"0.1.4"` (alinhado ao `package.json`), e atualizar a versão em `package.json` para `0.1.4`.
2. `android/app/src/main/AndroidManifest.xml`: `android:allowBackup="false"` (o backup do Google copiava o histórico do treinador e o snapshot da corrida).

**O que fazer (entregar para a equipe, não executar):** uma lista curta com os passos do `docs/TESTE_ANDROID.md` que precisam ser feitos num aparelho real, com um campo de resultado para cada um, salva como `docs/TESTE_ANDROID_RESULTADOS.md` (modelo vazio para preencher).

**Critério de conclusão:** arquivos alterados e build verde; modelo de resultados criado.

---

## 3. Tarefas — Melhorias funcionais e de segurança (P2)

### Tarefa 4 — Estornar RunCoins e km de grupo ao apagar corrida (P2-01)

**Problema:** `POST /activities` (`backend/app/routers/activities.py`) credita RunCoins e soma km semanal nos grupos do usuário. `DELETE /activities/{id}` e `DELETE /activities/user/{id}/all` recalculam só XP e km mensal (`_recompute_user_totals`). Criar e apagar corridas repetidamente gera moedas infinitas e infla o ranking de grupos.

**O que fazer:**
1. Em `delete_activity`: antes de apagar, calcular `calculate_run_coins(activity.distance)` e subtrair de `user.pet_coins` (nunca abaixo de 0). Se a corrida foi criada na semana ISO atual, subtrair `activity.distance` do `weekly_km` dos grupos do usuário cuja `weekly_km_week` é a semana atual (nunca abaixo de 0).
2. Em `delete_all_user_activities`: fazer o mesmo de forma agregada (soma das moedas das corridas apagadas; soma dos km das corridas da semana atual).
3. Pôr a lógica de "desfazer efeitos" em `backend/app/services/activity_effects.py`, ao lado de `apply_xp_and_km` e `update_weekly_km_for_user_groups`, para manter o padrão do módulo.

**Testes (pytest):** criar corrida → apagar → saldo de RunCoins e km do grupo voltam ao valor anterior; saldo nunca fica negativo se as moedas já foram gastas; apagar todas as corridas estorna o total.

---

### Tarefa 5 — Impedir leitura de comentários de outro grupo (P2-02)

**Problema:** `list_group_post_comments` em `backend/app/routers/groups.py` (linha ~328) valida que o usuário é membro do `group_id` da URL, mas busca comentários só por `post_id`. Um membro do grupo A lê comentários de posts do grupo B.

**O que fazer:** antes de listar, confirmar que o post existe **e pertence ao grupo** (`GroupPost.id == post_id, GroupPost.group_id == group_id`), retornando 404 caso contrário — o mesmo padrão já usado em `add_group_post_comment`.

**Teste:** em `backend/tests/test_groups.py`, membro do grupo A pedindo `/groups/{A}/posts/{post_do_B}/comments` recebe 404.

---

### Tarefa 6 — Pendências do treinador virtual (P2-06)

1. Em `src/pages/app/Coach.tsx`, adicionar um aviso curto e visível: o treinador dá orientações gerais baseadas nas suas corridas e **não substitui um profissional de educação física ou de saúde**.
2. Em `src/services/auth.ts` → `deleteCurrentAccount`, chamar `clearCoachHistory(user.uid)` (de `src/lib/coachHistory.ts`) depois que os dados do backend forem apagados.

**Teste:** Vitest garantindo que `deleteCurrentAccount` limpa a chave `veloxy-coach-<uid>` do `localStorage` (mockando Firebase e a API, no mesmo estilo de `src/test/useAuth.test.tsx`).

---

## 4. Tarefas — Ajustes rápidos (P3), se sobrar tempo

### Tarefa 7 — Compra de acessório sem gasto duplo (P3-03)
Em `purchase_pet_accessory` (`backend/app/routers/pet.py`), carregar o usuário com bloqueio de linha (`with_for_update()`) antes de checar e debitar o saldo.

### Tarefa 8 — Textos que prometem mais do que o app faz
- `src/pages/app/Profile.tsx` (linha ~245): a descrição do "Perfil privado" deve dizer que oculta o perfil **e as corridas** do feed, dos rankings e dos grupos.
- Seletor de unidade km/mi: como só a Home converte, ajustar a descrição para refletir isso **ou** aplicar a conversão nas outras telas (preferir só ajustar o texto nesta semana).
- `README.md`: atualizar a contagem de testes (hoje diz 52 no frontend e 82 no backend; contar de novo após as tarefas acima).

### Tarefa 9 — Privacidade de UIDs e e-mail verificado (P3-01 / P3-02)
- `GET /groups/joined/{user_id}` e `GET /events/enrolled/{user_id}`: permitir só para o próprio usuário (403 para outros).
- Aplicar `require_verified_email` nas escritas de grupos (posts, comentários, mensagens, criar grupo) e do pet.
- Antes de mudar, verificar no frontend quem chama esses endpoints e garantir que nada quebra.

---

## 5. Fora do escopo desta semana (não fazer)

Fotos servidas por URL em vez de base64, endpoint de estatísticas agregadas, conversão dos handlers `async` para sync, token do WebSocket fora da URL, layout desktop das telas restantes, divisão de arquivos grandes, testes E2E com Playwright, exportação de dados (LGPD), zona de privacidade na rota, upgrades major de dependências e marketplace. Se encontrar algo grave nessas áreas, apenas registre no resumo final.

---

## 6. Entrega final

Ao terminar, responda com:

1. **Tabela de tarefas:** tarefa, status (concluída / parcial / pulada / bloqueada), arquivos alterados, testes criados.
2. **Resultado das verificações:** saída resumida de lint, testes do frontend, testes do backend (executados, aprovados, reprovados, **não executados**), build e `npm audit --omit=dev` antes/depois.
3. **O que ficou pendente e por quê.**
4. **O que a equipe precisa fazer manualmente:** gerar o APK, testar no aparelho e preencher `docs/TESTE_ANDROID_RESULTADOS.md`, publicar o backend no Render.
5. **Riscos de regressão** que você identificou nas mudanças.

Meta da semana: **nenhum P1 aberto e os P2 de esforço pequeno (tarefas 4, 5 e 6) resolvidos, cada um com teste automatizado.**
