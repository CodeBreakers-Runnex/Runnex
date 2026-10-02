# Relatório Semanal de Desenvolvimento

**Projeto:** Runnex
**Período:** 10/08/2026 → 16/08/2026
**Branch:** beta-1.4
**Commits analisados:** 1

## 1. Resumo Executivo

A semana teve um único commit (`caa8ce7`), mas de escopo grande: 51 arquivos, +1.410/-2.502 linhas. Na prática ele mistura três esforços distintos — reforço de integridade de dados no Firestore (transações atômicas em grupos/eventos, consentimento de Termos de Uso versionado), resiliência do rastreamento de corrida (recuperação de corrida via `localStorage`, limite de pontos de rota) e uma limpeza de código morto (telas Shop/Community, kit de toast/gráfico não usados, ~1.100 linhas removidas). Todas as verificações de qualidade disponíveis passaram (typecheck, lint, 28 testes). O ponto que mais precisa de atenção: a mesma mudança que adicionou o acompanhamento de km semanal por grupo introduziu uma regra do Firestore sem checagem de quem pode escrevê-la — ver seção 8.

## 2. Principais Entregas

### Integridade de dados em grupos e eventos (transações atômicas)

**O que foi feito:** `createGroup`, `joinGroup`, `leaveGroup` e `joinEvent` passaram a usar `runTransaction`, gravando o documento do grupo/evento e o perfil do usuário na mesma transação, em vez de duas chamadas `updateDoc`/`setDoc` separadas.

**Por que foi feito:** Confirmado pelo próprio comentário adicionado no código — evitar que `memberIds`/`joinedGroupIds` (ou `participantsIds`/`enrolledEvents`) fiquem dessincronizados se a segunda chamada falhar por queda de rede entre as duas escritas.

**Impacto:** Reduz um cenário real de inconsistência (usuário aparece como membro do grupo mas o grupo não lista ele, ou vice-versa) que antes dependia de sorte de rede.

**Arquivos principais:** `src/services/database.ts` (funções `createGroup`, `joinGroup`, `leaveGroup`, `joinEvent`)

**Status:** Concluído

### Consentimento de Termos de Uso no cadastro

**O que foi feito:** `Register.tsx` ganhou um checkbox obrigatório de aceite dos Termos de Uso; ao criar a conta, `createUserProfile` grava `termsVersion` e `termsAcceptedAt` no perfil do usuário. As regras do Firestore foram atualizadas para aceitar esses dois campos na criação do documento.

**Por que foi feito:** Inferência — o padrão (versão + timestamp gravados no momento da criação) é o desenho típico para manter um registro auditável de qual versão dos termos cada usuário aceitou, útil para conformidade legal.

**Impacto:** Antes, o cadastro só linkava para a tela de termos sem registrar o aceite; agora existe um registro por usuário.

**Arquivos principais:** `src/pages/auth/Register.tsx`, `src/services/database.ts` (`createUserProfile`), `src/content/legalContent.ts` (`LEGAL_VERSION`), `firestore.rules`

**Status:** Concluído — falta apenas um caminho para re-consentimento se `LEGAL_VERSION` mudar no futuro (as regras atuais só permitem gravar esses campos na criação do documento, não em atualização).

### Acompanhamento de quilometragem semanal por grupo

**O que foi feito:** Nova função `addDistanceToUserGroups` soma a distância de cada corrida salva ao campo `weeklyKm` dos grupos reais (não demo) dos quais o usuário participa, resetando automaticamente quando a semana ISO muda (`isoWeekKey`). Nova regra `validGroupWeeklyKmUpdate` no Firestore valida essa escrita.

**Por que foi feito:** Inferência — dá suporte a um ranking/indicador semanal por grupo, que antes só existia como campo estático (`weeklyKm: 0`).

**Impacto:** Funcionalidade nova e usada pela primeira vez nesta semana. Ver seção 8 — a regra que a protege tem uma lacuna de autorização real.

**Arquivos principais:** `src/services/database.ts`, `firestore.rules`

**Status:** Necessita revisão (funcionalidade funciona, mas a regra de segurança associada precisa de correção antes de ser considerada pronta)

### Resiliência do rastreamento de corrida

**O que foi feito:** `RunTracking.tsx` ganhou um mecanismo de snapshot em `localStorage` (`veloxy_active_run_v1`) que salva o progresso da corrida ativa e oferece recuperação via modal se o app for encerrado no meio de um treino; e uma função `decimateRoute` que reduz a rota para no máximo 4.500 pontos antes de salvar, com margem de segurança sob o limite de 5.000 pontos que as regras do Firestore aceitam.

**Por que foi feito:** Confirmado pelos comentários no próprio diff — processo do Android morto mata o serviço de GPS em segundo plano sem chance de recuperação normal, e corridas longas sem esse corte de pontos falhariam ao salvar por violar a regra do Firestore.

**Impacto:** Duas classes de perda de dados evitadas: corrida perdida por fechamento abrupto do app, e corrida longa que falharia ao salvar.

**Arquivos principais:** `src/pages/app/RunTracking.tsx`

**Status:** Concluído

### Limpeza de código morto e ajuste de infraestrutura de deploy

**O que foi feito:** Remoção das telas `Shop.tsx` e `Community.tsx` (e suas rotas), do kit de toast do Radix (`toast.tsx`, `toaster.tsx`, `use-toast.ts`, `use-toast.ts` hook) e do componente de gráfico `chart.tsx` (Recharts) — nenhum estava mais em uso. `package.json` perdeu as dependências `recharts` e `@radix-ui/react-toast`. `firebase.json`/`.firebaserc` ganharam um segundo alvo de hosting (`veloxyMain`, projeto `veloxy-20b42`).

**Por que foi feito:** Motivo não identificado diretamente no histórico para a remoção especificamente; inferência baseada nas alterações encontradas — parece uma limpeza de UI kit e telas não finalizadas/abandonadas (Shop tinha produtos de afiliados hardcoded, Community nunca chegou a ter rota funcional completa).

**Impacto:** ~1.100 linhas a menos para manter; bundle de produção não carrega mais Recharts nem o kit de toast duplicado (o projeto já usa `sonner` como sistema de toast).

**Arquivos principais:** `src/pages/app/Shop.tsx`, `src/pages/app/Community.tsx`, `src/components/ui/{chart,toast,toaster}.tsx`, `src/hooks/use-toast.ts`, `package.json`, `firebase.json`, `.firebaserc`

**Status:** Concluído

## 3. Bugs Corrigidos

### Atualização de XP podia ser rejeitada pela regra do Firestore

- **Problema:** `updateUserXP` enviava `displayName`/`photoURL` na mesma escrita que os campos de estatística (`totalXP`, `monthlyKm`).
- **Causa provável:** A regra `validStatsProgressUpdate` restringe o `diff` da escrita a um conjunto fixo de campos que não inclui `displayName`/`photoURL` — se esses campos divergissem do que já estava salvo, a regra rejeitaria a escrita inteira.
- **Solução aplicada:** A escrita de estatísticas foi isolada, sem mais incluir `displayName`/`photoURL`.
- **Arquivos envolvidos:** `src/services/database.ts`
- **Impacto da correção:** Reduz o risco de uma corrida ser salva mas a atualização de XP falhar silenciosamente por causa de um `displayName` desatualizado.
- **Possíveis riscos de regressão:** Baixo — a mudança restringe o payload da escrita, não deveria quebrar nenhum fluxo existente.

### Primeira corrida de um usuário podia falhar por falta do documento de perfil

- **Problema:** `updateUserXP` assumia que o documento em `/users/{uid}` já existia.
- **Causa provável:** Se o fluxo de criação de perfil no cadastro não tiver rodado (ou o usuário for anterior a essa etapa), a primeira chamada de `updateUserXP` encontraria um documento inexistente.
- **Solução aplicada:** `updateUserXP` agora chama `createUserProfile` sob demanda quando o documento não existe.
- **Arquivos envolvidos:** `src/services/database.ts`
- **Impacto da correção:** Evita falha ao registrar a primeira corrida de contas nessa situação.
- **Possíveis riscos de regressão:** Baixo.

### `CompleteProfile` acessível sem sessão ativa

- **Problema:** A tela de completar perfil não verificava se havia um usuário logado antes de permitir preencher e "salvar" o formulário.
- **Causa provável:** A tela é pública (fora do `PrivateRoute`) para funcionar logo após o cadastro, mas não tinha guarda própria.
- **Solução aplicada:** Adicionado redirecionamento para `/login` quando `!authLoading && !user`, e uma checagem equivalente no `handleSkip`.
- **Arquivos envolvidos:** `src/pages/auth/CompleteProfile.tsx`
- **Impacto da correção:** Evita que o usuário preencha um formulário que não teria efeito nenhum.
- **Possíveis riscos de regressão:** Baixo.

## 4. Novas Funcionalidades

### Consentimento de Termos de Uso versionado

- **Objetivo:** Registrar que versão dos Termos de Uso cada usuário aceitou, e quando.
- **Funcionamento:** Checkbox obrigatório no cadastro; ao criar a conta, grava `termsVersion` (constante `LEGAL_VERSION`) e `termsAcceptedAt` no perfil.
- **Principais componentes envolvidos:** `Register.tsx`, `createUserProfile` (`database.ts`), `legalContent.ts`.
- **Integração com backend:** Sim — campos validados em `firestore.rules` na criação do documento de usuário.
- **Estado atual:** Funcional para contas novas.
- **O que ainda falta:** Não há caminho para capturar reaceite se `LEGAL_VERSION` mudar — hoje as regras só permitem gravar esses campos uma vez, na criação.

### Quilometragem semanal por grupo

- **Objetivo:** Somar automaticamente a distância percorrida por membros de um grupo, por semana.
- **Funcionamento:** A cada corrida salva, `addDistanceToUserGroups` soma a distância ao `weeklyKm` de cada grupo real do usuário, via transação, resetando quando a semana ISO (`isoWeekKey`) muda.
- **Principais componentes envolvidos:** `database.ts` (`addDistanceToUserGroups`, `isoWeekKey`), `firestore.rules` (`validGroupWeeklyKmUpdate`).
- **Integração com backend:** Sim, Firestore.
- **Estado atual:** Funcional na escrita; ver seção 8 para a lacuna na regra de segurança.
- **O que ainda falta:** Não foi identificado nenhum lugar da UI que exiba esse `weeklyKm` nesta semana — a funcionalidade grava o dado, mas não foi confirmado onde ele é mostrado ao usuário.

### Recuperação de corrida interrompida

- **Objetivo:** Não perder uma corrida em andamento se o app for encerrado pelo sistema.
- **Funcionamento:** Snapshot local (`localStorage`) salvo a cada mudança relevante durante a corrida; ao reabrir a tela, um modal oferece continuar ou descartar.
- **Principais componentes envolvidos:** `RunTracking.tsx`.
- **Estado atual:** Funcional.
- **O que ainda falta:** O snapshot não expira nem é limpo automaticamente se o usuário simplesmente abandonar a tela sem decidir.

## 5. Refatorações e Melhorias Técnicas

- **Reorganização do `firestore.rules`** — comentários de seção (`// ==== ACTIVITIES ====`, etc.) e reformatação de indentação em praticamente todas as funções de validação. Melhora a legibilidade de um arquivo de ~580 linhas, mas mistura mudança de estilo com mudança de lógica no mesmo commit, o que torna mais difícil revisar o que de fato mudou de comportamento (ver seção 12).
- **`RecenterMap` movido para escopo de módulo** em `RunTracking.tsx` — antes era recriado a cada render do componente principal, que re-renderiza a cada segundo/ponto de GPS durante uma corrida. Componente definido uma vez fora do componente principal evita esse recriar constante.
- **Remoção de ~1.100 linhas de código não utilizado** (seção 2) — reduz a superfície de manutenção e o que precisa ser lido para entender o projeto.
- **Testes substituídos por versões mais específicas**: `example.test.ts` e o `useAuth.test.ts` antigo foram trocados por `createUserProfile.test.ts`, `feed-utils.test.ts`, `gamification.test.ts` e um `useAuth.test.tsx` novo — cobertura direcionada a lógica de negócio real em vez de testes de exemplo genéricos.

## 6. Banco de Dados e Backend

**Firestore — `firestore.rules`:**
- Novos campos aceitos em `/users`: `termsVersion` (string), `termsAcceptedAt` (timestamp) — graváveis apenas na criação do documento.
- Novos campos aceitos em `/groups`: `weeklyKmWeek` (string) — usado junto com `weeklyKm` existente.
- Nova função `validGroupWeeklyKmUpdate()`, usada em `allow update` de `/groups/{groupId}` (OR com `validGroupMembershipUpdate()`).
- Reformatação (sem mudança de comportamento identificada) na maior parte das demais funções de validação.

**Firebase Hosting:** `firebase.json` passou de um único alvo de hosting para uma lista com dois (`veloxyMain` → projeto `veloxy-20b42`, `veloxyRun` → `veloxy-run`), ambos publicando o mesmo `dist/`. `.firebaserc` atualizado com o mapeamento correspondente. Não foi encontrado nenhum script de deploy que direcione explicitamente a um alvo específico — ver seção 13.

**Sem alterações identificadas em:** migrações de banco relacional, endpoints de API própria (o projeto não tem backend próprio além do Firebase) — não aplicável a este projeto.

## 7. Frontend e UI/UX

- **Checkbox de aceite de termos** adicionado à tela de cadastro (`Register.tsx`), substituindo o texto corrido anterior que só linkava para os termos sem exigir confirmação ativa.
- **Adoção parcial de tokens de tema**: `Login.tsx` e `ForgotPasswordModal.tsx` trocaram classes fixas (`bg-zinc-800`, `bg-zinc-900`, `border-zinc-700`) por tokens do design system (`bg-secondary`, `bg-card`, `border-input`). Essa troca não foi aplicada em todas as telas nesta semana — outras telas do app ainda usam as classes fixas antigas, então o app fica num estado misto (não é uma regressão, mas a migração está incompleta).
- **Contador de caracteres** adicionado ao campo de nome de usuário no cadastro (`username.length}/30`).

## 8. Segurança

🔴 **Crítico** — A nova função `validGroupWeeklyKmUpdate()` (introduzida nesta semana, `firestore.rules`) exige apenas que o usuário esteja autenticado — nunca verifica se `request.auth.uid` está em `memberIds` do grupo. Confirmado lendo a regra: qualquer usuário autenticado pode chamar `updateDoc` diretamente em `weeklyKm`/`weeklyKmWeek` de **qualquer** grupo, mesmo sem ser membro, em incrementos de até 200km por chamada. Recomendação: adicionar `&& request.auth.uid in resource.data.memberIds` à função antes de considerar essa funcionalidade pronta para uso real.

🟡 **Médio** — A reformatação do `firestore.rules` (seção 5) mistura mudança de estilo com mudança de lógica no mesmo commit. Não é uma vulnerabilidade em si, mas é uma prática de risco: dificulta a revisão humana de segurança em regras do Firestore, exatamente o tipo de arquivo onde um erro sutil de lógica escondido no meio de uma reformatação grande é fácil de passar despercebido (como aconteceu com o achado acima).

⚪ Nenhum outro problema de segurança foi identificado nas mudanças desta semana especificamente. *Este projeto já tem uma auditoria de segurança completa mais abrangente, feita separadamente, cobrindo áreas não tocadas nesta semana — este relatório cobre apenas o que mudou no período analisado.*

## 9. Dependências e Configurações

- **Removidas:** `recharts` (^2.15.4), `@radix-ui/react-toast` (^1.2.14) — consistente com a remoção do componente de gráfico e do kit de toast não usados (seção 2). `vite.config.ts` também removeu o chunk manual `charts: ["recharts"]`.
- **Scripts de build:** `typecheck` (novo script, `tsc --noEmit` nos dois `tsconfig`) agora roda antes de `build`, `build:dev` e como parte de `lint` — builds e lint agora falham cedo em erro de tipo, em vez de só na hora do `vite build`.
- **Firebase:** ver seção 6 (segundo alvo de hosting).

## 10. Testes e Qualidade

Verificações executadas nesta análise, no estado atual do código (`HEAD`):

| Verificação | Comando | Resultado |
|---|---|---|
| Checagem de tipos | `npm run typecheck` | ✅ Passou, sem erros |
| Lint | `npx eslint .` | ✅ Passou, sem erros |
| Testes | `npx vitest run` | ✅ 28/28 testes passaram (4 arquivos) |

**Testes desta semana:** `createUserProfile.test.ts` (3 testes — valida que a criação de perfil não inclui campos que a regra `validUserCreate` rejeitaria), `feed-utils.test.ts` (11 testes), `gamification.test.ts` (10 testes — cálculo de XP e nível), `useAuth.test.tsx` (4 testes). Removidos: `example.test.ts`, `useAuth.test.ts` (versão antiga).

**Sem cobertura de teste identificada** para as funções mais centrais desta semana: `saveActivity`, `updateUserXP`, e as transações de grupo (`joinGroup`/`leaveGroup`/`addDistanceToUserGroups`) — justamente as que mudaram de comportamento nesta semana (seção 2 e 3).

## 11. Git e Histórico

- **1 commit** no período (`caa8ce7`, "chore: limpeza de componentes nao usados e ajustes de infraestrutura"), analisado e decomposto nas 5 entregas lógicas da seção 2 — tratá-lo como uma entrega única esconderia que ele mistura hardening de segurança, uma funcionalidade nova, um sistema de recuperação de dados e uma limpeza de código sem relação entre si.
- **Arquivo com maior volume de mudança:** `src/pages/app/Shop.tsx` (479 linhas, removido por completo), seguido de `src/services/database.ts` (470 linhas) e `firestore.rules` (347 linhas).
- **Áreas mais afetadas:** camada de serviço (`database.ts`), regras do Firestore, e a tela de rastreamento de corrida.
- **Commit único e grande** (51 arquivos) é, em si, um ponto de atenção de processo — ver seção 13.

## 12. Problemas Encontrados

🔴 **Crítico** — `validGroupWeeklyKmUpdate` sem checagem de membership (detalhado na seção 8). Evidência: `firestore.rules`, função introduzida nesta semana. Impacto: qualquer usuário autenticado pode manipular o `weeklyKm` de grupos que não são seus. Recomendação: corrigir antes de expor a funcionalidade de km semanal ao usuário final.

🟠 **Importante** — Consentimento de termos sem caminho de reaceite (seção 4). Evidência: regras só aceitam `termsVersion`/`termsAcceptedAt` na criação do documento. Impacto: se os Termos de Uso mudarem, não há como registrar o reaceite de usuários existentes. Recomendação: planejar uma regra de atualização dedicada antes da próxima revisão dos termos.

🟡 **Moderado** — Migração de tokens de tema incompleta (seção 7). Evidência: `Login.tsx`/`ForgotPasswordModal.tsx` usam tokens, o restante do app (fora do escopo desta semana) ainda usa cores fixas. Impacto: inconsistência visual entre telas, mais visível em tema claro. Recomendação: continuar a migração de forma incremental.

🟢 **Baixa prioridade** — `firestore.rules` ficou sem quebra de linha no final do arquivo após a reformatação. Sem impacto funcional.

## 13. Pontos de Atenção

- Funcionalidades introduzidas nesta semana sem teste automatizado: km semanal de grupo, recuperação de corrida, transações de entrar/sair de grupo.
- Commit único cobrindo 51 arquivos e três esforços sem relação (segurança, funcionalidade nova, limpeza) — dificulta revisão e reversão seletiva caso algo precise ser desfeito.
- Segundo alvo de hosting do Firebase adicionado sem nenhum script de deploy dedicado — risco de publicar nos dois sites (`veloxyMain`/`veloxyRun`) sem intenção ao rodar `firebase deploy` sem `--only`.
- Nenhum uso da funcionalidade de `weeklyKm` foi encontrado na UI nesta análise — vale confirmar se ela já está sendo exibida em algum lugar ou se é uma peça isolada aguardando a tela que vai consumi-la.

## 14. Recomendações

🔴 **Prioridade alta**
- Corrigir `validGroupWeeklyKmUpdate` para exigir que o autor da escrita seja membro do grupo.

🟡 **Prioridade média**
- Adicionar testes para `saveActivity`, `updateUserXP` e as transações de grupo — são o núcleo de negócio e mudaram nesta semana sem cobertura.
- Planejar o caminho de reaceite de termos para a próxima atualização de `LEGAL_VERSION`.
- Continuar a migração de classes de cor fixas para tokens do design system nas telas restantes.

🟢 **Prioridade baixa**
- Confirmar a intenção do segundo alvo de hosting e, se necessário, documentar/scriptar o deploy por alvo.
- Restaurar a quebra de linha final em `firestore.rules`.

## 15. Próximos Passos

1. **Corrigir a regra de segurança do km semanal de grupo**
   - Motivo: é a única forma segura de expor essa funcionalidade a usuários reais.
   - Impacto esperado: desbloqueia lançar o acompanhamento de km semanal sem risco de manipulação por terceiros.
2. **Adicionar testes para as funções de gamificação e grupos que mudaram esta semana**
   - Motivo: são o núcleo de negócio do app e hoje têm zero cobertura automatizada.
   - Impacto esperado: reduz o risco de regressão silenciosa nas próximas mudanças nessa área.
3. **Continuar a padronização de tokens de tema**
   - Motivo: a migração começou esta semana em duas telas; terminar evita o app ficar num estado visual misto por mais tempo.
   - Impacto esperado: consistência visual, especialmente perceptível no tema claro.

## 16. Evolução do Projeto

*Avaliação técnica aproximada, não uma métrica objetiva — compara o estado imediatamente antes do commit da semana (`972ff8c`) com o estado atual (`HEAD`).*

| Dimensão | Início da semana | Final da semana | Observação |
|---|---|---|---|
| Funcionalidades | 3 | 4 | Consentimento de termos e km semanal por grupo são novos |
| Estabilidade | 3 | 4 | Transações atômicas em grupos/eventos reduzem risco de dessincronia |
| Arquitetura | 3 | 3 | Sem mudança estrutural — a semana foi de hardening e limpeza, não de redesenho |
| Segurança | 3 | 3 | Ganhos reais (auditoria de consentimento, correção de bug de escrita de XP) compensados por uma nova lacuna crítica introduzida na mesma semana (seção 8) |
| Qualidade do código | 3 | 4 | ~1.100 linhas de código morto removidas, 4 arquivos de teste novos e mais direcionados |
| UX/UI | 3 | 3 | Mudança pontual (checkbox de termos, início de migração de tema), não abrangente o suficiente para mudar a nota |
| Testes | 2 | 3 | Testes mais direcionados, mas ainda sem cobrir as funções centrais que mudaram |
| Performance | 3 | 3 | Uma melhoria pontual (RecenterMap) não é abrangente o suficiente para mudar a nota geral |

## 17. Resumo para Apresentação

**Esta semana**
- ✅ Transações atômicas em grupos e eventos, e consentimento de Termos de Uso versionado no cadastro
- ✅ Corrigido bug que podia rejeitar a atualização de XP de uma corrida já salva
- 🔧 ~1.100 linhas de código morto removidas (telas e componentes não usados)
- 🎨 Início da migração para tokens de tema em Login e recuperação de senha
- 🛡️ Sem ganho líquido de segurança — uma nova lacuna crítica foi introduzida na mesma mudança que corrigiu outros pontos (ver relatório completo, seção 8)

**Próxima semana**
- 🎯 Corrigir a regra de segurança do km semanal de grupo (prioridade alta)
- 🎯 Cobrir com testes as funções de gamificação e grupos
- 🎯 Terminar a padronização de tokens de tema
