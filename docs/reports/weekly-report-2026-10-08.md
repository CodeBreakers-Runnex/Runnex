# Relatório Semanal — 01/10 a 08/10/2026

**Projeto:** Runnex · **Commits:** 2 · **Autores:** SolinaDev, mhh09

## Resumo

Foi uma semana de pouca produção, com duas entregas:

1. **Migração para o repositório da organização (02/10).** O commit `2aabfb4` é uma cópia do código de `SolinaDev/Veloxy` (branch `beta-2.0`) **sem o histórico anterior**. O código não mudou. A consequência é que o Git deste repositório não alcança nada antes de 02/10.
2. **Controle de tênis (08/10, `mhh09`).** Está no PR [CodeBreakers-Runnex/Runnex#1](https://github.com/CodeBreakers-Runnex/Runnex/pull/1), com +1.465 linhas em 23 arquivos. O CI está verde, mas o PR **não foi revisado nem incorporado a `main`**.

A branch `controle-de-sono` foi criada, mas está vazia. Não há código para avaliar.

## Controle de tênis

**O que faz:**
- o corredor cadastra tênis informando a km anterior ao app e um limite (padrão 600 km);
- escolhe o tênis na tela de corrida, com o padrão pré-selecionado;
- recebe aviso quando o uso passa de 80% ("atenção") ou de 100% ("gasto");
- pode aposentar um tênis;
- pode corrigir o tênis vinculado às últimas 50 corridas.

**Pontos fortes:**
- **Km calculada na consulta, não guardada.** O total é a soma das corridas vinculadas, então excluir ou trocar o tênis de uma corrida nunca deixa a conta errada.
- **O banco também barra dados inválidos.** Há regra de limites, só um tênis padrão por usuário e um tênis aposentado não pode ser o padrão.
- **A API valida o dono no servidor.** Exige e-mail verificado e limita a frequência das chamadas.
- **Bem testada.** São 10 testes no backend (limites de 80% e 100%, privacidade entre contas, exclusão de conta) e testes de interface.

**Correções incluídas no mesmo commit (`RunTracking.tsx`):**
- Uma corrida não salva, quando recuperada depois de o app fechar, podia ser recuperada por **outra conta no mesmo aparelho**. Agora o progresso guardado leva o dono (`userId`).
- Dar dois cliques em "Finalizar" podia salvar a corrida duas vezes. Agora há uma trava.

## Problemas encontrados

| | Problema | Evidência | O que fazer |
|---|---|---|---|
| 🟡 | Perfil pode ser criado com nome "Corredor" (**não testado**) | `routers/shoes.py`: `lock_owner` chama `get_or_create_user(db, uid, "Corredor", None)`. Quem cadastra um tênis antes de existir no Postgres fica com esse nome, e nada depois o corrige | Testar antes do merge; se confirmado, usar o nome do token Firebase |
| 🟡 | Histórico do Git descartado | O commit `2aabfb4` é a raiz do repositório | Não apagar `SolinaDev/Veloxy`; citá-lo no README |
| 🟡 | Telas muito grandes | `RunTracking.tsx` ~1.030 linhas; `Profile.tsx` 886; `Group.tsx` 831; `Shoes.tsx` 623 | Extrair o seletor de tênis de `RunTracking` |
| 🟢 | `shoeId` aparece no feed de outros usuários | `ActivityOut` é usado em `/activities/feed` e `/by-users`. Só vaza o ID numérico, mas contradiz "tênis são privados" | Omitir o campo para atividades de terceiros |
| 🟢 | Tênis cadastrado por engano não pode ser excluído | Não existe `DELETE /shoes/{id}`, só aposentar | Decidir se é necessário |

Nenhum problema crítico.

## Verificação

Não rodei nada localmente: o container não tem as dependências instaladas, e o backend exige um banco Postgres de teste. A verificação veio do **CI do GitHub** (runs #2 a #6). Os 3 jobs passaram em todos os commits da semana:
- frontend: lint, testes e build;
- backend: migrations, `alembic check` e pytest;
- regras do Firestore.

A única lacuna de teste é a lógica nova de `RunTracking.tsx` (recuperação de corrida por usuário e trava de salvamento duplo), que não tem teste dedicado.

## Desde o relatório de 28/08

- **Bug de adotar pet: deixou de existir.** O pet agora usa a API própria, não o Firestore. A causa original nunca foi explicada; o código que falhava só deixou de existir.
- **Faltavam testes de grupo e pet: resolvido.** Agora existem no frontend e no backend.
- **Reaceite de termos: resolvido.** A versão dos termos (`termsVersion`) é comparada com a versão atual (`LEGAL_VERSION`).
- **Telas grandes: continua.**
- **Histórico do Git mal cuidado: continua, e piorou.** Em agosto foi um commit chamado "67"; agora o histórico inteiro foi descartado.
- **A mudança para FastAPI + Postgres não está registrada em nenhum relatório.** Foi a maior mudança do projeto e aconteceu entre 28/08 e 02/10.

## Próximos passos

1. **Testar o caso "Corredor" e fazer o merge do PR #1.** Cada dia parado aumenta a chance de conflito em `RunTracking.tsx` e `Profile.tsx`.
2. **Fazer o deploy na ordem certa:** primeiro o backend (que roda a migration), depois o frontend e o app. Na ordem inversa, a tela de corrida falha ao carregar os tênis.
3. **Subir o que existe de `controle-de-sono` como PR em rascunho.** Trabalho fora do GitHub não passa pelo CI nem tem revisão.
