# Relatório Semanal de Desenvolvimento

**Projeto:** Runnex (Veloxy)
**Período:** 18/08/2026 → 28/08/2026
**Branch:** claude/implementacao-funcionalidades-9po4th
**Commits analisados:** 4 (um deles, "67", é um checkpoint intermediário sem mensagem descritiva — ver seção 11)

## 1. Resumo Executivo

Semana de três entregas grandes: validação de senha/nome de usuário no cadastro, uma tela de grupo nova com feed e chat em tempo real, um toggle de unidade km/mi na Home, e um sistema completo de "pet" (mascote gamificado com moeda própria, conquistas novas e acessórios). É a semana de maior volume de código do projeto até agora: +2.468/-90 linhas em 15 arquivos, incluindo dois arquivos novos de mais de 800 e 450 linhas (`Group.tsx`, `Pet.tsx`). Todas as verificações automatizadas passam (typecheck, lint com 1 aviso não bloqueante, build, 28/28 testes). O ponto crítico da semana: a funcionalidade de adotar pet está com um bug de permissão do Firestore ("Missing or insufficient permissions") ainda **não resolvido** ao fim do período — ver seção 12. Também houve um incidente de processo (arquivo `Dashboard.tsx` apagado por engano e depois restaurado) que não deixou marca no código final, mas indica que o fluxo de aplicar mudanças manualmente (sem acesso de push direto ao repositório) é frágil — ver seção 13.

## 2. Principais Entregas

### Validação de senha e nome de usuário no cadastro

**O que foi feito:** `Register.tsx` passou a exigir que a senha tenha ao menos uma letra e um número (`PASSWORD_REGEX`), com texto de ajuda sugerindo símbolos; o campo de nome de usuário filtra em tempo real qualquer caractere que não seja letra ou número (`USERNAME_REGEX`), além de validar no submit.

**Por que foi feito:** Confirmado pela conversa que originou a mudança — requisito explícito de segurança de senha e de restringir símbolos no identificador de usuário.

**Impacto:** Reduz senhas fracas (apenas números ou apenas letras) e nomes de usuário com caracteres que poderiam causar problemas de exibição/URL.

**Arquivos principais:** `src/pages/auth/Register.tsx` (+22/-2)

**Status:** Concluído

### Tela de Grupo com feed e chat em tempo real

**O que foi feito:** Nova rota `/grupo/:groupId` (`src/pages/app/Group.tsx`, 829 linhas) com header (nome, avatar, descrição, contagem de membros, voltar, opções), estados de carregamento/erro/"grupo não encontrado"/"ainda não é membro", e duas áreas: um feed de publicações (texto + imagem opcional, curtir, comentar) e um chat (mensagens em tempo real, bolhas diferenciando o autor). No celular as duas áreas ficam em abas; no desktop lado a lado. O botão "Entrar no grupo" em `Social.tsx` agora navega automaticamente para essa tela após confirmar a entrada, e o formulário de criar grupo passou a exigir todos os campos e ganhou upload de foto.

**Por que foi feito:** Confirmado — requisito explícito de dar aos grupos existentes um espaço de comunidade próprio (feed + chat), em vez de só ranking/estatística.

**Impacto:** Funcionalidade social nova mais substancial do projeto até agora; grupos deixam de ser só um contador de km semanal e passam a ter interação direta entre membros.

**Arquivos principais:** `src/pages/app/Group.tsx` (novo, 829 linhas), `src/pages/app/Social.tsx` (+131/-26), `src/services/database.ts` (funções de posts/comentários/mensagens), `firestore.rules`, `storage.rules`

**Status:** Concluído — sem cobertura de teste (ver seção 10).

### Alternância de unidade de distância (km/mi) na Home

**O que foi feito:** O botão ao lado de "Distância total" na Home abre um modal de confirmação antes de trocar a unidade de exibição entre quilômetros e milhas. A preferência é salva na mesma chave de `localStorage` (`veloxy-settings`) já usada pelo seletor de unidade em `Profile.tsx`, mantendo as duas telas em sincronia — embora o seletor em `Profile.tsx` continue sendo apenas visual (não converte nenhum valor exibido).

**Por que foi feito:** Confirmado — requisito explícito do usuário, incluindo o pedido específico de modal de confirmação.

**Impacto:** Primeira conversão de unidade real do app (o seletor de `Profile.tsx` existia desde antes mas nunca convertia nada).

**Arquivos principais:** `src/pages/app/Home.tsx` (+126/-13, parte desse total já é do sistema de pet abaixo)

**Status:** Concluído

### Sistema de Pet (RunCoin, acessórios, conquistas novas)

**O que foi feito:** Novo mascote virtual escolhido uma única vez entre 5 espécies (guepardo, lebre, cavalo, falcão, galgo), com nome definido pelo usuário. Moeda própria ("RunCoin", 1 por km corrido) creditada em `saveActivity`. Tela `/pet` com onboarding de adoção, exibição do pet (estágio visual ligado ao nível de XP existente, humor ligado à streak), e abas de Acessórios/Loja. Acessórios em 3 slots (cabeça, pescoço, fundo) desbloqueados por conquista ou comprados com RunCoin. 8 conquistas novas (250km, 1h de corrida, Sub 10K, 100 treinos, meta semanal batida, 10 amanheceres, 10 noites, 1 ano ativo) foram adicionadas a uma lib compartilhada (`src/lib/achievements.ts`) que também substituiu a lista fixa de 4 conquistas que antes vivia só dentro de `Profile.tsx`. `getUserStats` (`database.ts`) passou a calcular, no mesmo laço que já existia sobre as atividades do usuário, os dados que essas conquistas novas precisam (corrida de 1h+, corrida sub-10K, contagem de corridas ao amanhecer/à noite).

**Por que foi feito:** Confirmado — funcionalidade pedida explicitamente pelo grupo, com escopo detalhado em conversa antes da implementação (moeda, espécies, mecânica de humor, fonte dos acessórios).

**Impacto:** Camada de gamificação nova e a maior mudança de escopo de produto da semana. Ainda não está utilizável de ponta a ponta — ver bug crítico na seção 12.

**Arquivos principais:** `src/pages/app/Pet.tsx` (novo, 450 linhas), `src/lib/pet.ts` (novo, 91 linhas), `src/lib/achievements.ts` (novo, 147 linhas), `src/services/database.ts` (+287/-2 no total do período, boa parte é pet), `src/types/index.ts`, `firestore.rules`

**Status:** Necessita revisão — a adoção do pet (primeiro passo obrigatório de todo o fluxo) está falhando em produção com erro de permissão do Firestore, não confirmado como resolvido até o fim do período analisado.

## 3. Bugs Corrigidos

Nenhum bug pré-existente foi corrigido nesta semana — todas as mudanças foram de funcionalidade nova. (Um bug foi *introduzido* e ainda está aberto — ver seção 12, já que não foi corrigido dentro do período.)

## 4. Novas Funcionalidades

Ver seção 2 — todas as quatro entregas da semana são funcionalidades novas (validação de cadastro, grupo com feed/chat, toggle de unidade, sistema de pet).

## 5. Refatorações e Melhorias Técnicas

- **Centralização das conquistas em `src/lib/achievements.ts`** — antes, a lista de 4 conquistas vivia como uma função privada dentro de `Profile.tsx` (`getRealAchievements`), com ícone/condição/texto de progresso hardcoded inline. Agora é uma lista de dados (`AchievementDef[]`) com função de desbloqueio e de texto de progresso por item, reaproveitada tanto pela tela de Perfil quanto pela lógica de desbloqueio de acessório do pet. Isso evita que as duas telas divirjam sobre o que conta como "conquistado" no futuro.
- **`getUserStats` ganhou 4 campos novos calculados no mesmo laço já existente** (`hasHourLongRun`, `hasSub10kRun`, `dawnRunsCount`, `nightRunsCount`) em vez de criar uma segunda consulta/laço separado só para as conquistas novas — evita duplicar a leitura de todas as atividades do usuário.
- **`RunningGroup` ganhou campo opcional `photoURL`** e todo o fluxo de upload de avatar de grupo/imagem de post foi encaixado no `storage.ts` existente, seguindo o mesmo padrão já usado por `uploadAvatar` (nome de arquivo com timestamp, escrita em Storage seguida de gravação da URL no Firestore).

## 6. Banco de Dados e Backend

**Firestore — `firestore.rules`:**
- Novo campo `photoURL` aceito em `/groups/{groupId}`, com uma função dedicada (`validGroupPhotoUpdate`) que só permite a troca por quem criou o grupo (`createdBy`).
- Três subcoleções novas sob `/groups/{groupId}`: `posts` (feed), `posts/{postId}/comments` e `messages` (chat) — todas restritas por uma função `isGroupMember(groupId)` que confere, via `get()`, se o autor da requisição está em `memberIds` do grupo.
- Curtir uma publicação do grupo reaproveita a mesma função `validLikeUpdate()` já usada pelas atividades (nenhuma duplicação de lógica de toggle de array).
- 7 campos novos aceitos em `/users/{userId}` para o sistema de pet (`petSpecies`, `petName`, `petCoins`, `petUnlockedAccessoryIds`, `petEquippedCabeca`, `petEquippedPescoco`, `petEquippedFundo`), cada operação (escolher pet, ganhar moeda, comprar acessório, equipar) com sua própria função de validação (`validPetChoice`, `validPetCoinsEarn`, `validPetPurchase`, `validPetEquip`), seguindo o padrão já estabelecido no arquivo (uma função por tipo de escrita, `affectedKeys().hasOnly([...])` restringindo o que pode mudar em cada uma).
- **`storage.rules`**: dois caminhos novos, `groups/{groupId}/avatar/{creatorUid}/{fileName}` e `groups/{groupId}/posts/{userId}/{fileName}`, replicando exatamente o padrão já usado por `avatars/{userId}/{fileName}` (dono do caminho = dono do uid, tipo imagem, até 5MB).
- **Confirmado nesta análise:** a falha crítica do relatório anterior (`validGroupWeeklyKmUpdate` sem checagem de `memberIds`) já estava corrigida antes do início deste período — não é mais um problema.

## 7. Frontend e UI/UX

- **Tela de Grupo** (seção 2) — abas Feed/Chat no celular, layout lado a lado (`lg:grid-cols-2`) no desktop. É a primeira tela do projeto com um breakpoint `lg:` dedicado — o resto do app não tem layout específico de desktop.
- **Modal de confirmação de unidade** na Home, com texto explicando o que vai mudar antes de confirmar.
- **Onboarding de adoção do pet** — grid de 5 espécies + campo de nome, no mesmo padrão visual (cards, bordas, cores) do resto do app.
- **Ícone do pet** adicionado ao canto superior direito da Home (substituindo um `div` vazio reservado que já existia ali) e um card de pet abaixo da bio em `Profile.tsx`.

## 8. Segurança

⚪ Nenhum problema novo de segurança foi identificado nas regras adicionadas nesta semana — a lógica de `isGroupMember`, `validPetChoice`/`validPetCoinsEarn`/`validPetPurchase`/`validPetEquip` segue o mesmo padrão defensivo (campos explícitos, deltas restritos, checagem de dono) do restante do arquivo, e a falha crítica do relatório anterior já não existe mais.

🟡 **Médio (recomendação de revisão, achado não confirmado)** — o erro "Missing or insufficient permissions" ao adotar o pet (seção 12) pode ter causa em uma condição real nas regras que não foi possível reproduzir sem acesso ao projeto Firebase de produção. Enquanto não for confirmado, tratar como possível lacuna de regra, não como vulnerabilidade.

## 9. Dependências e Configurações

- `package-lock.json` teve apenas bumps de patch em dependências transitivas de build (`baseline-browser-mapping`, `caniuse-lite`), consistentes com um `npm install`/`npm ci` rodado localmente — não é uma mudança de dependência intencional do projeto.
- Nenhuma dependência nova foi adicionada apesar do volume grande de código novo — o sistema de pet usa emoji + CSS em vez de uma lib de ilustração/ícone adicional, e o chat/feed do grupo reaproveitam Firebase (`onSnapshot`) já presente no projeto.

## 10. Testes e Qualidade

Verificações executadas nesta análise, no estado atual do código (`HEAD` = `9eb8754`):

| Verificação | Comando | Resultado |
|---|---|---|
| Checagem de tipos | `npm run typecheck` | ✅ Passou, sem erros |
| Lint | `npx eslint .` | ⚠️ 1 aviso (não bloqueante) |
| Build de produção | `npx vite build` | ✅ Passou |
| Testes | `npx vitest run` | ✅ 28/28 testes passaram (4 arquivos) |

O aviso de lint é em `src/pages/app/Pet.tsx:161` (`react-hooks/exhaustive-deps`): `purchasedAccessoryIds` é recalculado a cada render (`profile?.petUnlockedAccessoryIds || []` cria um array novo sempre que o campo é `undefined`), então o `useCallback` que depende dele nunca se beneficia da memoização de fato. Sem impacto funcional, só de performance marginal.

**Nenhum teste novo foi adicionado nesta semana.** As três funcionalidades novas (grupo/feed/chat, toggle de unidade, sistema de pet) ficaram sem cobertura automatizada — mesmo padrão apontado no relatório anterior para `saveActivity`/`updateUserXP`/transações de grupo, que continuam sem teste também.

## 11. Git e Histórico

- **4 commits "de conteúdo"** no período, mas o histórico real é mais confuso do que isso sugere: um commit chamado literalmente **"67"** (`659143f`) aparece entre a validação de cadastro e a entrega grande de grupo/pet — pelo conteúdo, é um checkpoint intermediário feito ao criar uma branch de mesmo nome para evitar mexer na branch principal enquanto arquivos eram colados manualmente, e não uma entrega com identidade própria. Ele já inclui, junto com progresso parcial de várias entregas, a exclusão acidental de `Dashboard.tsx` (129 linhas removidas sem substituição) — revertida no commit seguinte.
- **Arquivo com maior volume de mudança:** `src/pages/app/Group.tsx` (829 linhas, novo), seguido de `src/pages/app/Pet.tsx` (450, novo) e `src/services/database.ts` (289).
- **Áreas mais afetadas:** telas novas em `src/pages/app/`, camada de serviço (`database.ts`), e `firestore.rules`.
- **Processo de entrega atípico:** as mudanças foram desenvolvidas nesta sessão (sandbox sem acesso de push ao GitHub) e aplicadas manualmente pelo usuário via cópia de arquivo completo — o commit "67" e o incidente do `Dashboard.tsx` (seção 13) são consequência direta desse fluxo, não de um problema no código em si.

## 12. Problemas Encontrados

🔴 **Crítico** — Adotar um pet falha com `FirebaseError: Missing or insufficient permissions` (capturado em `Pet.tsx:153`, dentro de `choosePet`). Evidência: a regra `validPetChoice` em `firestore.rules` foi revisada linha a linha nesta análise e está logicamente correta para o payload que `choosePet` envia (`{petSpecies, petName, petCoins: 0}` via `setDoc` com `merge: true`); o usuário confirmou que publicou as regras atualizadas e que o texto `petSpecies` aparece nelas. A causa raiz **não foi confirmada** até o fim da sessão. Hipóteses ainda não descartadas, em ordem de probabilidade: (1) o documento `users/{uid}` dessa conta específica já tem algum campo pré-existente fora dos limites que `validUserBase` exige em *toda* escrita (ex.: um `bio`/`location` maior que o limite atual, ou um `totalXP` fora de faixa) — isso bloquearia essa escrita mesmo sem relação direta com os campos de pet; (2) o app pode estar conectado a um projeto Firebase diferente daquele onde as regras foram publicadas — o repositório referencia dois destinos de hosting (`veloxy-20b42` e `veloxy-run`, ver `.firebaserc`), e vale confirmar que `VITE_FIREBASE_PROJECT_ID` no `.env.local` da máquina de teste aponta para o mesmo projeto onde as regras foram editadas. Impacto: a funcionalidade de pet inteira é inutilizável (é o primeiro passo obrigatório do fluxo). Recomendação: abrir o documento `users/{uid}` da conta de teste no Console do Firebase e conferir se algum campo foge dos limites de `validUserBase`, e confirmar o `VITE_FIREBASE_PROJECT_ID` contra o projeto onde as regras foram publicadas, antes de investigar mais a fundo a lógica da regra em si.

🟠 **Importante** — Nenhuma das três funcionalidades novas da semana tem teste automatizado (seção 10), incluindo as funções de maior risco de regressão silenciosa: `createGroupPost`/`toggleGroupPostLike`/`addGroupPostComment`/`sendGroupMessage`/`choosePet`/`purchasePetAccessory`/`equipPetAccessory` em `database.ts`.

🟡 **Moderado** — O incidente do `Dashboard.tsx` apagado (seção 11) não deixou marca no código atual, mas expõe um risco de processo real: mudanças sendo aplicadas por cópia manual de arquivo, sem `git diff` de conferência antes de commitar, tornam fácil perder ou duplicar mudanças não relacionadas ao que está sendo entregue (o `git add -A` que resolveu o merge da branch "67" também arrastou a exclusão do Dashboard).

🟢 **Baixa prioridade** — Aviso de lint em `Pet.tsx` (seção 10), sem impacto funcional.

## 13. Pontos de Atenção

- Fluxo de entrega sem push direto ao GitHub nesta sessão: todas as mudanças precisaram ser copiadas manualmente para a máquina do usuário, o que já causou um branch extra ("67"), uma exclusão acidental de arquivo, e múltiplas rodadas de "onde eu coloco esse arquivo". Resolver o acesso de push (instalar o Claude GitHub App na organização, mencionado durante a sessão) eliminaria essa classe inteira de risco.
- Sistema de pet sem nenhuma ilustração própria — os 5 pets e os 12 acessórios são representados por emoji, uma decisão consciente de escopo (sem pipeline de arte no projeto), mas vale confirmar com o grupo se isso é aceitável para a versão que será entregue/avaliada.
- `Group.tsx` é a única tela do projeto com layout específico de desktop (`lg:` breakpoint) — o resto do app é mobile-first sem tratamento de tela grande; se o projeto for avaliado/usado em desktop, essa inconsistência pode ficar visível.
- A lacuna já apontada no relatório anterior (consentimento de termos sem caminho de reaceite) continua sem solução — não foi tocada nesta semana.

## 14. Recomendações

🔴 **Prioridade alta**
- Diagnosticar e corrigir o erro de permissão ao adotar pet (seção 12) antes de qualquer outro trabalho na funcionalidade — hoje ela é 100% inutilizável.
- Resolver o acesso de push do Claude ao repositório (instalar o GitHub App na organização) para eliminar o fluxo manual de cópia de arquivos.

🟡 **Prioridade média**
- Adicionar testes para as funções novas de grupo (posts/comentários/mensagens) e de pet (escolher, ganhar moeda, comprar, equipar) — são lógica de negócio nova sem nenhuma cobertura.
- Decidir e documentar se `Group.tsx` deve permanecer a única tela com layout de desktop dedicado, ou se vale padronizar (para mais telas, ou reverter para mobile-only).

🟢 **Prioridade baixa**
- Corrigir o aviso de `exhaustive-deps` em `Pet.tsx` memoizando `purchasedAccessoryIds` com `useMemo`.
- Avaliar se os pets/acessórios em emoji são a versão final ou um placeholder a substituir por arte própria.

## 15. Próximos Passos

1. **Resolver o bug de permissão na adoção de pet**
   - Motivo: bloqueia 100% do uso da maior entrega da semana.
   - Impacto esperado: destrava toda a funcionalidade de pet (adoção, moeda, acessórios, loja) para teste real.
2. **Resolver o acesso de push do Claude ao GitHub**
   - Motivo: o fluxo manual atual já causou perda acidental de um arquivo e branches extras; tende a piorar conforme mais gente do grupo mexe no repositório.
   - Impacto esperado: elimina uma classe inteira de erro humano no processo de entrega.
3. **Cobrir com teste as funções novas de grupo e pet**
   - Motivo: é a maior superfície de lógica de negócio nova do projeto até agora, hoje sem nenhuma rede de segurança automatizada.
   - Impacto esperado: reduz o risco de regressão silenciosa nas próximas mudanças nessas áreas.

## 16. Evolução do Projeto

*Avaliação técnica aproximada, não uma métrica objetiva — compara o estado imediatamente antes do primeiro commit do período (`f8e121e`) com o estado atual (`HEAD` = `9eb8754`).*

| Dimensão | Início da semana | Final da semana | Observação |
|---|---|---|---|
| Funcionalidades | 4 | 6 | Grupo com feed/chat e sistema de pet são adições grandes de escopo |
| Estabilidade | 4 | 3 | Bug crítico não resolvido (adoção de pet) puxa a nota para baixo apesar do resto passar nas verificações |
| Arquitetura | 3 | 4 | Centralização de conquistas numa lib compartilhada é uma melhoria estrutural real |
| Segurança | 4 | 4 | Sem novo achado, e a falha crítica do relatório anterior já estava corrigida antes deste período |
| Qualidade do código | 4 | 4 | Typecheck/lint/build limpos; ausência total de teste nas entregas novas segura a nota |
| UX/UI | 3 | 4 | Duas telas novas completas (Grupo, Pet) com estados de carregamento/erro tratados |
| Testes | 3 | 3 | Nenhum teste novo apesar do volume grande de lógica de negócio nova |
| Performance | 3 | 3 | Sem mudança relevante identificada nesta semana |

## 17. Resumo para Apresentação

**Esta semana**
- ✅ Tela de Grupo com feed e chat em tempo real
- ✅ Sistema de Pet completo (RunCoin, 5 espécies, acessórios, 8 conquistas novas)
- ✅ Validação de senha/nome de usuário e toggle de unidade km/mi na Home
- 🔧 Conquistas centralizadas numa lib compartilhada (Perfil + Pet usam a mesma fonte)
- 🛡️ Falha crítica de segurança do relatório anterior (km semanal de grupo) confirmada como já corrigida

**Próxima semana**
- 🎯 Resolver o bug de permissão que impede adotar um pet (bloqueador atual)
- 🎯 Resolver acesso de push do Claude ao GitHub, para parar de aplicar mudanças por cópia manual
- 🎯 Começar a cobrir com testes as funções novas de grupo e pet

---

## Comparação com semanas anteriores

O relatório anterior (10–16/08) apontava um único achado crítico: `validGroupWeeklyKmUpdate` sem checagem de `memberIds`, permitindo que qualquer usuário autenticado manipulasse o km semanal de grupos alheios. **Esse achado está resolvido** — a função hoje exige `request.auth.uid in resource.data.memberIds` antes de aceitar a escrita, e nenhum novo problema de severidade equivalente foi introduzido nas regras desta semana (o novo `isGroupMember()` para posts/mensagens do grupo já nasce com essa checagem).

Das recomendações de prioridade média do relatório anterior, nenhuma foi endereçada nesta semana: ainda não há teste para `saveActivity`/`updateUserXP`/transações de grupo, o caminho de reaceite de Termos de Uso continua inexistente, e a migração de classes de cor fixas para tokens de tema não avançou (as telas novas desta semana já nasceram usando os tokens corretos, então pelo menos não pioraram o problema).

O padrão de "funcionalidade nova sem teste" se repete pela segunda semana seguida e agora cobre uma superfície bem maior de código (grupo + pet, não só km semanal) — vale tratar como prioridade estrutural, não pontual, antes que a lacuna fique grande demais para fechar de uma vez.
