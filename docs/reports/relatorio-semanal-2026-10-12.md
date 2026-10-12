# Relatório Semanal de Desenvolvimento, Qualidade e Auditoria Técnica

## 1. Capa e identificação

| Campo | Valor |
|---|---|
| Projeto | **Runnex** (repositório/pacote `veloxy`, versão `0.1.3`) |
| Tipo | App de corrida gamificado: PWA + Android (Capacitor) + API própria (FastAPI/PostgreSQL) |
| Data da auditoria | 12/10/2026 |
| Período analisado | 30/09/2026 (última análise, nota 8,0) → 12/10/2026 |
| Código analisado | Cópia local `D:\Projetos\Runnex-main` (pasta extraída, **sem histórico git**; todos os arquivos com data de 02/10/2026) |
| Relatórios anteriores usados | `weekly-report-2026-08-17.md`, `weekly-report-2026-08-28.md`, `analise-tecnica-2026-09-30.docx`, `docs/PLANO_MELHORIAS.md` |
| Escopo | 100% dos arquivos de `src/`, `backend/app/`, `backend/tests/`, `firestore.rules`, `storage.rules`, CI, configs Android/Capacitor. Leitura integral dos routers do backend, serviços do frontend e de `RunTracking.tsx`; leitura dirigida (busca por padrões) nas demais telas |

> **Limitação principal:** como a pasta não é um repositório git, não foi possível ver commits, autores nem diffs. A "evolução da semana" foi reconstruída comparando o código atual com os problemas listados na análise de 30/09 e com o `PLANO_MELHORIAS.md`. Não há evidência de nenhuma alteração posterior a 02/10/2026.

---

## 2. Resumo executivo

**Estado atual:** o Runnex é um projeto tecnicamente maduro para o porte (TCC): backend próprio com validação no servidor, ~195 testes automatizados, CI com Postgres real e emulador de regras do Firestore. Lint e tipagem estão limpos, o build de produção passa e todos os testes que puderam rodar passaram.

**Principais avanços verificados desde 30/09**
- ✅ CORS do app Android/iOS corrigido (`backend/app/main.py`) — o problema crítico da análise anterior.
- ✅ Vazamento de perfil privado no feed corrigido (`backend/app/listing.py` → `visible_to()` aplicado em `/activities/feed`, `/activities/by-users`, `/users/by-ids`), com testes dedicados.
- ✅ Teto de 100 itens em listagens (`page_size()`).
- ✅ Regras do Firestore fechadas (coleções antigas negadas; só o dono lê o próprio doc) com teste no emulador no CI.
- ✅ Política de privacidade reescrita (`LEGAL_VERSION = 2026-10-01`) e reaceite de termos para todos (`TermsGate.tsx`, 6 testes passando).

**Principais problemas encontrados nesta auditoria (novos)**
1. 🟠 **GPS "congela" a distância após um salto > 500 m** (`RunTracking.tsx:292` e `:393`): se o sinal some num túnel, ou o usuário pausa, anda e retoma, todos os pontos seguintes são descartados até o fim da corrida.
2. 🟠 **17 vulnerabilidades em dependências de produção**, incluindo 1 crítica em `@capacitor/android` (correção disponível sem quebra: 8.4 → 8.5.x).
3. 🟡 **RunCoins podem ser "farmados"** criando e apagando corridas: apagar recalcula XP, mas não estorna moedas nem km semanal do grupo, e libera de novo a cota diária de 24 h.
4. 🟡 **Leitura de comentários de outro grupo** (`groups.py:337`): a rota valida que você é membro do grupo da URL, mas busca comentários só pelo `post_id`.
5. 🟡 **Desempenho**: 5 telas baixam o histórico inteiro de corridas **com as rotas GPS** a cada abertura, e fotos em base64 (até 300 KB) vão em todo item de feed/chat.

**Riscos mais importantes:** comportamento real no Android ainda **não validado em aparelho** (roteiro `docs/TESTE_ANDROID.md` sem resultados registrados); dependências vulneráveis; perda silenciosa de distância na funcionalidade principal.

**Funcionalidades que mais precisam de atenção:** Registro de corrida (GPS), Pet/RunCoin (integridade da economia), Grupos (autorização de comentários).

| Indicador | Valor |
|---|---|
| **Nota geral (média ponderada desta metodologia)** | **7,3 / 10 — Bom** |
| Nota da análise anterior (30/09) | 8,0 / 10 (metodologia diferente — ver seção 12) |
| Variação | −0,7 nominal, **não comparável diretamente**; em termos de qualidade real, o projeto **melhorou** (5 correções verificadas, 0 regressões) |
| Maturidade | Beta funcional. Pronto para testes internos e demonstração; não pronto para lançamento público |

**Conclusão:** a base é sólida e a evolução é saudável — os problemas apontados há 12 dias que dependiam só de código foram corrigidos com teste. A nota cai em relação a 30/09 porque esta auditoria usa pesos mais exigentes (testes, segurança e desempenho pesam mais) e encontrou cinco problemas novos que a análise anterior não cobriu. Nenhum deles é P0.

---

## 3. Nota geral e situação atual

| Verificação executada nesta auditoria | Comando | Resultado |
|---|---|---|
| Tipagem (TypeScript estrito) | `npm run typecheck` | ✅ 0 erros |
| Lint | `npx eslint .` | ✅ 0 erros, 0 avisos |
| Testes frontend | `npx vitest run` | ✅ **61/61** aprovados (10 arquivos) |
| Testes backend | `pytest` (venv isolado, Python 3.14) | ✅ **61 aprovados**, 0 reprovados, ⚪ **62 não executados** (exigem PostgreSQL; o serviço local exige senha, não utilizada) |
| Testes das regras do Firestore | `firestore-tests/` | ⚪ 11 casos **não executados** (exigem emulador + Java) |
| Build de produção | `npx vite build` (saída no diretório temporário) | ✅ OK; PWA com 64 entradas (1,36 MB) em precache |
| Auditoria de dependências | `npm audit --omit=dev` | ❌ 17 vulnerabilidades (1 crítica, 12 altas, 4 moderadas) |
| Execução no navegador | `npm run dev` + navegador embutido | ⚠️ Inconclusiva: sem `.env.local` a página fica em branco (ver P3-07) |
| App Android em aparelho | — | ⚪ Não executado (sem aparelho) |

**Falhas que impedem considerar o projeto pronto para lançamento** (independentemente da média):
- Funcionamento no Android não comprovado em aparelho real (GPS em segundo plano, login Google nativo, CORS).
- Dependência com vulnerabilidade crítica no runtime Android.
- Perda de distância em corridas com interrupção de sinal (P1-01).
- Sem fila offline: corrida que falha ao salvar sem internet depende do usuário reabrir a tela.

---

## 4. Evolução da semana

> Base de comparação: problemas e plano registrados em 30/09–01/10. "Verificado" = conferido no código desta cópia; testes do backend correspondentes existem, mas **não puderam ser executados** aqui por falta de banco.

### 4.1 Funcionalidades concluídas
| Item | O que mudou | Impacto | Verificação |
|---|---|---|---|
| Reaceite de Termos de Uso | `TermsGate` pede aceite quando `termsVersion` ≠ `LEGAL_VERSION`, inclusive para login Google | Fecha lacuna antiga (apontada desde agosto) | Código + 6 testes de `termsGate.test.tsx` ✅ |
| Política de privacidade real | `src/content/legalContent.ts` reescrito, cita Firebase/Render, direitos LGPD | Coerência legal | Leitura do conteúdo |

### 4.2 Parcialmente implementadas
- **Unidade km/mi**: só a "Distância total" da Home converte. Corrida, Estatísticas, Feed e Perfil continuam sempre em km, embora a configuração diga "Define a unidade preferida para corridas".
- **Conquistas que desbloqueiam acessórios do pet**: calculadas no cliente; o servidor não confere se a conquista existe antes de equipar.

### 4.3 Iniciadas
Nenhuma funcionalidade nova identificada no período.

### 4.4 Bugs corrigidos e correções verificadas
| Problema (30/09) | Status | Evidência |
|---|---|---|
| CORS bloqueava o app Android | ✅ Corrigido no código / ⚪ aparelho não validado | `main.py` inclui `https://localhost` e `capacitor://localhost`; teste `test_cors_allows_web_and_native_apps` existe |
| Perfil privado vazava no feed, by-users, by-ids | ✅ Corrigido | `listing.visible_to()` em 3 rotas; 5 testes em `test_listing.py` |
| Listagens sem limite | ✅ Corrigido | `page_size()` com `MAX_PAGE_SIZE = 100` |
| Firestore antigo legível por qualquer logado | ✅ Corrigido no arquivo / ⚪ deploy não verificável | `firestore.rules` nega `activities`, `groups`, `events`, `products` |

### 4.5 Melhorias de código e arquitetura
- Regra de visibilidade centralizada em `backend/app/listing.py` (uma função usada por todas as listagens), em vez de repetida em cada router.
- `firestore.rules` reduzido de 817 para ~339 linhas (segundo o plano; tamanho atual confirmado: 11,3 KB).

### 4.6 Melhorias visuais/UX
Nenhuma identificada no período.

### 4.7 Integrações
- CORS para Capacitor (acima). Nenhuma integração nova.

### 4.8 Problemas novos identificados nesta auditoria
P1-01 (GPS congela), P1-02 (dependências), P2-01 (farm de RunCoins), P2-02 (comentários entre grupos), P2-03/P2-04 (desempenho), P2-05 (endpoints `async` com banco síncrono), P3-01 a P3-10. Detalhes na seção 13.

### 4.9 Problemas antigos ainda sem solução
| Item (origem) | Situação |
|---|---|
| Aviso "não substitui profissional" na tela do Treinador (30/09, #6) | ❌ Não existe em `Coach.tsx` |
| Limpar histórico do treinador ao excluir conta (30/09, #7) | ❌ `deleteCurrentAccount` não chama `clearCoachHistory` |
| Atualizar react-router/firebase; `npm audit fix` (30/09, #5) | ❌ Mesmas versões; vulnerabilidades aumentaram de 8 para 17 |
| Conquistas calculadas no servidor (30/09, #14) | ❌ |
| Testes de tela / ponta a ponta (30/09) | ❌ Nenhum teste de `RunTracking`, `Group`, `Profile`, `Social` |
| Arquivos muito grandes (30/09) | ❌ `chatbot_logic.py` 991, `RunTracking.tsx` 959, `Profile.tsx` 886, `Group.tsx` 831 linhas |

### 4.10 Tarefas planejadas não concluídas (`PLANO_MELHORIAS.md`)
| Fase | Tarefa | Status |
|---|---|---|
| M1 | APK novo + roteiro Android executado e anotado | ⚪ Sem registro de resultado |
| M2 | Tela "acordando o servidor" (ping `/health`) | ❌ Nenhuma chamada a `/health` no frontend |
| M2 | Botão voltar do Android (`@capacitor/app`) | ❌ Pacote não instalado |
| M2 | Fila offline de corridas | ❌ |
| M3 | `versionCode`/`versionName` | ❌ Ainda `1` / `"1.0"` |
| P2 | Exportar meus dados (`GET /users/{uid}/export`) | ❌ |
| P2 | Zona de privacidade na rota | ❌ |
| P2 | `android:allowBackup="false"` | ❌ Ainda `true` |
| P3 | Token do WebSocket fora da URL | ❌ Ainda `?token=` |
| R1/R2 | Main atualizada, tags, limpeza de branches | ⚪ Não verificável (sem git) |

---

## 5. Avaliação das funcionalidades

> Notas por funcionalidade refletem o código e os testes que rodaram. "Inconclusiva" = depende de execução em aparelho/servidor real não feita aqui.

### 5.1 Autenticação (e-mail/senha + Google)
- **Objetivo:** cadastro, login, confirmação de e-mail, recuperação de senha, exclusão de conta.
- **Estado:** Implementada e testada (parcialmente).
- **Funciona:** token Firebase validado no backend via JWKS com cache (`auth.py`); `PrivateRoute` bloqueia e-mail não verificado e o backend também (`require_verified_email` ao salvar corrida); exclusão de conta reautentica antes de apagar e trata grupos órfãos (`account_deletion.py`).
- **Parcial:** `require_verified_email` só protege `POST /activities`; demais escritas (posts, chat, pet) aceitam conta não verificada se chamadas direto na API.
- **Ausente:** histórico local do treinador não é apagado na exclusão.
- **Testes:** `useAuth.test.tsx` (4 ✅), `createUserProfile.test.ts` (2 ✅); `test_auth.py` (6, não executados).
- **Dependências:** Firebase Auth, `@capacitor-firebase/authentication` (versão com alerta alto).
- **Nota: 8,0** — fluxo robusto e bem pensado; perde por a verificação de e-mail no servidor ser só parcial e pelo login nativo não ter sido validado.
- **Melhorias:** aplicar `require_verified_email` nas escritas sociais; limpar `veloxy-coach-<uid>` na exclusão.

### 5.2 Registro de corrida (GPS)
- **Objetivo:** gravar a corrida com GPS em primeiro e segundo plano, recuperar após o app ser encerrado, salvar com validação.
- **Estado:** **Com falhas**.
- **Funciona:** watcher nativo em segundo plano no Android; filtro de precisão (> 50 m descartado) e de velocidade (> 30 km/h); snapshot em `localStorage` para retomar; simulador só em modo dev; mensagens de erro específicas por status HTTP; servidor valida velocidade média, rota mínima, distância × rota e teto de 24 h/dia (`activity_rules.py`).
- **Quebrado:** (P1-01) depois de um salto > 0,5 km entre pontos, o "último ponto" nunca é atualizado, então **todos os pontos seguintes são descartados**. Cenários reais: túnel, pausar e caminhar até outro lugar, retomar uma corrida recuperada após se deslocar.
- **Problemas menores:** lógica de processamento do GPS duplicada (`applyGpsPoint` e o watcher web, linhas 260–300 e 364–400); `console.log` com coordenadas a cada ponto (linha 367); texto corrompido "incompatÃ­vel" (linha 278); ritmo pode exibir `5'60"` por arredondamento (`getPace`); aviso de "GPS fraco" dispara um toast a cada leitura ruim.
- **Testes:** `route.test.ts` cobre utilitários de rota; **nenhum teste do componente** nem do filtro de pontos.
- **Nota: 6,0** — engenharia cuidadosa, mas o defeito atinge a funcionalidade central de forma silenciosa.
- **Melhorias:** extrair o filtro de pontos para `src/lib/route.ts` (uma função pura, testável) e, quando o salto for grande, reiniciar o segmento (aceitar o novo ponto como âncora sem somar distância).

### 5.3 Feed da comunidade e curtidas
- **Estado:** Implementada, mas não testada suficientemente (no cliente).
- **Funciona:** paginação por cursor (`before_id`), perfis privados excluídos, curtida limitada por rate limit.
- **Parcial:** atualização por polling a cada 15 s (não tempo real); curtida não verifica se a corrida pertence a perfil privado.
- **Problemas:** cada item carrega `userAvatar` em base64 (até 300 KB) e a rota GPS completa.
- **Testes:** `feed-utils.test.ts` (11 ✅), `test_activities.py::test_feed_is_newest_first_and_paginates` (não executado).
- **Nota: 7,5**.

### 5.4 Dashboard / Estatísticas / Conquistas
- **Estado:** Implementada, mas não testada suficientemente.
- **Funciona:** totais, ritmo médio, sequência de dias, gráfico semanal, 12 conquistas derivadas do histórico real (`lib/achievements.ts`).
- **Problemas:** `getUserStats` pede `limit=100000` e soma tudo no cliente, baixando todas as rotas (P2-03); é chamado em Home, Dashboard, Perfil, Conquistas e Pet sem cache compartilhado.
- **Testes:** `gamification.test.ts` (✅); cálculo de sequência/semana sem teste.
- **Nota: 7,0**.

### 5.5 XP, níveis e ranking global
- **Estado:** Implementada e testada.
- **Funciona:** XP calculado no servidor; recálculo ao apagar corrida; ranking exclui privados; paridade front/back testada (`test_parity.py`, executado ✅).
- **Nota: 8,5**.

### 5.6 Grupos (feed, comentários, chat em tempo real)
- **Estado:** Implementada, com falha de autorização.
- **Funciona:** membros-only em posts, mensagens, curtidas e WebSocket; autor/foto vêm do banco (não do cliente); rate limit em todas as escritas; grupos de demonstração identificados na tela.
- **Quebrado/ausente:** (P2-02) comentários de qualquer post legíveis por quem é membro de *outro* grupo; qualquer usuário pode entrar em qualquer grupo (sem moderação/aprovação, sem remover membro, sem apagar post); `memberIds` de todos os grupos (inclusive de perfis privados) retornado para qualquer logado.
- **Testes:** `groupsApi.test.ts` (8 ✅); `test_groups.py` (9, não executados) — nenhum cobre post de outro grupo.
- **Nota: 7,0**.

### 5.7 Eventos
- **Estado:** Implementada parcialmente.
- **Funciona:** listar e inscrever (idempotente); eventos de demonstração quando a API retorna vazio.
- **Ausente:** cancelar inscrição (não existe endpoint `leave`); listagem sem limite e com 1 consulta por evento para participantes (N+1); eventos demo exibem números fictícios ("420 participantes") como se fossem reais; em erro de API a lista fica vazia (sem mensagem).
- **Testes:** `test_events.py` (2, não executados).
- **Nota: 6,0**.

### 5.8 Perfil e configurações
- **Estado:** Implementada, mas não testada suficientemente.
- **Funciona:** editar nome/foto/bio/local (validação de imagem no servidor), perfil privado, tema claro/escuro, apagar todas as corridas com confirmação dupla.
- **Problemas:** descrição do "Perfil privado" diz só "rankings públicos" (hoje também oculta do feed); unidade km/mi quase sem efeito; `Profile.tsx` com 886 linhas e 18 `useState`.
- **Nota: 7,0**.

### 5.9 Pet virtual, RunCoin e loja de acessórios
- **Estado:** Implementada, com falhas de integridade.
- **Funciona:** escolha única da espécie; preço vem do catálogo do servidor; compra repetida não cobra duas vezes; auto-criação do perfil (corrige bug de agosto).
- **Problemas:** (P2-01) farm de moedas via criar/apagar corrida; (P3-03) compra concorrente pode gastar o mesmo saldo duas vezes (sem `SELECT … FOR UPDATE`); acessórios de conquista equipáveis sem checagem no servidor.
- **Testes:** `pet.test.ts` (6 ✅); `test_pet.py` (7, não executados).
- **Nota: 7,0**.

### 5.10 Treinador virtual (chatbot por regras)
- **Estado:** Implementada e testada.
- **Funciona:** usa corridas reais; meta semanal limitada; "aprender" com limites; memória por usuário; rate limit 30/min.
- **Ausente:** aviso de saúde; limpeza do histórico local na exclusão de conta.
- **Testes:** `chatbot.test.ts` (3 ✅); `test_chatbot.py` (10 de API não executados + testes de lógica pura executados ✅).
- **Nota: 7,5**.

### 5.11 PWA e Android (Capacitor)
- **Estado:** Implementada, mas não testada suficientemente — **avaliação inconclusiva**.
- **Funciona (código):** service worker gerado; permissões de localização e serviço em primeiro plano; CORS liberado.
- **Problemas:** `allowBackup="true"`, `minifyEnabled false`, `versionCode 1`; dependência `@capacitor/android` com alerta crítico; sem tratamento do botão voltar; sem aviso de servidor "acordando" (Render gratuito).
- **Nota: inconclusiva** (estimativa 6,0 pelo código).

### 5.12 Termos, privacidade e LGPD
- **Estado:** Implementada e testada (cliente).
- **Funciona:** política fiel ao app, reaceite por versão, exclusão de conta completa no backend.
- **Ausente:** exportação de dados (art. 18 LGPD), zona de privacidade da rota, corridas públicas por padrão (decisão de produto pendente).
- **Nota: 7,5**.

### 5.13 Marketplace / loja com checkout
- **Estado:** **Não implementada** (fora de escopo por decisão documentada em `docs/BANCA_TRABALHOS_FUTUROS.md`). Existe só um catálogo somente-leitura (`GET /products`) sem uso aparente no app. Sem nota.

---

## 6. Notas individuais por módulo e componente

| Componente ou funcionalidade | Estado | Nota | Problema principal | Melhoria recomendada |
|---|---|---:|---|---|
| `RunTracking.tsx` (tela de corrida) | Com falhas | 6,0 | Distância congela após salto > 500 m | Extrair filtro de pontos para função pura + teste |
| `Home.tsx` | Implementada | 7,5 | 3 chamadas (stats completos + atividades + perfil) a cada abertura | Cache compartilhado de stats |
| `Dashboard.tsx` | Implementada | 7,5 | Mesmo custo de `getUserStats` | Endpoint de resumo no servidor |
| `Social.tsx` (feed + grupos + ranking) | Implementada | 7,0 | 641 linhas; polling 15 s | Dividir em feed/grupos/ranking |
| `Group.tsx` | Implementada | 7,5 | Arquivo de 831 linhas (bem dividido internamente) | Mover subcomponentes para `components/group/` |
| `Profile.tsx` | Implementada | 6,5 | 886 linhas, 18 estados, copy desatualizado | Separar modais em arquivos |
| `Events.tsx` | Parcial | 6,0 | Sem cancelar inscrição; demo parece real | Endpoint `leave` + selo "demonstração" |
| `Pet.tsx` | Implementada | 7,0 | Depende de economia vulnerável | Corrigir P2-01 no backend |
| `Coach.tsx` | Implementada | 7,5 | Sem aviso de saúde | 1 linha de aviso |
| `Achievements.tsx` | Implementada | 7,5 | Cálculo só no cliente | Mover para servidor (futuro) |
| `Login.tsx` / `Register.tsx` | Implementada | 7,5 | 609/662 linhas | Extrair campos/validações |
| `VerifyEmail` / `AuthAction` / `ForgotPasswordModal` | Implementada | 8,0 | — | — |
| `TermsGate.tsx` | Implementada e testada | 9,0 | — | — |
| `PrivateRoute.tsx` | Implementada | 8,5 | — | — |
| `ErrorBoundary.tsx` | Implementada | 7,0 | Não cobre falha no import do Firebase (tela branca) | Validar env antes de `initializeApp` e mostrar tela de erro |
| `BottomNav` / `SideNav` (navegação) | Implementada | 8,0 | Desktop só em parte das telas | — |
| Rotas (`App.tsx`) | Implementada | 8,0 | Aliases duplicados (`/feed`=`/social`, `/dashboard`=`/stats`) | Redirecionar aliases |
| `apiClient.ts` | Implementada e testada | 8,5 | Sem timeout/retry | `AbortController` com timeout |
| `groupSocket.ts` | Implementada e testada | 7,5 | Token na URL; reconexão sem backoff crescente | Token na 1ª mensagem; backoff exponencial |
| `activitiesApi.ts` | Implementada | 7,0 | `getUserStats` baixa tudo | Endpoint `/users/{id}/stats` |
| `groupsApi.ts` / `eventsApi.ts` | Implementada | 7,0 | Persistência híbrida Firestore+Postgres para demos | Criar demos no Postgres (seed) e remover Firestore |
| `usersApi.ts` | Implementada | 7,0 | `getUserProfile` = 4 requisições | Incluir grupos/eventos na resposta do perfil |
| Backend `auth.py` | Implementada e testada | 8,5 | `requests.get` síncrono dentro do WebSocket assíncrono | `httpx.AsyncClient` ou `run_in_threadpool` |
| Backend `activities.py` | Implementada | 7,0 | Apagar corrida não estorna moedas/km de grupo | Ver P2-01 |
| Backend `groups.py` | Com falha | 6,5 | Comentários sem checar grupo do post | Ver P2-02 |
| Backend `pet.py` | Implementada | 7,0 | Corrida de concorrência na compra | `with_for_update()` |
| Backend `events.py` | Parcial | 6,0 | Sem limite, N+1, sem `leave` | `selectinload` + paginação |
| Backend `chatbot.py` / `chatbot_logic.py` | Implementada e testada | 7,5 | 991 linhas num arquivo | Separar intenções/respostas |
| `activity_rules.py` / `validators.py` | Implementada e testada | 9,0 | Rota coerente inventada ainda passa (limite conhecido) | — |
| `rate_limit.py` | Implementada e testada | 8,0 | Em memória (uma instância) | Redis se escalar |
| Migrations Alembic | Implementada | 8,5 | — (CI roda `alembic check`) | — |
| `firestore.rules` | Implementada (testes não rodados aqui) | 8,0 | Deploy não verificável | Confirmar publicação |
| `storage.rules` | Código morto | — | App não usa Storage (imagens são base64 no Postgres) | Fechar tudo (`if false`) |
| Estados de carregamento/erro | Implementada | 7,5 | Erros de API viram lista vazia em Eventos/feed sem aviso | Estado de erro com "tentar de novo" |
| Responsividade | Parcial | 6,5 | `lg:` só em Home, Dashboard, Perfil, Grupo, Coach | Layout desktop em Social/Eventos/Pet |
| Tratamento de exceções (backend) | Implementada | 7,0 | `print()` em vez de `logging`; exceções genéricas engolidas | `logging` estruturado |

**Escopo:** todas as telas, serviços, routers e utilitários com regra de negócio. Componentes visuais simples (`GlassCard`, `StatCard`, `SafeAvatar`, `skeleton`, `tooltip`) não foram avaliados individualmente.

### Componentes prioritários
- **`RunTracking.tsx`** — é o coração do produto. Além do P1-01, o mesmo algoritmo de aceitação de ponto existe em dois lugares; uma correção feita em um não chega ao outro (risco de regressão real). Recomenda-se uma função `acceptGpsPoint(prevPath, point) → {path, addedKm}` em `lib/route.ts`, com testes para: ponto ruidoso (< 5 m), salto grande, retomada após pausa.
- **`groups.py`** — o padrão de autorização (`_require_member`) é bom, mas precisa também verificar que o recurso filho pertence ao grupo validado. Hoje isso é feito para curtir/comentar (`GroupPost.group_id == group_id`), mas não para listar comentários.
- **`activities.py` + `pet.py`** — a economia do pet é derivada de corridas, mas apagar corrida só desfaz parte dos efeitos. Isso transforma uma funcionalidade legítima (apagar corrida errada) num gerador de moedas.

---

## 7. Auditoria do código e arquitetura

**Pontos fortes:** TypeScript estrito sem nenhum `any`, nenhum `eslint-disable`, nenhum `TODO`; comentários explicam *por que* (com referência a bugs reais encontrados); serviços do frontend divididos por domínio espelhando os routers; schemas Pydantic com limites explícitos; teste de paridade entre constantes duplicadas front/back.

| # | Problema | Evidência | Impacto técnico | Consequência para o usuário | Gravidade | Solução | Esforço |
|---|---|---|---|---|---|---|---|
| C1 | Lógica de GPS duplicada | `RunTracking.tsx:260-300` e `:364-400` | Correções divergem | Comportamento diferente web × Android | Média | Função única em `lib/route.ts` | Pequeno |
| C2 | Endpoints `async def` usando sessão SQLAlchemy síncrona | `groups.py:263` (`create_group_post`) e demais escritas de grupo | Cada consulta bloqueia o loop de eventos do uvicorn; WebSockets de todos os grupos travam durante a query | Chat/feed lentos sob carga | Média | Tornar o handler `def` e enviar o broadcast com `anyio.from_thread`, ou usar sessão assíncrona | Médio |
| C3 | `requests.get` (síncrono) dentro do handler WebSocket | `groups.py:139` → `auth._get_jwks()` | Uma vez por hora bloqueia o loop até 5 s | Travadas esporádicas | Baixa | `run_in_threadpool` | Pequeno |
| C4 | Arquivos grandes | `chatbot_logic.py` 991, `RunTracking.tsx` 959, `Profile.tsx` 886, `Group.tsx` 831, `Register.tsx` 662 | Revisão e teste difíceis | — | Baixa | Dividir quando for mexer | Médio |
| C5 | Sem camada de cache/estado de servidor no frontend | `getUserStats` chamado em 5 telas; `getUserProfile` faz 4 requisições | Requisições repetidas a cada navegação | Telas lentas no 4G | Média | Cache simples por usuário (ou React Query) | Médio |
| C6 | Persistência híbrida para dados de demonstração | `groupsApi.ts`/`eventsApi.ts` gravam `joinedGroupIds`/`enrolledEvents` no Firestore | Duas fontes da verdade; mantém Firestore vivo só para demo | — | Baixa | Semear grupos/eventos demo no Postgres | Médio |
| C7 | `print()` para erros em vez de `logging` | `activities.py` (save_activity) | Sem níveis/correlação | — | Baixa | `logging.getLogger(__name__)` | Pequeno |
| C8 | API legada do SQLAlchemy | `groups.py` `_get_group_or_404` usa `Query.get` | Aviso de depreciação (silenciado no `pytest.ini`) | — | Informativa | `db.get(Group, id, options=…)` | Pequeno |
| C9 | Dependências em seção errada | `@capacitor/cli`, `@types/leaflet` em `dependencies` | Infla `npm audit --omit=dev` e o install de produção | — | Informativa | Mover para `devDependencies` | Pequeno |
| C10 | Texto com encoding corrompido | `RunTracking.tsx:278` "incompatÃ­vel" | — | Só no console | Informativa | Corrigir | Pequeno |

---

## 8. Segurança e integridade dos dados

### 8.1 Verificações realizadas
- Leitura de todos os routers quanto a autenticação, dono do recurso e visibilidade.
- Leitura de `firestore.rules`, `storage.rules`, `.gitignore`, `.env.example`, `capacitor.config.ts`, `AndroidManifest.xml`.
- Busca por segredos: **nenhum** `.env`, `.env.local` ou `google-services.json` presente; só arquivos `.example`.
- `npm audit --omit=dev`.

### 8.2 Achados
| ID | Classificação | Achado | Localização |
|---|---|---|---|
| S1 | **Alto** | 17 vulnerabilidades em dependências de produção: **crítica** em `@capacitor/android` 8.4.0 (corrigível em 8.5.x sem quebra); altas em `firebase`/`@firebase/firestore`/`@grpc/grpc-js` e `@capacitor-firebase/authentication`; moderada em `react-router` (open redirect). Parte das "altas" vem de ferramentas de build arrastadas por `tailwindcss-animate` | `package.json` |
| S2 | **Médio** | Comentários de posts de outro grupo legíveis: valida membro do `group_id` da URL, mas filtra só `post_id`. IDs são inteiros sequenciais. Impacto reduzido porque hoje qualquer usuário pode entrar em qualquer grupo, mas permite ler sem aparecer na lista de membros | `backend/app/routers/groups.py:328-340` |
| S3 | **Médio** (integridade) | Farm de RunCoins e de km semanal de grupo: `POST /activities` credita moedas e km; `DELETE /activities/{id}` recalcula só XP/km mensal. Apagar também libera a cota de 24 h. Com rate limit de 10 corridas/10 min, ~60 ciclos/h | `activities.py:100`, `:209`, `:247` |
| S4 | Baixo | Compra de acessório sem bloqueio de linha: duas compras simultâneas leem o mesmo saldo | `pet.py:95-121` |
| S5 | Baixo | Token Firebase na query string do WebSocket (vai para logs de proxy do Render) | `groupSocket.ts` / `groups.py:133` |
| S6 | Baixo | Exposição de UIDs de perfis privados: `memberIds` em `GET /groups`, `GET /groups/joined/{uid}` e `GET /events/enrolled/{uid}` sem checar privacidade | `groups.py:102`, `:427`; `events.py:68` |
| S7 | Baixo | `require_verified_email` só em `POST /activities`; conta não verificada pode postar, conversar e usar o pet via API | routers de grupos/pet/chatbot |
| S8 | Baixo | `android:allowBackup="true"`: backup do Google copia histórico do treinador e snapshot de corrida | `AndroidManifest.xml:5` |
| S9 | Baixo | `storage.rules` permite upload de até 5 MB em caminhos que o app não usa mais | `storage.rules` |
| S10 | Informativo | `console.log` com latitude/longitude a cada ponto de GPS (aparece no logcat do Android) | `RunTracking.tsx:367` |
| S11 | Informativo | Rota GPS completa pública por padrão (revela início/fim, possivelmente a casa) — decisão de produto pendente | `ActivityOut.route` |

### 8.3 O que está bem
Validação de token sem Admin SDK com checagem de `aud`/`iss`; toda escrita compara `current_user.uid` com o dono; autor de post/chat vem do banco (impede se passar por outra pessoa); imagens validadas por assinatura binária e tamanho; preço do pet só no servidor; rate limit por usuário em todas as escritas; exclusão de conta trata curtidas, contadores e grupos órfãos.

### 8.4 Não verificado
Regras do Firestore efetivamente publicadas; configuração de domínios autorizados no Firebase; variáveis e versão do Python no Render; TLS/headers do hosting; comportamento real do WebView Android.

> Não há base para declarar o projeto "seguro": não foram encontrados problemas críticos de autorização, mas os testes de API não puderam ser executados nesta auditoria.

---

## 9. Testes e confiabilidade

| Suíte | Total | Executados | Aprovados | Reprovados | Não executados |
|---|---:|---:|---:|---:|---:|
| Frontend (Vitest) | 61 | 61 | 61 | 0 | 0 |
| Backend (pytest) | 123 | 61 | 61 | 0 | 62 (sem PostgreSQL) |
| Regras Firestore (emulador) | 11 | 0 | — | — | 11 (sem emulador/Java) |
| **Total** | **195** | **122** | **122** | **0** | **73** |

Testes do backend executados: regras de plausibilidade, gamificação, paridade front/back, validadores de imagem, rate limit, lógica pura do chatbot. Não executados: todos os testes de API (auth, atividades, grupos, pet, usuários, listagem/privacidade, exclusão de conta, eventos, chatbot via API).

**O CI do projeto roda as três suítes completas** com Postgres 16 e emulador; não foi possível consultar o resultado das execuções (GitHub inacessível nesta sessão).

**Cobertura por tipo**
| Tipo | Situação |
|---|---|
| Unitários (regras, utilitários) | ✅ Bons |
| Integração API + banco real | ✅ Existem (123), não executados aqui |
| Autenticação e permissões | ✅ Bons no backend |
| Interface (componentes) | ⚠️ Só `TermsGate` e hook `useAuth` |
| Fluxos completos (E2E) | ❌ Nenhum |
| Responsividade / acessibilidade | ❌ Nenhum |
| Desempenho | ❌ Nenhum |
| Regras do Firestore | ✅ 11 casos (não executados aqui) |

**Testes mais importantes a criar**
1. Filtro de pontos de GPS: ruído, salto grande, retomada após pausa (cobre P1-01).
2. Apagar corrida estorna RunCoins e km do grupo (cobre P2-01).
3. Membro do grupo A não lista comentários de post do grupo B (cobre P2-02).
4. Duas compras simultâneas não gastam o mesmo saldo (cobre S4).
5. `RunTracking`: iniciar → pausar → retomar → finalizar com `saveActivity` mockado.
6. E2E (Playwright) do fluxo login → corrida simulada → feed → grupo.
7. Executar `docs/TESTE_ANDROID.md` e registrar o resultado.

---

## 10. Interface e experiência do usuário

> Avaliação **estática** (leitura de código). A tentativa de execução no navegador mostrou tela branca por falta de `.env.local` — por isso consistência visual e contraste não foram medidos.

| Aspecto | Avaliação | Evidência |
|---|---|---|
| Consistência visual | Boa | Tokens de tema (claro/escuro), `GLASS_CARD_CLASS` reutilizado |
| Feedback | Bom | `sonner` com mensagens específicas por tipo de erro (ex.: 422/429 ao salvar corrida) |
| Estados de carregamento | Bom | `LoadingScreen`, skeletons, spinners nos botões |
| Mensagens de erro | Regular | Em Eventos e no feed, falha de API vira lista vazia sem aviso |
| Legibilidade | **Fraca** | **70 ocorrências** de `text-[8px]`/`text-[9px]` em rótulos e status |
| Acessibilidade | Regular | 47 `aria-label`; mas só 1 modal (`TermsGate`) tem `role="dialog"`/`aria-modal`; modais de música, recuperação de corrida, unidade e opções de grupo sem foco preso nem Esc; 2º botão de música em `RunTracking` sem `aria-label`; inputs com `outline-none` |
| Responsividade | Parcial | Layout desktop (`lg:`) só em Home, Dashboard, Perfil, Grupo e Coach |
| Coerência aparência × funcionamento | Regular | Seletor km/mi promete mais do que faz; grupos/eventos demo mostram números fictícios; descrição do "Perfil privado" desatualizada |
| Tela branca sem configuração | Problema | Erro do Firebase no import, fora do `ErrorBoundary` (`config/firebase.ts:24`) — afeta até a página pública de termos |

**Problemas funcionais (não visuais):** P1-01 (distância), unidade de medida, falta de cancelar inscrição em evento.
**Problemas visuais:** tamanho de fonte, desktop parcial, toasts repetidos de GPS fraco.

---

## 11. Desempenho e integrações

### 11.1 Desempenho (sem medições em execução — hipóteses do código)
| ID | Hipótese | Evidência | Como medir |
|---|---|---|---|
| D1 | Histórico completo com rotas baixado em 5 telas | `activitiesApi.ts:242` `limit=100000`; `ActivityOut` inclui `route` (até 5.000 pontos) | DevTools → Network: tamanho de `/activities/user/...` para um usuário com 50 corridas |
| D2 | Fotos base64 (até 300 KB) repetidas em cada item | `user_avatar` em `Activity`; `author_photo` em posts/chat | Tamanho de `/activities/feed` com 10 itens de usuários com foto |
| D3 | Polling do feed a cada 15 s refaz a consulta inteira | `subscribeToFeed` | Contagem de requisições em 5 min |
| D4 | Loop de eventos bloqueado por consultas síncronas | C2 | Latência do chat com 2 grupos ativos e carga simultânea |
| D5 | Eventos: N+1 nos participantes | `events.py:43` + relação lazy | `echo=True` no engine |
| D6 | Pacote inicial | Maior chunk `firebase` 434 kB (132 kB gzip); `react` 54 kB gzip; `maps` 45 kB gzip; `motion` 42 kB gzip; telas em lazy-load ✅ | Lighthouse em 4G simulado |

### 11.2 Integrações
| Integração | Situação | Nota |
|---|---|---|
| Firebase Auth (web e nativo) | Funciona no código; nativo não validado | 7,5 |
| Verificação JWKS no backend | Sólida, com cache | 8,5 |
| PostgreSQL + Alembic | Sólida (`alembic check` no CI) | 8,5 |
| WebSocket de grupo | Funciona; token na URL; uma instância | 7,0 |
| Capacitor (GPS em 2º plano, Google nativo) | Não validado em aparelho | inconclusiva |
| Render (hospedagem backend) | Hiberna no plano gratuito; app não avisa | 6,0 |
| Firestore (resíduo) | Só para dados demo | 6,5 |

---

## 12. Cálculo da nota geral e comparação com a semana anterior

### 12.1 Notas por área (seção 5 do pedido)
| # | Área | Nota | Justificativa resumida | Para subir |
|---|---|---:|---|---|
| 1 | Funcionalidades e regras de negócio | 7,5 | Escopo amplo e coerente; GPS com defeito, economia do pet explorável, eventos incompletos | Corrigir P1-01 e P2-01; `leave` de evento |
| 2 | Interface e design | 7,5 | Visual consistente com tema; fontes muito pequenas; desktop parcial | Mínimo 11–12 px; desktop nas telas restantes |
| 3 | Experiência do usuário | 6,5 | Bons feedbacks; promessas que não se cumprem (km/mi, demo); modais pouco acessíveis | Alinhar textos com funcionamento; modais acessíveis |
| 4 | Organização e qualidade do código | 7,5 | Tipagem/lint impecáveis, bons comentários; arquivos grandes, duplicação no GPS | C1, C4, C5 |
| 5 | Arquitetura do sistema | 8,0 | Separação clara front/API/regras; `async` mal usado; resíduo Firestore | C2, C6 |
| 6 | Banco de dados e persistência | 8,0 | Migrations versionadas, FKs e cascatas corretas; base64 e rotas em JSON inflam leituras; sem lock na compra | Endpoint de stats agregado; `FOR UPDATE` |
| 7 | Segurança e proteção de dados | 7,0 | Autorização correta na maioria; dependências vulneráveis; S2, S3 | S1, S2, S3 |
| 8 | Desempenho | 6,0 | Sem medições; vários padrões caros identificados | D1, D2 |
| 9 | Testes e confiabilidade | 7,0 | 195 testes e CI forte; zero teste de tela crítica/E2E; nesta auditoria só 63% rodaram | Testes da seção 9 |
| 10 | Integrações e serviços externos | 7,0 | Bem integradas; Android não validado; cold start do Render | Roteiro Android; ping `/health` |
| 11 | Documentação técnica | 8,5 | READMEs, arquitetura, roteiro Android, plano; números de testes desatualizados (README diz 52/82; real 61/123) | Atualizar números; registrar resultados do roteiro Android |
| 12 | Progresso e organização | 7,0 | Plano claro e correções rápidas; quase nada das fases M2/P2/P3 andou; repositório não verificável | Executar R1 e M1 |

### 12.2 Média ponderada
| Área (pesos do pedido) | Nota | Peso | Contribuição |
|---|---:|---:|---:|
| Funcionalidades e regras de negócio | 7,5 | 20% | 1,500 |
| Segurança e proteção de dados | 7,0 | 15% | 1,050 |
| Qualidade e organização do código | 7,5 | 15% | 1,125 |
| Testes e confiabilidade | 7,0 | 15% | 1,050 |
| Experiência do usuário e interface (média de 7,5 e 6,5) | 7,0 | 10% | 0,700 |
| Arquitetura e banco de dados (média de 8,0 e 8,0) | 8,0 | 10% | 0,800 |
| Desempenho | 6,0 | 5% | 0,300 |
| Integrações | 7,0 | 5% | 0,350 |
| Documentação e planejamento | 8,5 | 5% | 0,425 |
| **Total** | | **100%** | **7,300** |

**Nota geral: 7,3 / 10 — Bom.**

- **Sobem a nota:** validação no servidor; testes contra Postgres real e CI; correções rápidas e testadas dos problemas de 30/09; código limpo e tipado; documentação acima da média.
- **Descem a nota:** defeito silencioso na corrida (funcionalidade principal); dependências vulneráveis (incluindo crítica); economia do pet explorável; ausência de testes de tela/E2E; desempenho não medido com padrões caros; Android não validado.
- **Confiança da avaliação:** média. Desempenho, UX visual e Android foram avaliados só pelo código; 37% dos testes não rodaram neste ambiente.

### 12.3 Comparação com a análise anterior (30/09)
| | 30/09 | 12/10 |
|---|---|---|
| Nota | 8,0 | 7,3 |
| Metodologia | 10 critérios, nota final com ajuste qualitativo | 9 áreas com pesos fixos (testes, segurança e desempenho pesam mais) |
| Testes | 55 front + 114 back | 61 front + 123 back + 11 regras |
| Vulnerabilidades (`npm audit` prod) | 8 (6 altas) | 17 (1 crítica, 12 altas) — mesmas versões; novos alertas publicados |

**A queda de 0,7 não significa piora.** Em qualidade real houve melhora: os 4 problemas de código de maior severidade foram corrigidos e testados, e não houve regressão. A diferença vem de (a) metodologia mais exigente e (b) cinco problemas novos encontrados nesta auditoria, que já existiam antes. **Esta nota (7,3) passa a ser a linha de base** para as próximas semanas, com a mesma metodologia.

- **Melhoraram:** privacidade/LGPD (vazamento corrigido, política real, reaceite); prontidão mobile no código (CORS).
- **Pioraram:** dependências (mais alertas, nenhuma atualização).
- **Continuam:** testes de tela/E2E, arquivos grandes, conquistas no cliente, aviso do treinador, histórico do treinador na exclusão.
- **Novos riscos:** P1-01, S2, S3.
- **Atrasadas:** M1 (validar Android), M2, P2, P3 do plano.

---

## 13. Problemas priorizados

> Não foi encontrado nenhum P0 (sem vazamento grave confirmado, sem perda de dados persistidos, sem falha que impeça o uso).

| ID | Descrição | Área | Gravidade | Impacto no usuário | Urgência | Dependências | Esforço | Ação |
|---|---|---|---|---|---|---|---|---|
| **P1-01** | Distância congela após salto > 500 m entre pontos de GPS | Corrida | Alta | Corrida registrada com menos km, sem aviso | Alta — afeta a funcionalidade central e a demonstração | — | Pequeno | Aceitar o ponto distante como nova âncora sem somar distância; unificar com C1; testar |
| **P1-02** | Dependências com vulnerabilidade crítica/alta | Segurança | Alta | Risco no WebView/SDKs | Alta — a crítica tem correção sem quebra | — | Pequeno (Capacitor 8.5, firebase 12.x) / Médio (react-router 7) | `npm update` dentro do semver, rodar testes, gerar APK |
| **P1-03** | App Android não validado em aparelho | Integrações | Alta | Possível falha total no APK | Alta — risco nº 1 de apresentação | Backend publicado | Pequeno (2 h) | Executar e registrar `docs/TESTE_ANDROID.md` |
| **P2-01** | Farm de RunCoins/km de grupo com criar/apagar corrida | Regras de negócio | Média | Loja do pet e ranking de grupos perdem sentido | Média | — | Pequeno | Ao apagar: estornar `calculate_run_coins` (sem ficar negativo) e km do grupo da semana; teste |
| **P2-02** | Comentários de post de outro grupo legíveis | Segurança | Média | Leitura sem aparecer como membro | Média | — | Pequeno | Filtrar `GroupPost.group_id == group_id` (join) + teste |
| **P2-03** | Histórico com rotas baixado em 5 telas | Desempenho | Média | Lentidão e consumo de dados móveis | Média — cresce com o uso | — | Médio | Endpoint `/users/{uid}/stats` agregado no SQL |
| **P2-04** | Fotos base64 em todo item de feed/chat | Desempenho | Média | Feed pesado a cada 15 s | Média | — | Médio | Servir foto por URL própria (`/users/{uid}/photo`) com cache |
| **P2-05** | `async def` + SQLAlchemy síncrono | Arquitetura | Média | Chat trava sob carga | Baixa hoje (pouco uso) | — | Médio | Handlers síncronos + broadcast via thread do loop |
| **P2-06** | Aviso de saúde e limpeza do histórico do treinador | LGPD/UX | Média | Responsabilidade; dado residual após exclusão | Média (pendência antiga, 30 min) | — | Pequeno | Implementar os dois itens |
| **P3-01** | Exposição de UIDs de perfis privados | Privacidade | Baixa | Enumeração de contas | Baixa | — | Pequeno | Filtrar privados em `memberIds` e exigir dono em `/joined` e `/enrolled` |
| **P3-02** | Escritas sociais sem e-mail verificado | Segurança | Baixa | Spam por contas não verificadas | Baixa | — | Pequeno | `require_verified_email` nos routers |
| **P3-03** | Compra concorrente de acessórios | Integridade | Baixa | Raro | Baixa | — | Pequeno | `with_for_update()` |
| **P3-04** | Token do WebSocket na URL | Segurança | Baixa | Token em logs | Baixa | — | Médio | Enviar na 1ª mensagem |
| **P3-05** | Unidade km/mi parcial | UX | Baixa | Expectativa não cumprida | Baixa | — | Médio | Aplicar em todas as telas ou restringir o texto |
| **P3-06** | Eventos sem cancelar inscrição, sem limite, N+1 | Funcionalidade | Baixa | Inscrição irreversível | Baixa | — | Pequeno | Endpoint `leave` + `selectinload` |
| **P3-07** | Tela branca sem configuração do Firebase | Confiabilidade | Baixa | Só afeta ambiente mal configurado | Baixa | — | Pequeno | Tela de erro de configuração |
| **P3-08** | Fontes 8–9 px, modais sem semântica | Acessibilidade | Baixa | Leitura difícil; leitor de tela | Baixa | — | Médio | Mínimo 11 px; componente `Dialog` único |
| **P3-09** | Config Android: `allowBackup`, `versionCode`, minify | Mobile | Baixa | Backup de dados locais | Baixa | — | Pequeno | Ajustar `build.gradle`/Manifest |
| **P3-10** | README com números de testes desatualizados; `storage.rules` morto; `console.log` de coordenadas; ritmo `5'60"` | Manutenção | Baixa | — | Baixa | — | Pequeno | Ajustes pontuais |

**Por que essas prioridades:** P1 = afeta a funcionalidade principal, a segurança com correção trivial disponível, ou o risco de a demonstração falhar. P2 = problema real com alternativa temporária (ex.: entrar no grupo dá acesso aos mesmos comentários; desempenho aceitável com poucos dados). P3 = qualidade e manutenção sem impacto imediato.

---

## 14. Plano de ação para a próxima semana

Capacidade estimada: ~4 pessoas em meio período. Plano dimensionado para ~20–25 h no total.

### 14.1 Correções críticas
| Tarefa | Problema | Prioridade | Benefício | Esforço | Dependências | Critério de conclusão | Teste |
|---|---|---|---|---|---|---|---|
| Unificar e corrigir filtro de GPS | P1-01, C1 | P1 | Distância correta em qualquer cenário | 3–4 h | — | Função pura única usada por web e Android | Vitest: ruído, salto > 500 m, retomada |
| Atualizar dependências dentro do semver | P1-02 | P1 | Fecha a vulnerabilidade crítica | 1–2 h | — | `npm audit --omit=dev` sem críticas; lint/testes/build verdes | CI + APK abre |
| Validar Android em aparelho | P1-03 | P1 | Evidência real | 2 h | Backend no ar, APK novo | Roteiro preenchido e anexado em `docs/` | Roteiro manual |

### 14.2 Melhorias funcionais
| Tarefa | Problema | Prioridade | Esforço | Critério | Teste |
|---|---|---|---|---|---|
| Estorno ao apagar corrida | P2-01 | P2 | 2 h | Moedas e km de grupo voltam ao valor anterior (mínimo 0) | pytest criar → apagar → saldo igual |
| Checar grupo do post nos comentários | P2-02 | P2 | 1 h | 404 para post de outro grupo | pytest com 2 grupos |
| Aviso de saúde + limpar histórico do treinador | P2-06 | P2 | 30 min | Texto visível; chave `veloxy-coach-<uid>` removida na exclusão | Vitest em `deleteCurrentAccount` |

### 14.3 Melhorias técnicas
| Tarefa | Problema | Prioridade | Esforço | Critério | Teste |
|---|---|---|---|---|---|
| Endpoint de estatísticas agregadas | P2-03 | P2 | 4–6 h | Home/Dashboard/Perfil/Conquistas/Pet sem baixar rotas | pytest dos totais + comparar com `getUserStats` atual |
| `with_for_update()` na compra | P3-03 | P3 | 30 min | Compra serializada | pytest com duas sessões |

### 14.4 Melhorias de interface
| Tarefa | Prioridade | Esforço | Critério |
|---|---|---|---|
| Corrigir texto do "Perfil privado" e do seletor de unidade | P3 | 30 min | Textos descrevem o comportamento real |
| Fonte mínima 11 px nos rótulos | P3 | 2 h | Nenhum `text-[8px]`/`text-[9px]` restante |

### 14.5 Testes e validações
- Rodar as três suítes completas localmente (com Postgres e emulador) e anexar a saída.
- Criar os testes 1–4 da seção 9.
- Atualizar contagem de testes no README.

### 14.6 Podem esperar
Fotos por URL (P2-04), `async` correto (P2-05), WebSocket sem token na URL, layout desktop restante, divisão dos arquivos grandes, E2E com Playwright, exportação de dados LGPD, zona de privacidade da rota, marketplace.

**Meta técnica da semana:** fechar todos os P1 e os P2 de esforço pequeno (P2-01, P2-02, P2-06), com teste para cada correção, e registrar o resultado do roteiro Android. Se cumprida, a nota projetada pela mesma metodologia fica em torno de **8,0** (sobe Funcionalidades, Segurança, Testes e Integrações).

---

## 15. Conclusão técnica

- **Qual é a qualidade atual do projeto?** Boa — **7,3/10**. Engenharia de backend e disciplina de testes acima da média para o porte; o frontend é limpo, mas pesado em arquivos grandes e sem testes de tela.
- **O projeto está evoluindo de maneira saudável?** Sim. Os problemas apontados em 30/09 que dependiam de código foram corrigidos em 1–2 dias, com teste e documentação. O ponto de atenção é que o plano de 01/10 (fases M2, P2, P3) praticamente não avançou e as dependências não são atualizadas desde então.
- **Três maiores problemas:** (1) distância da corrida congela após um salto de GPS (P1-01); (2) dependências com vulnerabilidade crítica/alta (P1-02); (3) app Android sem validação em aparelho (P1-03).
- **Três maiores pontos fortes:** (1) regras de negócio e anti-fraude no servidor, com rate limit e validação de imagem; (2) 195 testes com banco real e CI cobrindo front, back e regras; (3) documentação e rastreabilidade das decisões (comentários explicando bugs reais, plano de melhorias, roteiro Android).
- **O que mais impede a nota 10?** Falta de verificação ponta a ponta (sem testes de tela/E2E, sem validação em aparelho, sem medições de desempenho) e alguns furos de integridade nas regras derivadas (economia do pet, comentários entre grupos).
- **O que fazer primeiro?** Corrigir o filtro de GPS com teste e atualizar as dependências — juntos, menos de um dia de trabalho.
- **Pronto para quê?** ✅ Testes internos; ✅ demonstração (com plano B em vídeo para o GPS e backend "acordado" antes); ❌ lançamento público.
- **Meta para a próxima semana:** zero P1 aberto e P2 de esforço pequeno resolvidos, cada um com teste automatizado, e o roteiro Android executado e registrado.

**Nota geral final: 7,3 / 10 (Bom).**

---

## 16. Evidências, arquivos analisados e limitações

### Arquivos lidos integralmente
`backend/app/main.py`, `config.py`, `auth.py`, `rate_limit.py`, `listing.py`, `database.py`, `activity_rules.py`, `gamification.py`, `schemas.py`, `schemas_group.py`, `validators.py`, `ws_manager.py`, `routers/{activities,users,groups,pet,events,products,chatbot}.py`, `services/{activity_effects,account_deletion}.py`, `models/{user,activity}.py`; `backend/requirements*.txt`, `pytest.ini`, `render-start.sh`, `tests/conftest.py` (parcial); `src/App.tsx`, `services/{apiClient,groupSocket,activitiesApi,usersApi,database,petApi,chatbotApi,auth}.ts`, `services/{groupsApi,eventsApi}.ts` (parcial), `components/PrivateRoute.tsx`, `config/firebase.ts`, `lib/settings.ts`, `pages/app/RunTracking.tsx`; `firestore-tests/rules.test.mjs`; `.github/workflows/ci.yml`; `package.json`; `README.md`; `docs/PLANO_MELHORIAS.md`; relatórios anteriores.

### Arquivos analisados por busca dirigida
Demais telas (`Home`, `Dashboard`, `Social`, `Group`, `Profile`, `Events`, `Pet`, `Coach`, `Achievements`, `Login`, `Register`), `firestore.rules`, `storage.rules`, `legalContent.ts`, `AndroidManifest.xml`, `build.gradle`, `capacitor.config.ts`.

### Comandos executados
`npm ci`; `npm run typecheck`; `npx eslint .`; `npx vitest run`; `npx vite build` (saída fora do projeto); `npm audit --omit=dev`; `npm outdated`; `pytest` em venv isolado; servidor de desenvolvimento + navegador embutido.

### Limitações
1. **Sem histórico git** — evolução reconstruída por comparação com relatórios; sem autores, datas de commit nem diffs.
2. **Sem PostgreSQL acessível** (serviço local exige senha, não utilizada) — 62 testes de API não executados.
3. **Sem emulador do Firestore/Java** — 11 testes de regras não executados.
4. **Sem `.env.local`** — app não renderiza no navegador; UX avaliada só pelo código.
5. **Sem aparelho Android** — GPS em segundo plano, login nativo e CORS real não verificados.
6. **Sem acesso ao GitHub, Render e Firebase** — estado do CI, deploy e regras publicadas não verificados.
7. Desempenho sem medição: todos os itens da seção 11.1 são hipóteses fundamentadas no código.

### Efeitos colaterais da auditoria
Nenhum arquivo de código foi alterado. Foram criados: `node_modules/` (via `npm ci`, já ignorado pelo `.gitignore`) e este relatório. Build, venv Python e saídas de teste ficaram em diretório temporário fora do projeto.
