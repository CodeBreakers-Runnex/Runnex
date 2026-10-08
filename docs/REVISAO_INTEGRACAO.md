# Revisão da integração de tênis, sono e calendário

Esta proposta combina os módulos dos PRs #1, #2 e #3. Os conflitos de imports, modelos, rotas, menu, documentação e captura da corrida foram resolvidos mantendo os três módulos. Uma corrida pode recuperar o tênis e o planejamento escolhidos, salvar uma única atividade real e então vinculá-la ao calendário.

## Migrações

A revisão `d8a6c3f9012b` une os três heads, sem alterar as revisões já publicadas:

| Módulo | Head anterior |
| --- | --- |
| Tênis | `f6b8c3d9e102` |
| Sono | `b72d8e9104c6` |
| Calendário | `c3a6f14d8209` |

O deploy usa `alembic upgrade head`, seguido de `alembic check`. A CI com PostgreSQL 16 também verifica a atualização a partir de cada head anterior. Os ciclos de downgrade da CI rodam somente no banco de teste descartável; não são instruções para o deploy.

## Comportamentos verificados

- Recuperar e salvar a corrida preserva o tênis e o planejamento da mesma conta. Dados do planejamento não entram no payload público da atividade.
- Trocar de conta durante o salvamento ou durante o vínculo libera a nova conta. Uma resposta antiga não interrompe sua corrida.
- Sair e voltar ao mesmo UID invalida respostas da sessão anterior, incluindo redirecionamentos, avisos e desbloqueio do salvamento.
- Reassociar o tênis não muda o vínculo com o calendário, o XP nem a quantidade de quilômetros reais nos resumos.
- Excluir uma corrida individualmente ou em lote recalcula o uso do tênis e o volume dos resumos, reabre o treino e preserva o registro de sono.
- Excluir uma conta elimina seus dados nos três módulos e mantém os dados da outra conta.

## Validação

Frontend: `npm run lint`, `npm run test` e `npm run build`. Backend: migrações do zero, atualização de cada head anterior, `alembic check` e `pytest` completo com PostgreSQL nativo. A CI também executa regras do Firestore e build/testes Android.

O emulador local de PostgreSQL usa uma única sessão. Na revisão anterior, as conexões adicionais dos testes de WebSocket expiraram e o teste de transações concorrentes foi ignorado. Esses casos devem ser avaliados no PostgreSQL nativo, sem mudar o código dos grupos para acomodar o emulador.

Esta proposta mantém os requisitos Android e os procedimentos de validação em aparelho descritos em [CONTROLE_SONO.md](CONTROLE_SONO.md) e [CALENDARIO_TREINOS.md](CALENDARIO_TREINOS.md). O merge e a publicação da aplicação são etapas separadas da avaliação.
