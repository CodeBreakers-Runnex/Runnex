# Plano de ação — Controle de tênis no Runnex

Data: 02/10/2026. Repositório: `CodeBreakers-Runnex/Runnex`.
Branch de implementação: `controle-tenis`. Base: `main`, que contém o snapshot beta 2.0.

## Objetivo

Permitir que cada corredor acompanhe a quilometragem dos seus tênis, identifique
quando o uso se aproxima do limite escolhido e registre o desgaste percebido.
O app estima o estado com os dados informados; ele não inspeciona nem mede a
condição física do tênis.

## Regras do recurso

| Estado | Regra | Comportamento |
| --- | --- | --- |
| Em bom estado | Uso abaixo de 80% do limite e sem desgaste informado | Mostrar uso acumulado e quilômetros restantes |
| Atenção | Uso entre 80% e menos de 100% do limite | Avisar na tela de tênis, antes do treino e após salvar a corrida |
| Gasto | Uso igual ou superior a 100%, ou desgaste informado pelo usuário | Destacar o aviso e permitir aposentadoria |
| Aposentado | Marcado pelo usuário | Preservar histórico e impedir novos vínculos enquanto estiver aposentado |

O limite inicial do formulário é **600 km**, um valor de configuração editável,
não uma vida útil universal. Para esse exemplo, o aviso começa em 480 km.
O usuário pode ajustar o limite e registrar desgaste antes de alcançá-lo.
Desmarcar o desgaste informado não remove o estado "Gasto" se o limite já foi atingido.

`Uso total = quilômetros anteriores ao app + soma das corridas vinculadas ao tênis`.
Somente o tênis escolhido recebe a distância de uma corrida. Alterar ou excluir
uma corrida muda a soma automaticamente, sem manter contadores duplicados.
A quilometragem inicial deve conter apenas uso não incluído no histórico vinculado.

## Etapas de execução

| Ordem | Ação | Entrega / critério de conclusão | Responsabilidade | Situação |
| --- | --- | --- | --- | --- |
| 1 | Definir regras e escopo | Estados, fórmula, limite editável e aposentadoria documentados | Produto | Implementado |
| 2 | Criar persistência | Tabela `shoes`, vínculo opcional nas atividades e migração Alembic | Backend | Implementado |
| 3 | Expor API privada | Cadastro, listagem, edição e associação de corridas somente do proprietário | Backend | Implementado |
| 4 | Construir "Meus tênis" | Formulário, progresso, avisos, edição, padrão e aposentados | Frontend | Implementado |
| 5 | Integrar a corrida | Seleção do tênis, padrão pré-selecionado e preservação ao recuperar treino | Frontend | Implementado |
| 6 | Permitir correções | Associar, trocar ou remover o tênis das últimas 50 corridas pela tela | Frontend / Backend | Implementado |
| 7 | Validar o recurso | Testes de interface, API, autorização e migração; lint e build | QA / Desenvolvimento | Automatizado na branch |
| 8 | Revisar e disponibilizar | Revisar o PR, aplicar migração e publicar backend e app | Mantenedores / Deploy | Após revisão da branch |

## Fluxo do corredor

1. Acessar **Perfil → Meus tênis** ou o menu lateral no desktop.
2. Cadastrar nome, marca, modelo, compra opcional, uso anterior e limite.
3. Definir um tênis padrão, se desejar.
4. Na tela de corrida, confirmar o tênis ou escolher "Sem tênis vinculado".
5. Salvar o treino para atualizar a quilometragem e receber um aviso, se aplicável.
6. Corrigir associações anteriores em "Tênis das corridas recentes".
7. Editar o tênis para informar desgaste, ajustar o limite, aposentar ou reativar.

É possível corrigir a seleção durante uma pausa no treino. Se o app for fechado,
o snapshot preserva o tênis escolhido. Snapshots anteriores ao recurso continuam
recuperáveis sem vínculo automático com o tênis padrão.

## Integração técnica

| Área | Implementação |
| --- | --- |
| Tela | Rota protegida `/tenis`, com acesso pelo perfil e menu lateral |
| Serviço frontend | `src/services/shoesApi.ts` |
| API | `GET /shoes`, `POST /shoes`, `PUT /shoes/{id}` |
| Histórico | `PUT /activities/{id}/shoe`, com `shoeId` ou `null` |
| Nova corrida | Campo opcional `shoeId` em `POST /activities` |
| Banco | `shoes` e `activities.shoe_id`, com índices e chaves estrangeiras |
| Migração | `f6b8c3d9e102_add_running_shoes.py` |
| Segurança | Firebase Auth existente; escrita exige e-mail confirmado; validação de proprietário no servidor |
| Tênis padrão | Um por usuário, garantido por índice único parcial e serialização das alterações |

Os tênis são privados. Corridas antigas permanecem sem vínculo até uma escolha
explícita; a migração não atribui retroativamente todas as corridas ao primeiro tênis.
O backend aceita corrigir qualquer corrida própria, enquanto a tela mostra as 50
mais recentes. Os totais consideram todas as corridas vinculadas, não apenas essas 50.
Excluir todas as corridas preserva o uso anterior informado. Excluir a conta remove
também seus tênis. Aposentar é uma edição, sem apagar registros.

## Validação e disponibilização

Frontend:

```bash
npm ci
npm run lint
npm run test
npm run build
```

Backend, usando um PostgreSQL de testes cujo nome contenha `test`:

```bash
cd backend
pip install -r requirements-dev.txt
# Configurar DATABASE_URL e FIREBASE_PROJECT_ID para o ambiente de testes.
alembic upgrade head
alembic check
pytest
```

Os testes cobrem limites exatos de 80% e 100%, valores inválidos, desgaste
manual, padrão único, aposentadoria, reativação, corrida sem tênis, soma de
quilômetros, exclusão, reassociação repetida sem duplicação, preservação de XP,
isolamento entre contas e exclusão da conta.

Para disponibilizar o recurso, incorporar a branch após revisão, aplicar
`alembic upgrade head` no banco do ambiente e publicar o backend antes do frontend.
O script existente `backend/render-start.sh` já aplica as migrações ao iniciar.
Para Android, sincronizar o build web e gerar uma nova versão pelo fluxo Capacitor
existente. Publicar em produção não faz parte da alteração de código na branch.

## Evoluções posteriores

- Paginação para corrigir corridas anteriores às 50 mais recentes.
- Foto do tênis e anotações sobre solado, amortecimento e tipo de terreno.
- Histórico de avaliações de desgaste e notificações push opcionais.
- Previsão de quando o limite será alcançado com base no ritmo de uso recente.

Essas evoluções são propostas e não estão implementadas neste ciclo.

## Revisão de 8 de outubro de 2026

A recuperação de corridas exige UID confirmado; rascunhos antigos sem proprietário não são retomados automaticamente. Troca de conta interrompe a corrida na interface sem atribuir seu rascunho à nova conta. Respostas de gravação, edição e avisos ficam restritas à conta que iniciou a operação. O lock do tênis padrão serializa edições usando FOR NO KEY UPDATE, permitindo a gravação da atividade pela FK de usuário. A CI também compila o APK e executa os testes Android disponíveis.
