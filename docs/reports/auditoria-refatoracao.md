# Auditoria para refatoração — Runnex

**Data:** 12/11/2026 · **Base:** `main` em `8b9b62d` (v0.2.0, versionCode 3) · **Fase 1: só análise, nenhum código alterado.**

## 0. Resumo

O código está em estado melhor do que o pedido de auditoria supõe. Três das premissas do pedido não se confirmaram, e o que mais importa agora não é refatoração, são **bugs reais** e **um risco de GPS que ninguém mediu no aparelho**.

| Premissa do pedido | O que encontrei |
|---|---|
| "Tipagem fraca (`any`, casts)" | Zero `any`, zero `@ts-ignore`, zero `eslint-disable` em `src/` (fora de testes). Não é um problema deste projeto. |
| "Gravações ainda vão para o Firestore em vez do backend" | Meia verdade. Grupos e eventos **reais** já vão 100% para o backend. O Firestore só é usado para os grupos/eventos **de demonstração** (dados falsos embutidos no app). A decisão a tomar é de produto: manter ou não os dados falsos. Ver seção 3. |
| "Efeitos React com dependências erradas" | O lint (`react-hooks/exhaustive-deps`) passa limpo e sem supressões. Os problemas de efeito que existem são de outro tipo (ver E2, R2). |
| "Código morto, imports sem uso" | Pouco: 10 imports/variáveis sem uso e 1 componente morto no frontend inteiro. |

**Linha de base (rodada nesta sessão, tudo verde):**

| Verificação | Resultado |
|---|---|
| `npm run lint` (eslint + tsc) | 0 erros, 0 avisos |
| `npx vitest run` | 213 testes, 35 arquivos, todos passam |
| `npx vite build` | ok; maior chunk `firebase` = 646 kB (192 kB gzip) |
| `alembic upgrade head` do zero (Postgres 16) | ok |
| `alembic heads` | 1 (`c91e4f2a7b30`) |
| `alembic check` | limpo |
| `pytest` | 263 testes, todos passam |

**Onde eu discordo das suas prioridades** (detalhes na seção 12):

1. **Dividir `RunTracking.tsx` agora é a refatoração de maior risco e menor retorno antes da banca.** GPS, segundo plano e timers não são validáveis no CI, e `docs/TESTE_ANDROID_RESULTADOS.md` está em branco: não há registro de que o roteiro em aparelho real foi executado. Refatorar a tela mais crítica sem essa rede de segurança é trocar um arquivo feio que funciona por um arquivo bonito que talvez não funcione.
2. **Migrar foto base64 para URL (object storage) não vale o risco agora.** Exige infraestrutura nova e migração de dados em produção. Há mitigação barata (seção 4).
3. **"Refatorar sem mudar comportamento" entra em conflito com o que achei.** Os itens de maior valor são correções de bug (que mudam comportamento, por definição). Proponho corrigir os bugs primeiro, em PRs próprios com teste que falha antes, e só depois refatorar.

**Legenda:** Risco da mudança = chance de a correção quebrar algo. Tamanho: P < 100 linhas, M 100–400, G > 400 (dividir). IDs servem para você aprovar por item.

---

## 1. Bugs reais (comportamento errado hoje)

| ID | `arquivo:linha` | Problema | Por que importa | Proposta | Risco | Tam. | Teste cobre? |
|---|---|---|---|---|---|---|---|
| **B1** | `backend/app/ws_manager.py:29-40`, chamado em `routers/groups.py:290,316,380,433` | `broadcast` percorre o `set` de conexões vivo enquanto faz `await send_json`. Se alguém conecta ou desconecta do mesmo grupo nesse instante, estoura `RuntimeError: Set changed size during iteration`. A exceção sobe por `broadcast_from_thread` e a rota devolve **500 depois do commit**. **Reproduzido** nesta sessão com um script isolado. | **Bug.** A mensagem/post/comentário foi gravado, mas o app mostra "Não foi possível enviar" e a pessoa reenvia: mensagem duplicada. Acontece justamente quando várias pessoas abrem o mesmo grupo ao mesmo tempo, ou seja, numa demonstração ao vivo. | Iterar sobre `list(connections)`; tornar `broadcast_from_thread` best-effort (falha de push nunca derruba uma escrita já confirmada). | Baixo | P | Não. Os testes de WS usam 1 conexão. Escrever o teste que falha primeiro. |
| **B2** | `src/hooks/AuthContext.tsx:24-38` + `backend/app/routers/users.py:93-94` | A cada abertura do app, o `AuthProvider` reenvia a foto do Firebase Auth (`PUT /users/{uid} {photoURL}`). Para conta Google, essa é sempre a foto do Google. A foto personalizada escolhida no Perfil é salva só no Postgres (base64), então **é sobrescrita pela foto do Google na próxima abertura**. **Reproduzido** com teste isolado. | **Bug.** Quem entra com Google (provavelmente a maioria) perde a foto personalizada toda vez que reabre o app. Visível na banca. | Só sincronizar a foto do Google quando o perfil no backend não tem foto (ou quando a foto atual do backend ainda é uma URL do Google). | Baixo | P | Não. `useAuth.test.tsx` mocka a sincronização e não verifica o PUT. |
| **B3** | `src/pages/app/Group.tsx:137` + `backend/app/schemas_group.py:48` | A tela aceita publicar **só com imagem** ("Escreva algo ou adicione uma imagem"), mas o backend exige `text` com pelo menos 1 caractere. Post só com foto **sempre falha** com "Não foi possível publicar agora". Confirmado no schema. | **Bug.** Função oferecida pela tela que nunca funciona. | Backend aceitar texto vazio quando há imagem (validador de modelo). Decisão sua: ver pergunta 3. | Baixo | P | Não. |
| **B4** | `backend/app/routers/training.py:61` | `get_or_create_user(db, user.uid, user.uid, None)`: se o perfil ainda não existe, é criado com **o uid como nome de exibição** (nos outros lugares o padrão é "Corredor"). | **Bug** menor: conta Google que cria um treino antes de qualquer outra ação aparece no feed/ranking com um nome tipo `aB3x9...`. | Usar "Corredor", como em `pet.py`, `shoes.py` e `chatbot.py`. | Baixo | P | Não. |
| **B5** | `src/pages/app/Feed.tsx:120-128` | Curtir não atualiza a tela: o coração só muda quando o polling de 15 s traz o feed de novo. Corridas carregadas por "ver mais" (`moreActivities`) **nunca** refletem a curtida. | **Bug** de UX: parece que o toque não funcionou; a pessoa toca de novo. | Atualizar `likes` localmente após a resposta do backend (que já devolve a lista). | Baixo | P | Parcial: o teste verifica a chamada, não o resultado na tela. |
| **B6** | `src/pages/app/Feed.tsx:107-118` | "Puxar para atualizar" mostra "Feed atualizado!" mas não busca o feed; só limpa a paginação e recarrega as estatísticas. | **Bug** menor: mensagem falsa. | Chamar a busca do feed no refresh. | Baixo | P | Não. |
| **B7** | `backend/app/routers/groups.py:206-210`, `routers/events.py:56-61` | Dois toques rápidos em "entrar" (duas requisições simultâneas) passam na checagem e a segunda viola a constraint única: **500** em vez de resposta idempotente. | **Bug** de concorrência; raro, mas a rota de evento se diz idempotente e não é sob corrida. | `INSERT ... ON CONFLICT DO NOTHING` (já é o padrão em `recovery.py`). | Baixo | P | Só o caso sequencial. |

---

## 2. Corrida com GPS (`RunTracking.tsx`)

| ID | `arquivo:linha` | Problema | Por que importa | Proposta | Risco | Tam. | Teste cobre? |
|---|---|---|---|---|---|---|---|
| **R1** | `src/pages/app/RunTracking.tsx:421-429` | O cronômetro **conta ticks** de `setInterval` (`setSeconds(s => s + 1)`) em vez de medir tempo de relógio. Se o WebView atrasar ou suspender timers com a tela bloqueada, o tempo fica menor que o real enquanto o GPS nativo continua somando distância. | **Não verificado, e é o meu maior ponto de dúvida.** Não tenho certeza de como o WebView do Android trata timers em segundo plano com o serviço em primeiro plano ativo (a documentação do plugin só documenta limitação de HTTP após 5 min; `useLegacyBridge: true` já está ligado por causa disso). Se o tempo for subcontado: ritmo errado, recordes errados e, no limite, velocidade média > 30 km/h, que o **servidor recusa com 422** (`activity_rules.py:47`): a corrida não salva de jeito nenhum. O roteiro Android (item 2.4) só confere a **distância** com tela bloqueada, não o tempo. | 1) **Medir no aparelho** (10 min de tela bloqueada, comparar com cronômetro). 2) Independente do resultado, calcular o tempo por diferença de `Date.now()` acumulada entre pausas; é pequeno e correto em qualquer cenário. | Médio (mexe no coração da tela) | P | Não. Os testes de integração usam timers falsos e nunca simulam tick perdido. |
| **R2** | `src/pages/app/RunTracking.tsx:376-380, 539-565` | `setDistance(...)` é chamado **dentro** da função atualizadora de `setPath`. Atualizadores devem ser puros; o React pode executá-los mais de uma vez. | **Manutenção / bug latente.** Hoje funciona porque não há `StrictMode` (`main.tsx`). Se alguém ligar `StrictMode`, a distância dobra em desenvolvimento. | Guardar rota e distância num único estado (ou `useReducer`), atualizado de uma vez. | Médio | P | A regra pura (`acceptGpsPoint`) tem teste; a composição, não. |
| **R3** | `src/pages/app/RunTracking.tsx:301-309` | A cada segundo, o efeito serializa a rota inteira e as amostras (`JSON.stringify`) e grava no `localStorage`. Numa corrida de 2 h são milhares de pontos regravados 7.200 vezes. | **Desempenho/bateria** em corrida longa, na thread principal. | Gravar a cada N segundos ou a cada ponto novo, não a cada tick. | Baixo | P | Sim, a recuperação tem teste (`runShoeIntegration`, `runTrainingIntegration`). |
| **R4** | `src/pages/app/RunTracking.tsx:923` | Velocidade = `distance / (seconds / 3600)` sem proteger `seconds === 0` com distância > 0 (possível ao retomar): mostra `Infinity`. | **Bug** cosmético raro. | Proteger a divisão. | Baixo | P | Não. |
| **R5** | `src/pages/app/RunTracking.tsx` (1.112 linhas) | Um componente com ~25 estados/refs, 9 efeitos e 4 fontes de posição (web, pré-busca, nativo, simulador), mais dois modais embutidos. | **Manutenção.** Qualquer correção de GPS exige entender o arquivo todo. | Extrair em etapas, cada uma com teste: `useRunTimer`, `useGpsTracking` (web + nativo + simulador), `useActiveRunSnapshot`, `useWakeLock`; componentes `ShoePicker`, `RecoverRunDialog`, `MusicSheet`. **Só depois de R1 medido e do roteiro Android executado.** | **Alto** | G (3 PRs) | Parcial: salvar, recuperar, troca de conta e fila offline têm teste; GPS, pausa e cronômetro não. |

---

## 3. Firestore residual

**Lista completa de usos** (o pedido citou 4; são 7, mais configuração):

| ID | `arquivo:linha` | O que faz | Observação |
|---|---|---|---|
| F1 | `src/services/groupsApi.ts:84-102` | `joinGroup`/`leaveGroup` gravam `joinedGroupIds` no Firestore **só para os 3 grupos de demonstração** (`FALLBACK_GROUPS`, linhas 8-45). | Grupo real vai para `POST /groups/{id}/join`. |
| F2 | `src/services/eventsApi.ts:147-160` | `joinEvent` grava `enrolledEvents` no Firestore **só para eventos `local-*`** (3 eventos falsos, linhas 6-88). | Evento real vai para `POST /events/{id}/join`. |
| F3 | `src/services/usersApi.ts:23-36` | **Toda** leitura de perfil faz um `getDoc` no Firestore para mesclar os ids de demonstração. | Uma leitura de Firestore por tela, para todo usuário, para dados que quase ninguém tem. |
| F4 | `src/lib/user-photo.ts:23-30` | `syncGoogleProfilePhoto` grava nome e foto no Firestore a cada abertura do app (conta Google). | **Ninguém lê esse dado.** Escrita morta. |
| F5 | `src/services/auth.ts:132-136` | `deleteDoc` do documento legado ao excluir a conta. | Correto enquanto F1–F4 existirem. |
| F6 | `src/services/dataExport.ts:20-26` | Inclui o documento legado na exportação LGPD. | Idem. |
| F7 | `src/config/firebase.ts:36-45` | `initializeFirestore` com cache persistente (IndexedDB) em toda abertura do app. | Custo de inicialização e a maior parte do chunk de 646 kB. |
| F8 | `src/types/index.ts:5`, `src/lib/feed-utils.tsx:7` | Tipos `Timestamp` do Firestore em interfaces cujos dados hoje vêm da API como string ISO. | Os tipos mentem sobre o formato real. |
| F9 | `vite.config.ts:59`, `storage.rules`, `firebase.json` | `firebase/storage` listado em `manualChunks` e regras de Storage, mas o Storage **não é usado** (conferi: nenhum import e nenhum código de Storage no bundle). | Configuração morta. |

| ID | Problema | Por que importa | Proposta | Risco | Tam. | Teste cobre? |
|---|---|---|---|---|---|---|
| **F-A** | Os dados de demonstração são o único motivo de o SDK do Firestore, as regras (`firestore.rules`, 339 linhas) e um job inteiro de CI (`firestore-rules`) existirem. E eles **aparecem em caso de erro**: `groupsApi.ts:54-57` devolve os 3 grupos falsos ("128 membros", "842 km") quando a API falha, e `groupsApi.ts:53` quando o banco não tem grupo. | **Manutenção** (um banco inteiro para 6 itens falsos), **desempenho** (F3, F7) e **credibilidade**: com o servidor do Render dormindo, o usuário vê grupos inventados no lugar dos dele. Numa banca, número falso na tela é pior que tela vazia. | **Recomendo remover os dados de demonstração e, com eles, todo o Firestore** (F1–F9), trocando por estado vazio ("Nenhum grupo ainda, crie o primeiro") e por erro com "tentar de novo". **Isso muda o que o usuário vê**, então depende da sua aprovação (pergunta 2). Alternativa que mantém o comportamento: guardar a "participação" em demo no `localStorage`; elimina o Firestore, mas mantém os dados falsos. | Médio (toca perfil, grupos, eventos, exclusão de conta, exportação) | M (2 PRs: remover demo; remover SDK/regras/CI) | Sim: `groupsApi.test.ts`, `eventsPage.test.tsx`, `deleteAccount.test.ts`, `dataExport.test.ts`, `createUserProfile.test.ts` fixam o comportamento atual e precisarão mudar junto. |

---

## 4. Segurança

| ID | `arquivo:linha` | Problema | Por que importa | Proposta | Risco | Tam. | Teste cobre? |
|---|---|---|---|---|---|---|---|
| **S1** | `backend/app/routers/groups.py:141-142`, `src/services/groupSocket.ts:17-20` | O ID token do Firebase vai na URL do WebSocket (`?token=`). | **Segurança.** URL fica em log de acesso (Render, proxies). O token vale até 1 h e dá acesso total à conta nesse período. Já estava anotado como P3 em `PLANO_MELHORIAS.md` e continua pendente. | Autenticar pela **primeira mensagem** após conectar (`{"type":"auth","token":...}` com prazo de ~5 s). Manter `?token=` aceito por um tempo para o APK 0.2.0 já instalado não quebrar. | Médio (protocolo muda nos dois lados; compatibilidade com APK antigo) | M | Sim, os 3 testes de WS cobrem o fluxo atual e servem de base. |
| **S2** | `backend/app/schemas.py:41,43` | `displayName` sem limite de tamanho (aceita vazio e 5.000+ caracteres, conferido); `termsVersion` sem limite. | **Segurança/validação.** O nome aparece em feed, ranking e grupos de todo mundo. | `min_length=1, max_length=80` (mesmo limite de `userName` na corrida), com `strip`. | Baixo. Atenção: `auth.ts` e `TermsGate` enviam `displayName: null` às vezes; `None` precisa continuar aceito. | P | `test_users.py` cobre o PUT, não limites. |
| **S3** | `backend/app/schemas.py:70,72,73,74` e `9-11` | Na corrida, `time`, `pace` e `type` são texto livre sem limite (aceitou 100.000 caracteres, conferido); `calories` sem teto; `lat`/`lng` sem faixa (aceitou `lat=9999`). | **Segurança/validação.** Esses campos são gravados e devolvidos no feed público. Com o rate limit (10 corridas/10 min) o estrago é limitado, mas é lixo permanente no feed dos outros. | Limites de tamanho, `lat ∈ [-90, 90]`, `lng ∈ [-180, 180]`, `calories ≤ 20000`. **Não toca em XP/RunCoins/km** (regra 5). | Baixo. Conferir que a fila offline de APKs antigos não envia nada fora dos novos limites (o app sempre envia `"RUNNING"`, `mm:ss` e `m'ss"`). | P | Não para esses campos. |
| **S4** | `backend/app/routers/activities.py:79,95-96` | `userName` e `userAvatar` da corrida **vêm do cliente** e são gravados como estão. | **Segurança (personificação).** Um POST feito à mão publica uma corrida no feed global com o nome e a foto de outra pessoa. É a mesma falha que vocês já corrigiram nos posts de grupo (`schemas_group.py:41-44`). | Servidor preenche nome/foto a partir do perfil (`users`) quando ele existe; o payload só vale para criar o perfil na primeira corrida. Cuidado: se a foto do perfil for base64, o feed fica pesado (ver P1); gravar só URL http(s) no snapshot. | Médio (muda o que aparece no feed para quem tem nome diferente no Auth e no perfil) | P | Não. |
| **S5** | `backend/app/routers/groups.py:56-74,102-106,174-178`; `routers/events.py:25` | `GET /groups` e `GET /groups/{id}` devolvem `memberIds` de **todos os grupos para qualquer usuário logado**; eventos devolvem `participantsIds`. | **Privacidade.** O comentário em `groups.py:444-449` diz que expor em quais grupos um perfil privado está era um problema, e por isso `/groups/joined/{id}` foi fechado. Mas a lista de grupos expõe a mesma informação pelo outro lado. | Devolver `isMember` e contagem; o ranking e o feed do grupo passariam a ser rotas do grupo (`/groups/{id}/leaderboard`, `/groups/{id}/activities`) com checagem de membro. **Quebra o contrato usado pelo APK 0.2.0** (`memberIds`). | **Alto** (contrato de API + APK instalado) | M/G | `test_groups.py` fixa o formato atual. **Sugiro deixar para depois da banca e citar como trabalho futuro.** |
| **S6** | `backend/app/routers/groups.py:201-204,217-220`; `routers/events.py:48-50` | Entrar em grupo/evento usa `get_current_user`; todas as outras escritas de grupo exigem `require_verified_email`. | **Consistência de autorização.** Conta sem e-mail confirmado infla contagem de membros. | Exigir e-mail verificado. O app já bloqueia antes (`PrivateRoute`), então nada muda para usuário legítimo. | Baixo | P | `test_unverified_email_cannot_write_in_groups` cobre post/chat, não o join. |
| **S7** | `backend/app/auth.py:27-39,49-73` | (a) Falha de rede ao buscar as chaves do Google (`requests.get`) não é tratada: **500 em toda rota autenticada**, e o cache válido anterior é descartado. (b) `payload["sub"]` sem checagem. (c) `kid` desconhecido não força nova busca das chaves dentro do TTL de 1 h. | **Disponibilidade.** Um soluço do Google derruba o app inteiro por até 5 s por requisição. | Manter as chaves antigas se a renovação falhar; buscar de novo ao ver `kid` desconhecido; responder 503/401 em vez de 500. | Médio (é a porta de entrada de tudo) | P | `test_auth.py` cobre token ausente/inválido; não cobre JWKS. |
| **S8** | `backend/requirements.txt:8` | `python-jose==3.3.0` tem CVE-2024-33663 e CVE-2024-33664, corrigidas na 3.4.0 (verificado na internet, fontes no fim). | **Segurança, risco real baixo aqui:** o código fixa `algorithms=["RS256"]` e não usa JWE, então nenhuma das duas é explorável neste uso. É higiene. | Subir para `>=3.4.0` (minor, permitido pela regra 6). | Baixo | P | Sim, a suíte de auth. |
| **S9** | `backend/app/rate_limit.py:18`; rotas sem limite | (a) O dicionário `_hits` nunca remove chaves (cresce para sempre, pouco). (b) Sem limite: todas as rotas `GET` (inclusive `/activities/performance/me`, que carrega o histórico inteiro), **todas** as de `/training` (criar treino ilimitado) e as conexões WebSocket por usuário. (c) Zera a cada deploy ou a cada vez que o Render dorme. | **Segurança/disponibilidade.** Um usuário logado consegue encher a tabela de treinos ou martelar a rota mais pesada. | Limite nas escritas de `/training`, em `/performance/me` e teto de conexões WS por usuário; limpar chaves vazias. Não trocar por Redis (infra nova). | Baixo | P | `test_rate_limit.py` cobre o mecanismo. |
| **S10** | `backend/app/main.py:9` | `/docs` e `/openapi.json` públicos em produção (o roteiro Android até usa `/docs` para acordar o servidor). | **Segurança, baixo:** entrega o mapa da API a qualquer um. | Desligar em produção por variável de ambiente; usar `/health` no roteiro. | Baixo | P | Não. |
| **S11** | `backend/app/main.py:34-38` | Rotas de recursos desligados (`/recovery/*`, `/health-imports`) e `/products` continuam montadas e acessíveis. | **Superfície de ataque sem usuário.** | **Não mexer agora** (você pediu para não remover os recursos, e APKs antigos podem usar). Só registrar. | — | — | Têm testes. |
| **S12** | `backend/app/routers/groups.py:181-198` | Dono do grupo: checagem de dono na troca de foto está correta. Sair do grupo não trata o caso do criador (o grupo fica órfão, com `created_by` de quem saiu). | **Regra de negócio, baixo.** | Registrar; não mexer sem decisão de produto. | — | — | Não. |

**Conferido e está certo** (para você não gastar tempo com isso): checagem de dono em corridas, tênis, treinos, pet, sono e exclusão de conta; checagem de membro em posts, comentários e chat (inclusive post de outro grupo); preço do pet definido no servidor; `SELECT ... FOR UPDATE` na compra; perfil privado respeitado em feed, ranking e listagens; corte de 200 m da rota para terceiros; CORS restrito; nenhum segredo no repositório (`.env` fora do git).

---

## 5. Foto em base64 e desempenho

| ID | `arquivo:linha` | Problema | Por que importa | Proposta | Risco | Tam. | Teste cobre? |
|---|---|---|---|---|---|---|---|
| **P1** | `backend/app/validators.py:11`, `src/lib/image-resize.ts:5-9`; amplificado em `routers/groups.py:399-416` (chat), `251-267` (posts), `102-106` (lista) e `src/services/groupsApi.ts:178-181,232-235,270-273` | A foto (até 300 kB em base64) é devolvida **repetida em cada item**: 100 mensagens de chat = a foto do remetente 100 vezes; 30 posts = foto do autor + imagem de cada post; 50 grupos = 50 fotos. E **cada evento do WebSocket faz todo mundo rebaixar a lista inteira** (uma curtida recarrega os 30 posts com todas as imagens), além do polling de 60 s. | **Desempenho e dados móveis.** Com fotos personalizadas, o chat de um grupo ativo passa de megabytes por mensagem recebida, por pessoa. O problema não é "base64 no banco" em si; é base64 **multiplicado por item e por evento**. | **Não migrar para storage agora.** Mitigações, da mais barata para a mais cara: (1) reduzir o avatar no envio de 400 px para ~128 px (uns 10× menor; **muda levemente a nitidez**, precisa do seu ok); (2) busca incremental no chat (`?after_id=`) em vez de recarregar 100 mensagens; (3) rota `GET /users/{uid}/photo` com cache HTTP e as listas devolvendo URL curta. A (3) é a correta, mas `<img>` não envia `Authorization`, então exige decidir se foto de perfil é pública. | (1) baixo, (2) médio, (3) médio/alto | P / M / M | Não há teste de tamanho de resposta. |
| **P2** | `backend/app/routers/activities.py:187` + `app/performance.py` | `/activities/performance/me` carrega **todas** as corridas com **todas** as colunas (rota JSON, até 5.000 amostras de desempenho e até 90.000 de frequência cardíaca por corrida) a cada abertura do Dashboard. | **Desempenho/memória** no plano gratuito do Render. Cresce com o histórico. | Selecionar só as colunas usadas (id, data, distância, duração, simulada, `performance_samples`) e buscar `heart_rate_samples` só da corrida mais recente que tem. | Baixo | P | Sim: `test_performance.py` (170 linhas). |
| **P3** | `backend/app/routers/events.py:43-45,25` | N+1: `list_events` busca os eventos e depois faz **uma consulta por evento** para os participantes (relação lazy), sem limite nem paginação. | **Desempenho.** | `selectinload(Event.participants)` (o padrão já usado em `groups.py:104`). | Baixo | P | Sim: `test_events.py`. |
| **P4** | `src/services/activitiesApi.ts:64-86`; `backend/app/routers/activities.py:270-290` | O feed faz polling a cada 15 s trazendo 10 corridas com a **rota completa** (até 4.500 pontos cada), mesmo com a aba em segundo plano. | **Dados móveis/bateria.** Pode passar de 1 MB a cada 15 s. | Pausar o polling com `document.hidden`; reduzir a rota no servidor para a miniatura do card (ex.: 200 pontos). A segunda parte muda o payload; conferir a tela de detalhe antes. | Baixo / médio | P / M | `feedPage.test.tsx` cobre o cancelamento ao sair da tela. |
| **P5** | `backend/app/routers/training.py:54` | `summary` carrega as corridas da semana com todas as colunas para somar distância. | Desempenho, pequeno. | Selecionar só as colunas usadas. | Baixo | P | Sim: `test_training.py`. |
| **P6** | `backend/app/routers/groups.py:128,176,196,212,228` | Cada rota de grupo recarrega o grupo + todos os membros + o criador para serializar; `join` faz isso duas vezes. | Desempenho pequeno, duplicação grande. | Uma função `_group_out(db, group_id)`. | Baixo | P | Sim. |
| **P7** | banco (conferido em `pg_indexes`) | Sem índice em `posts.group_id`, `messages.group_id`, `comments.post_id`, `group_members.user_id`, `event_participants.user_id`. | **Desempenho, irrelevante no volume de um TCC.** | Uma migração Alembic só de índices. Baixa prioridade; não faria antes da banca. | Baixo (mas é migração em produção) | P | `alembic check` no CI. |
| **P8** | `src/services/usersApi.ts:12-37` | `getUserProfile` = 3 chamadas ao backend + 1 ao Firestore, chamado por quase toda tela (cache de 10 s ajuda). | Desempenho. | Sai de graça com F-A; depois, devolver grupos/eventos junto do perfil. | — | — | Sim. |
| **P9** | `vite.config.ts`, build | Chunk `firebase` de 646 kB (192 kB gzip), o maior do app; a maior parte é o Firestore (estimativa minha, **não medi**; meço no PR). O PWA pré-carrega 84 arquivos (1,7 MB), incluindo telas desligadas (Sono). | Tempo de carga inicial. | Sai com F-A. | — | — | — |

---

## 6. Tratamento de erro

| ID | `arquivo:linha` | Problema | Por que importa | Proposta | Risco | Tam. | Teste cobre? |
|---|---|---|---|---|---|---|---|
| **E1** | `src/services/usersApi.ts:43-47`; `activitiesApi.ts:158-177,183-186,95-98`; `groupsApi.ts:54-57,115-118,130-133`; `eventsApi.ts:138-141`; `usersApi.ts:80-83` | A camada de serviço **engole o erro e devolve vazio** (`null`, `[]`, estatísticas zeradas, grupos falsos). As telas não conseguem distinguir "sem dados" de "servidor fora". | **Bug de UX grave com o Render dormindo:** perfil com XP 0, histórico vazio e grupos inventados, como se a conta tivesse sido apagada. O `catch` de `Profile.tsx:559-562` (cujo comentário diz corrigir exatamente isso) e o de `Events.tsx:82-84` **nunca executam**, porque os serviços nunca lançam. | Serviços lançam; telas tratam (as de Perfil e Eventos já têm a tela de erro pronta, só está inalcançável). | Médio (toca muitas telas; **muda o que aparece quando há erro**) | M (2 PRs) | **Falsa cobertura:** `profilePage.test.tsx:90-91` e `eventsPage.test.tsx:135-136` mockam o serviço **rejeitando**, coisa que o serviço real nunca faz. Os testes passam e o bug existe. |
| **E2** | `src/services/groupsApi.ts:168-175,222-229,260-267`; `activitiesApi.ts:70-77`; consumidores em `Group.tsx:233-239,374-381,462-469` | Os `subscribe*` só registram o erro no console e nunca avisam quem chamou. Se a primeira busca falha, `loading` fica `true`: **spinner infinito** em feed, chat e comentários (até o polling de 60 s tentar de novo). | **Bug de UX.** | Callback de erro (ou estado `{data, error}`) e tela de "tentar de novo". | Baixo/médio | M | Não. |
| **E3** | `src/services/apiClient.ts:29-48` | `fetch` sem tempo limite; `VITE_API_URL` ausente gera requisições para `"undefined/..."`. | Tela presa em "carregando" com rede ruim. | `AbortController` com prazo (o padrão já existe em `serverWake.ts:20-31`). | Baixo. Cuidado para não abortar o salvamento da corrida cedo demais (a fila offline cobre, mas o prazo de `POST /activities` deve ser generoso). | P | `apiClient.test.ts` (182 linhas) cobre cache e erros, não timeout. |
| **E4** | `src/services/groupSocket.ts:38-43` | Reconecta a cada 3 s **para sempre**, sem recuo e sem olhar o código de fechamento: token inválido (4401) ou não-membro (4403) viram laço infinito. | Bateria/rede; ruído no servidor. | Recuo exponencial com teto; parar em 4401/4403. | Baixo | P | Não há teste de `groupSocket`. |
| **E5** | `src/pages/app/Group.tsx:310-317` | Falha ao curtir post só vai para o console. | Erro silencioso. | `toast.error`, como no feed. | Baixo | P | Não. |
| **E6** | `backend/app/routers/activities.py:81-85,126-133,144-151` | `print(traceback)` em vez de `logging`; `except Exception` em volta do XP e do km de grupo. | **Não é bug:** o `except` amplo é a regra auditada (`xpUpdateFailed`), não mexo (regra 5). O `print` é feio, mas funciona no Render. | Trocar por `logging.exception` **só se** você quiser; estética. | Baixo | P | Sim. |
| **E7** | `src/components/SafeAvatar.tsx:21`; `src/pages/app/Group.tsx:126`; `src/components/ActivityCard.tsx:120` | Estado `failed` não reinicia quando `src` muda; `URL.createObjectURL` nunca revogado; comparador do `memo` só olha a quantidade de curtidas. | Bugs cosméticos raros. | Correções pontuais. | Baixo | P | Não. |

---

## 7. Arquivos grandes

| ID | Arquivo (linhas) | Situação | Proposta | Risco | Tam. | Teste cobre? |
|---|---|---|---|---|---|---|
| R5 | `src/pages/app/RunTracking.tsx` (1.112) | Ver seção 2. | Depois do teste em aparelho. | Alto | G | Parcial |
| **G1** | `backend/app/chatbot_logic.py` (991) | Linhas 1–310 são **dados** (base de conhecimento); 310–991 são lógica, já em funções puras e pequenas. É o arquivo grande menos preocupante. | Mover os dados para `chatbot_knowledge.py` (movimentação pura). | Baixo | M (quase tudo movido) | Sim: `test_chatbot.py`. |
| **G2** | `src/pages/app/Profile.tsx` (944) | Três componentes num arquivo: modal de configurações, modal de edição e a página. | Um arquivo por componente, sem alterar lógica. | Baixo | M | Sim: `profilePage.test.tsx` (12 testes). |
| **G3** | `src/pages/app/Group.tsx` (833) | Oito componentes num arquivo (compositor, card, comentários, feed, chat, opções...). | Idem. | Baixo/médio | M | **Não. Nenhum teste de tela para Grupo.** Escrever antes. |
| G4 | `Register.tsx` (694), `Social.tsx` (641), `Shoes.tsx` (632), `Login.tsx` (630) | Grandes, mas coesos. | Não mexer antes da banca. | — | — | Login e Tênis sim; Cadastro e Social não. |

---

## 8. Código morto, duplicado e restos de recursos desligados

| ID | `arquivo:linha` | Problema | Proposta | Risco | Tam. |
|---|---|---|---|---|---|
| **M1** | `eslint.config.js:23`, `tsconfig.app.json:21-22` | `no-unused-vars` **desligado** no ESLint e `noUnusedLocals: false` no TS: ninguém é avisado de import morto. | Limpar os 10 casos abaixo e ligar a regra. | Baixo | P |
| M2 | `Events.tsx:1,2` (`AnimatePresence`, `Bell`); `Feed.tsx:18,21` (`initials`, `Skeleton`); `Group.tsx:7` (`Camera`); `Home.tsx:129` (`lastRun`); `Profile.tsx:81` (`theme`); `RunTracking.tsx:19,20,22` (`MapPin`, `Timer`, `TrendingUp`) | Imports/variáveis sem uso (achados com `tsc --noUnusedLocals`). | Remover. | Baixo | P |
| M3 | `src/components/StatCard.tsx` | Componente sem nenhum uso. | Remover. | Baixo | P |
| M4 | `src/pages/app/RunTracking.tsx:6,148-150` | Ramo `FirebaseError` inalcançável (salvar corrida não passa mais pelo Firebase). | Remover. | Baixo | P |
| M5 | `src/services/groupsApi.ts:63-75,193-204,244-248,282-291`; `activitiesApi.ts:48-58,102-110,132-133` | Parâmetros fantasmas (`userId`, `authorId`, `authorName`, `authorPhoto`, `senderName`...) mantidos "por compatibilidade" e descartados com `void`. As telas calculam esses valores à toa. | Remover dos serviços e dos chamadores. | Baixo (mecânico; o `tsc` aponta todos) | M |
| M6 | `src/services/groupsApi.ts:162-188,216-242,254-280` | Três `subscribe*` quase idênticos (busca + WS + intervalo + cancelar). | Uma função `subscribeToGroupResource`. Fazer junto com E2. | Baixo | P |
| M7 | `backend/app/schemas.py:173` e `schemas_group.py:69` (`ToggleLikeIn` duas vezes); validador `_stringify_id` repetido em 8 schemas; `activity_rules.py:31` e `route_privacy.py:12` (haversine duas vezes); `activities.py:322-330` e `groups.py:307-314` (alternar curtida); `activities.py:185-186,199-200` (validação de fuso); `services/activity_effects.py:80-81` reimplementa `_iso_week` (linhas 25-27) | Duplicação no backend. | Extrair helpers. **`activity_effects.py` fica de fora** (regra 5), mesmo sendo trivial. | Baixo | P |
| M8 | `backend/app/routers/groups.py:78` | `Query.get()` é API legada do SQLAlchemy 2. | `db.get(Group, id, options=[...])`. | Baixo | P |
| M9 | `backend/scripts/create_database.sql` (256 linhas, de 10/09) | Dump com 10 tabelas; o banco real tem 18. Segunda "fonte da verdade" do esquema, desatualizada, contrariando a regra 4. | Remover ou mover para `docs/` com aviso de "histórico". Confirmar antes se o documento do TCC usa. | Baixo | P |
| M10 | `README.md:64`, `docs/ARCHITECTURE.md:22,36,62`; `groupsApi.ts:151` | Documentação cita `productsApi.ts` (não existe) e "foto enviada ao Storage" (não há Storage). | Corrigir. | Nenhum | P |
| M11 | `src/pages/app/RunTracking.tsx:2,782,1054-1107`; `AndroidManifest.xml` (activity de Health Connect, `<queries>`); `MainActivity.java:10-11`; `App.tsx:54,56` | Restos dos recursos desligados: controles de frequência cardíaca importados de forma estática na tela de corrida (entram no bundle), modal de música, plugins e activity de Health Connect registrados, chunk do Sono pré-carregado pelo PWA. | **Não remover** (sua regra). Único ajuste seguro: carregar `HeartRateControls` sob demanda (`lazy`) para não pesar a tela de corrida. Opcional. | Baixo | P |
| M12 | `backend/app/routers/products.py`, `models/product.py`, `schemas_product.py` | Catálogo sem tela no app. | **Manter:** está documentado como base do "trabalho futuro" em `BANCA_TRABALHOS_FUTUROS.md`. | — | — |

---

## 9. Tipagem

Sem `any` nem supressões. O que existe é mais sutil:

| ID | `arquivo:linha` | Problema | Proposta | Risco | Tam. |
|---|---|---|---|---|---|
| T1 | `src/types/index.ts:5,55,117,136-137,150,159,169` | Campos de data tipados como `Timestamp | Date` (herança do Firestore), mas a API devolve **string ISO**. O tipo está errado e só funciona porque tudo passa por `toDateSafe`. | Tipar como `string` e converter num ponto só. Sai junto com F-A. | Baixo/médio | P |
| T2 | `src/services/apiClient.ts:47,84` | `api.get<T>` é um cast: nada valida o formato da resposta em tempo de execução. | Aceitável para o porte do projeto. Registrar, não mexer. | — | — |
| T3 | `backend/app/routers/activities.py:179`, `training.py:40`, `recovery.py` (várias) | Rotas devolvem `dict` sem `response_model`: sem contrato nem validação de saída. | Adicionar `response_model` em `/performance/me` e `/training/summary`. | Baixo | P |

---

## 10. Lacunas de teste

| ID | Onde | O que falta | Prioridade |
|---|---|---|---|
| L1 | `RunTracking` | Aceitar/descartar ponto de GPS dentro da tela, pausar/retomar, cronômetro, sinal fraco, velocidade alta. Hoje só salvar/recuperar/troca de conta têm teste. | Alta, pré-requisito de R1, R2 e R5. |
| L2 | Tela de Grupo (`Group.tsx`) | **Nenhum teste de tela**: entrar, publicar (com e sem imagem), comentar, curtir, chat. | Alta, pré-requisito de B3, E2 e G3. |
| L3 | `AuthContext` | Sincronização de foto no login (B2). | Alta. |
| L4 | `groupSocket.ts` | Reconexão, cancelamento, compartilhamento de conexão. | Média, pré-requisito de S1 e E4. |
| L5 | Serviços: `usersApi.getUserProfile` (mescla), `eventsApi` | Só testados por mock nas telas. | Média. |
| L6 | Telas sem teste: Social, Home, Pet, Treinador, Cadastro, Completar perfil, Verificar e-mail, Ação de e-mail, Conquistas, Dashboard (parcial) | — | Baixa antes da banca; escrever só onde for mexer. |
| L7 | Backend | Concorrência (B1, B7), falhas de JWKS (S7), limites de entrada (S2, S3), `/activities/by-users`, limite de `/activities/user/{id}`. | Média; cada correção leva o seu teste. |
| L8 | Testes que dão falsa segurança | `profilePage.test.tsx:90`, `eventsPage.test.tsx:135` (ver E1). | Alta; corrigir junto com E1. |

Cobertura que **existe e é boa**: regras de XP/RunCoins/km (com teste de paridade front/back), exclusão de conta, exportação LGPD, privacidade de rota, rate limit, tênis, treinos, sono, fila offline, cliente de API.

---

## 11. Os 10 achados mais importantes (risco real primeiro, estética por último)

| # | ID | Achado | Por quê nesta posição |
|---|---|---|---|
| 1 | **B1** | Corrida de concorrência no broadcast do WebSocket: 500 depois do commit e mensagem duplicada. | Reproduzido. Dispara exatamente no cenário de demonstração (várias pessoas no mesmo grupo). Correção de poucas linhas. |
| 2 | **R1** | Cronômetro por contagem de ticks, **nunca medido com tela bloqueada**; resultados do roteiro Android em branco. | Não sei se falha, e esse é o problema: é o núcleo do produto e o pior caso é a corrida não salvar. Custa 15 minutos de teste no celular para saber. |
| 3 | **B2** | Foto personalizada sobrescrita pela foto do Google a cada abertura. | Reproduzido. Afeta toda conta Google, visível a olho nu. |
| 4 | **E1** | Erros engolidos: com o servidor dormindo, perfil zerado e grupos falsos em vez de mensagem de erro; dois testes dão falsa cobertura. | O Render gratuito dorme. É o estado em que o app vai estar na primeira abertura da banca. |
| 5 | **S1** | Token de autenticação na URL do WebSocket. | Risco de segurança real e conhecido desde o plano de melhorias. |
| 6 | **S4 + S2 + S3** | Nome/foto da corrida vindos do cliente (personificação no feed) e campos de texto sem limite. | Falhas de validação de entrada num feed público. |
| 7 | **P1** | Fotos base64 repetidas por item e listas inteiras recarregadas a cada evento. | Consumo de dados e lentidão que crescem com o uso do chat. |
| 8 | **F-A** | Firestore mantido só por causa de dados de demonstração. | Maior simplificação possível do projeto, mas depende de decisão de produto. |
| 9 | **P2 + P3** | Consultas pesadas: histórico inteiro com todas as colunas; N+1 em eventos. | Baratas de corrigir, já têm teste. |
| 10 | **B3, B4, B5, B7** | Post só com imagem nunca funciona; uid como nome; curtida que não reflete; 500 em entrada simultânea. | Bugs pequenos e baratos. |
| — | M1–M10, G1–G3, R5 | Código morto, duplicação, divisão de arquivos grandes. | Estética e manutenção: por último. |

---

## 12. Agrupamento sugerido em PRs

Ordem proposta. Cada PR: teste que fixa (ou que falha, no caso de bug) → mudança → verificação completa → releitura do diff → PR em português. Um tema por branch a partir da `main` atualizada.

**Bloco A — bugs (pequenos, alto valor, antes de qualquer refatoração)**

| PR | Branch | Itens | Tam. | Validar no celular? |
|---|---|---|---|---|
| A1 | `fix/ws-broadcast-concorrencia` | B1 | P | Não (teste automatizado reproduz). Vale conferir o item 3.3 do roteiro. |
| A2 | `fix/foto-google-sobrescreve-perfil` | B2, L3 | P | Sim: trocar a foto com conta Google, fechar e reabrir o app. |
| A3 | `fix/grupos-eventos-pequenos` | B3, B4, B7, S6 | P | Sim: publicar só com imagem. |
| A4 | `fix/feed-curtida-e-refresh` | B5, B6 | P | Não. |
| A5 | `fix/cronometro-tempo-real` | R1, R4 (+ L1 no que toca o cronômetro) | P | **Sim, obrigatório:** 10 min com tela bloqueada comparando com cronômetro, antes **e** depois. |

**Bloco B — erros e segurança**

| PR | Branch | Itens | Tam. | Validar no celular? |
|---|---|---|---|---|
| B1 | `fix/erros-de-carregamento-perfil-eventos` | E1 (perfil, estatísticas, eventos), L8 | M | Sim: abrir com o backend hibernado. |
| B2 | `fix/erros-de-carregamento-grupos-feed` | E1 (grupos, feed), E2, E5, M6 | M | Sim: modo avião dentro de um grupo. |
| B3 | `fix/api-timeout-e-reconexao-ws` | E3, E4, L4 | P | Sim: rede ruim. |
| B4 | `security/validacao-de-entrada` | S2, S3, S8 | P | Não. |
| B5 | `security/autor-da-corrida-pelo-servidor` | S4 | P | Sim: feed mostra nome/foto certos. |
| B6 | `security/ws-token-fora-da-url` | S1 | M | Sim: chat em tempo real com APK novo **e** com o 0.2.0. |
| B7 | `security/jwks-resiliente-e-limites` | S7, S9, S10 | P/M | Não. |

**Bloco C — desempenho**

| PR | Branch | Itens | Tam. | Validar no celular? |
|---|---|---|---|---|
| C1 | `perf/consultas-backend` | P2, P3, P5, P6, M8, T3 | M | Não. |
| C2 | `perf/feed-polling` | P4 (só a pausa em segundo plano) | P | Opcional. |
| C3 | `perf/payload-de-grupos` | P1 (opção escolhida por você) | P–M | Sim. |

**Bloco D — limpeza e refatoração (comportamento idêntico)**

| PR | Branch | Itens | Tam. |
|---|---|---|---|
| D1 | `chore/codigo-morto-e-lint` | M1, M2, M3, M4, M10 | P |
| D2 | `refactor/parametros-fantasmas` | M5 | M |
| D3 | `refactor/backend-duplicacao` | M7 (sem `activity_effects.py`) | P |
| D4 | `refactor/chatbot-conhecimento` | G1 | M (movimentação pura) |
| D5 | `refactor/firestore-removal` (2 PRs) | F-A, F1–F9, T1, P8, P9 | M + M. **Depende da pergunta 2.** |
| D6 | `refactor/profile-em-arquivos` | G2 | M |
| D7 | `refactor/group-em-arquivos` | L2 primeiro, depois G3 | M + M |
| D8 | `refactor/run-tracking` (3 PRs) | L1, R2, R3, R5 | G. **Só depois do roteiro Android executado e de A5 validado.** |

**Fora de escopo agora (citar como trabalho futuro na banca):** S5 (`memberIds` expostos), P1 opção 3 / object storage, P7 (índices), M9, S11, S12.

**Se o tempo até a banca for curto, o recorte que eu faria:** Bloco A inteiro, B1, B4 e D1. O resto é melhoria, não necessidade.

---

## 13. O que verifiquei e o que não verifiquei

**Verificado nesta sessão:** leitura de todo o backend (`app/`, migrações, testes) e de todo `src/`; linha de base completa (seção 0); B1 reproduzido com script isolado; B2 reproduzido com teste isolado; B3, S2 e S3 conferidos carregando os schemas; índices conferidos no Postgres; ausência de Storage conferida no bundle; imports sem uso conferidos com `tsc --noUnusedLocals`; CVEs do `python-jose` conferidas na internet.

**Não verificado (preciso de você ou de um aparelho):**

- **R1** — comportamento dos timers do WebView com tela bloqueada. A documentação do plugin de GPS só fala de limitação de HTTP após 5 min em segundo plano; sobre `setInterval` achei apenas uma fonte genérica, não específica deste plugin. **Trate como hipótese até medir.**
- Se existem grupos e eventos **reais** em produção (decide o impacto de F-A). Não consultei o banco de produção.
- Tamanho real do Firestore dentro do chunk `firebase` (P9).
- Qual build do APK os testadores têm instalado (afeta S1, S5 e os limites de S3).
- Nada do que depende de GPS real, segundo plano, login Google nativo ou WebSocket no aparelho.

## 14. Perguntas que travam a Fase 2

1. **Quais PRs você aprova?** (Pode ser por bloco ou por ID.)
2. **Dados de demonstração:** posso remover os 3 grupos e os 3 eventos falsos e, com eles, o Firestore inteiro (F-A)? Muda o que aparece com o banco vazio ou com a API fora. Há grupos e eventos reais em produção?
3. **Post só com imagem (B3):** libero no backend (o que a tela promete) ou bloqueio na tela?
4. **O roteiro `docs/TESTE_ANDROID.md` foi executado em aparelho?** O arquivo de resultados está em branco. Consegue fazer o teste do cronômetro (R1) antes de eu mexer na tela de corrida?
5. **Fotos (P1):** aceita reduzir o avatar para ~128 px no envio (muda levemente a nitidez na tela de perfil), ou prefere só a busca incremental do chat, sem tocar na imagem?
6. **Prazo:** quantos dias até a banca? Define se vale passar do recorte mínimo.

## Fontes (verificação externa)

- python-jose 3.4.0, notas de versão com as correções das duas CVEs: https://newreleases.io/project/pypi/python-jose/release/3.4.0
- CVE-2024-33663 (Debian): https://security-tracker.debian.org/tracker/CVE-2024-33663
- CVE-2024-33664 (OSV): https://api.osv.dev/v1/vulns/CVE-2024-33664
- Plugin de GPS em segundo plano, limitação documentada após 5 min: https://www.github.com/capacitor-community/background-geolocation
- Artigo genérico sobre timers em segundo plano no Capacitor (não específico do plugin): https://dev.to/jscrambler/background-services-in-ionic-capacitor-37gi
