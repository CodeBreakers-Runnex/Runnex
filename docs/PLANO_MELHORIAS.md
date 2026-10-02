# Plano de melhorias: mobile, privacidade e repositório

Base: análise técnica de 30/09 (`docs/reports/analise-tecnica-2026-09-30.docx`).
Critérios com nota mais baixa: prontidão do app mobile (5,5), privacidade/LGPD (6,5)
e organização do repositório (6,5).

## Já corrigido (30/09, branch beta-2.0)

- **CORS do app Android/iOS** (`aa63ad0`): o backend passou a aceitar `https://localhost`
  e `capacitor://localhost`. Falta confirmar no aparelho (fase M1).
- **Perfil privado no feed** (`6aadf39`): corridas e perfis privados saíram do feed
  global, do feed do grupo (`by-users`) e do ranking do grupo (`by-ids`). Toda listagem
  tem teto de 100 itens.
- **Firestore antigo fechado** (01/10): qualquer usuário logado lia o perfil de qualquer
  outro e as corridas antigas com rota GPS direto pelo SDK. Agora só o dono lê o próprio
  documento e as coleções antigas (`activities`, `groups`, `events`, `products`) estão
  fechadas. Regras testadas no emulador oficial (`firestore-tests/`, no CI) e reduzidas
  de 817 para 339 linhas (22 validações sem uso removidas). **Pendente com você:**
  `firebase deploy --only firestore:rules` e excluir a coleção `activities` no console
  (só corridas do modo simulação).
- **Política de privacidade reescrita** (01/10): o texto descrevia outro app (cupons de
  parceiros, Spotify/Apple Music, pedalada, login Apple/Microsoft, contatos, sensores). A
  nova versão (`LEGAL_VERSION` 2026-10-01) lista os dados que o app coleta de verdade,
  base legal, quem vê o quê, provedores (Firebase, Render), transferência internacional,
  prazos, direitos do titular e canal de contato. Cada afirmação foi conferida no código.
- **Aceite dos termos para todos** (01/10): quem entrava com Google nunca aceitava os
  termos. Agora o app pede o aceite quando a versão aceita difere da atual (inclusive
  para usuários antigos), sem bloquear o app se o backend estiver fora do ar.

---

## 1. Prontidão do app mobile (5,5 → meta 9)

| Fase | Item | Por quê | Esforço |
|---|---|---|---|
| **M1** | Gerar APK novo (após deploy do backend) e rodar `docs/TESTE_ANDROID.md` | Confirma a correção do CORS e o GPS em segundo plano, o risco nº 1 da banca | 2h |
| M1 | Conferir `VITE_API_URL` no `.env.local` usado no build do APK | O APK embute a URL no build; apontar para o lugar errado quebra tudo sem aviso | 10 min |
| **M2** | Tela "acordando o servidor" + ping em `/health` ao abrir o app | O plano gratuito do Render hiberna; hoje a primeira tela parece travada por ~1 min | 2–3h |
| M2 | Botão "voltar" do Android (`@capacitor/app`) | Hoje depende do comportamento padrão do WebView; na Home deve sair do app, em modais deve fechar o modal | 2h |
| M2 | Fila de envio offline para corridas | Se o salvar falhar sem internet, reenviar sozinho quando a rede voltar (o snapshot local já existe, falta o reenvio) | 4–6h |
| **M3** | `versionCode`/`versionName` (hoje 1 / "1.0") atualizados a cada APK | Saber qual versão está no celular de quem testa | 15 min |
| M3 | Ícone e splash próprios (conferir se não são os padrões do Capacitor) | Primeira impressão na banca | 1h |
| M3 | APK de release assinado (keystore fora do git) | Debug funciona para a banca, mas release é o correto para distribuir | 1–2h |

**Critério de pronto:** os itens 2.x do roteiro Android passam num aparelho real e os
resultados estão anotados.

---

## 2. Privacidade e LGPD (6,5 → meta 9)

### 2.1 A política de privacidade descreve outro app

`src/content/legalContent.ts` promete ou cita coisas que não existem e omite o que existe:

| Diz | Realidade |
|---|---|
| Integração com Spotify e Apple Music | Só um link que abre o Spotify, sem troca de dados |
| Corrida, caminhada **e pedalada** | Só corrida |
| Login com Google, **Apple e Microsoft** | Só e-mail/senha e Google |
| Permissão de **contatos** | O app não pede nem usa contatos |
| Inscrição em eventos "diretamente pelo aplicativo" | O app marca interesse; a inscrição real é no site do evento |
| *(não cita)* | Dados hospedados no Render (backend/Postgres) e no Google Firebase (login) |
| *(não cita)* | Treinador virtual guarda pace, objetivo e respostas ensinadas |

Uma política que promete tratamento de dados que não acontece e omite o que acontece é
exatamente o que uma banca que leia a LGPD vai apontar.

### 2.2 Itens

| Fase | Item | Base legal / motivo | Esforço |
|---|---|---|---|
| **P1** | Reescrever a seção 8 (Privacidade) com: dados coletados de verdade, finalidade, base legal, quem recebe (Firebase, Render), transferência internacional, tempo de guarda, direitos do titular e como exercê-los | LGPD art. 9 (transparência), art. 18 (direitos), art. 33 (transferência internacional) | 3–4h |
| P1 | Remover da política o que não existe (tabela acima) e subir `LEGAL_VERSION`, pedindo novo aceite | Coerência; o app já registra `terms_version` e `terms_accepted_at` | 1h |
| **P2** | "Baixar meus dados": `GET /users/{uid}/export` devolvendo JSON com perfil, corridas, pet, grupos, posts e memória do treinador | Art. 18, II e V (acesso e portabilidade). Hoje só existe a exclusão | 4–6h |
| P2 | Zona de privacidade na rota: esconder os primeiros e últimos ~200 m do traçado para outros usuários | A rota pública revela onde a pessoa mora; o Strava faz o mesmo | 4–6h |
| P2 | `android:allowBackup="false"` (ou regras de extração) | O backup do Google copia histórico do treinador e snapshot de corrida sem o usuário saber | 30 min |
| **P3** | Limpar o histórico local do treinador ao excluir a conta | Coerência com a exclusão | 15 min |
| P3 | Token do WebSocket fora da query string (mensagem inicial após conectar) | URLs com token aparecem em logs de servidor/proxy | 2h |
| P3 | Aviso no treinador: "orientações gerais, não substitui um profissional" | Ele fala de zonas de frequência cardíaca | 15 min |

**Decisão sua:** as corridas devem continuar **públicas por padrão**? Pela LGPD, o mais
seguro é privacidade por padrão, com o usuário escolhendo tornar público. Muda a
experiência do feed, por isso é uma decisão de produto, não técnica.

---

## 3. Organização do repositório (6,5 → meta 9)

### 3.1 Sobre apagar o repositório e criar outro

**Recomendação: não apagar.** Os problemas reais são três: `main` 80 commits atrás, 15
branches e nenhuma tag de versão. Os três se resolvem no próprio repositório em cerca de
1 hora. Apagar custa caro e não resolve nada que a limpeza não resolva:

| Apagar e recriar | Limpar no lugar |
|---|---|
| Perde o histórico de 87 commits desde junho, que é a evidência do processo de desenvolvimento | Histórico preservado |
| Perde o histórico do CI e dos PRs | Preservado |
| Obriga a reconectar Render, Firebase Hosting e o app do GitHub, com risco de deploy quebrado perto da banca | Nada muda na infraestrutura |
| Não há segredo no histórico que justifique (verificado: nenhum `.env`; o `google-services.json` antigo é configuração pública do Firebase) | — |

**Se ainda assim quiser um repositório novo**, faça sem perder nada: crie o repositório
novo, envie o histórico completo (`git push` da `main` já atualizada, com as tags) e
**arquive** o antigo em vez de apagar (Settings → Archive). Arquivar é reversível;
apagar não é.

**Sobre a autoria dos commits:** 69 dos 87 commits da `beta-2.0` estão em nome de
"Claude". Um repositório novo não muda isso, e não deveria ser a intenção. O caminho
seguro é ser transparente: verifique a regra da sua instituição sobre uso de IA no TCC e
declare o uso na monografia e na banca, junto com o que foi decisão e trabalho de vocês
(escopo, validação, testes em aparelho, decisões de produto).

### 3.2 Limpeza no lugar (passo a passo)

| Ordem | Passo | Esforço |
|---|---|---|
| **R1** | Criar tags das versões antes de apagar qualquer branch: `v1.5` (beta-1.5) e `v2.0` (beta-2.0) | 10 min |
| R1 | Abrir PR `beta-2.0 → main`, esperar o CI verde e mesclar | 20 min |
| R1 | Confirmar que Render e Firebase Hosting publicam a partir da `main` | 15 min |
| **R2** | Apagar branches já mescladas: `beta-1.0` a `1.4.1`, `beta-1.5`, `app-beta-1.3`, `67`, `backend-migration`, `background-gps`, `ChatbotRunnex`, `feature/chatbot-corrida`, `claude/implementacao-funcionalidades-9po4th` (antes, conferir com `git branch -r --merged origin/main`; as tags guardam os pontos importantes) | 15 min |
| R2 | Proteção da `main`: exigir PR e CI verde para mesclar; bloquear force push | 10 min |
| **R3** | Fluxo daqui em diante: branch por tarefa (`feat/...`, `fix/...`) → PR → CI → `main`; tag a cada versão entregue | contínuo |
| R3 | README com o selo do CI e a versão atual | 15 min |

---

## Ordem sugerida

1. **Esta semana:** R1 (main atualizada e deploy confirmado) → M1 (APK + roteiro Android) → P1 (política real).
2. **Semana seguinte:** P2 (exportar dados, zona de privacidade, allowBackup) → M2 (servidor acordando, voltar, fila offline) → R2.
3. **Se sobrar tempo:** M3 e P3.

Decisões pendentes com você:

1. Limpar o repositório no lugar (recomendado) ou criar um novo?
2. Corridas públicas ou privadas por padrão?
3. APK de release assinado ou debug para a banca?
