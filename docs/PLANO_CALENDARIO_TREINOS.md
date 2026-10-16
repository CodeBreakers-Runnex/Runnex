# Plano de ação — Calendário de treinos do Runnex

**Projeto:** CodeBreakers-Runnex/Runnex  
**Data:** 8 de outubro de 2026  
**Objetivo:** permitir que o corredor organize os próximos treinos, acompanhe o cumprimento da agenda e compare o que planejou com o que realizou.  
**Branch de implementação:** `calendario-de-treinos`.

## 1. Ponto de partida

A main consultada está no commit `2aabfb48d2de33638641f90c7c0969f76efdf64e`, versão beta 2.0. O app usa React/TypeScript no frontend, Capacitor no Android e uma API FastAPI com SQLAlchemy/PostgreSQL e autenticação Firebase.

Já existem a tela de corrida `RunTracking.tsx`, o serviço `activitiesApi.ts` e as rotas `/activities`, com distância, duração, pace e data de registro. A tela de eventos contém um botão de calendário sem ação associada. Ainda falta uma agenda privada para treinos futuros.

As entregas de tênis e sono foram preparadas em branches separadas. O núcleo do calendário pode ser desenvolvido sobre a main; as integrações com esses módulos devem usar suas versões efetivamente integradas e aprovadas.

## 2. Primeira entrega: agenda e acompanhamento

| Recurso | Comportamento esperado | Prioridade |
| --- | --- | --- |
| Calendário | Alternar entre mês, semana e lista; destacar hoje e mostrar os treinos de cada dia. | P0 |
| Novo treino | Cadastrar título, categoria e data; horário, distância, duração e observações opcionais. | P0 |
| Categorias | Corrida leve, intervalado, longo, ritmo, caminhada, outro e descanso. São etiquetas escolhidas pelo usuário. | P0 |
| Gestão da agenda | Editar, reagendar, cancelar ou excluir um treino; copiar um treino para outra data. | P0 |
| Acompanhamento | Exibir planejado, concluído, não realizado ou cancelado; indicar pendência quando a data passar. | P0 |
| Iniciar treino | Abrir o registro de corrida a partir do treino escolhido e manter essa seleção durante pausas e retorno ao app. | P0 |
| Concluir treino | Vincular uma corrida própria já salva ou registrar conclusão manual, com identificação da origem. | P0 |
| Comparação | Mostrar meta de distância/duração e os valores da corrida vinculada; objetivos ausentes ficam sem comparação. | P0 |
| Resumo semanal | Mostrar treinos planejados, concluídos e não realizados, além do volume planejado e realizado. | P0 |
| Próximo treino | Oferecer acesso rápido no perfil/menu e um cartão com o próximo treino na tela inicial. | P1 |

**Resultado da primeira entrega:** o usuário consegue organizar uma semana, começar um treino pelo calendário, registrar a corrida e acompanhar o resultado na agenda.

## 3. Fluxo do usuário

1. Abrir **Calendário de treinos** pelo menu ou perfil.
2. Escolher um dia e tocar em **Adicionar treino**.
3. Preencher o título e a categoria; informar objetivos e horário se desejar.
4. Visualizar os próximos treinos e ajustar a agenda quando necessário.
5. Tocar em **Iniciar corrida** no treino escolhido.
6. Finalizar a corrida pelo fluxo atual do app.
7. Após a corrida estar salva, associá-la ao treino e mostrar a comparação com os objetivos.
8. Para atividade realizada fora do app, usar **Concluir manualmente**, identificado como autorrelato.
9. Se precisar alterar a agenda, escolher reagendamento, cancelamento ou **Não realizado**.

Exemplo: um treino planejado de 5 km pode ser vinculado a uma corrida real de 4,7 km. O calendário mostra ambos os valores e a diferença, preservando os 4,7 km registrados.

## 4. Regras de funcionamento

- **Planejamento e atividade são registros separados.** Criar um treino, marcar descanso ou concluir manualmente altera apenas a agenda. Quilômetros, XP, RunCoin, pet, ranking e conquistas continuam dependentes das corridas reais e das regras existentes.
- **Conclusão é explícita.** Uma data passada continua pendente até o usuário concluir, reagendar, cancelar ou marcar não realizado. “Pendente” é uma indicação calculada; a passagem do tempo não afirma que o corredor faltou.
- **Metas são referências pessoais.** A conclusão pode ocorrer com distância ou duração diferentes da meta; a tela explica a diferença. Categorias não geram automaticamente prescrição ou intensidade.
- **Múltiplos treinos no mesmo dia são permitidos.** Alertar sobre horários iguais ajuda a organizar sem bloquear sessões legítimas.
- **Descanso tem tratamento próprio.** Não pede distância nem vínculo com corrida; aparece na agenda e fica separado dos indicadores de sessões de corrida.
- **Uma corrida completa no máximo um treino.** Conferir proprietário e unicidade da associação no servidor. Repetir a mesma associação retorna o mesmo resultado; outra associação conflitante exige resolução explícita.
- **Salvar precede vincular.** Usar o ID retornado pela API de atividades. Uma falha na associação mantém a corrida salva e permite tentar a ligação novamente pelo calendário.
- **Exclusão de corrida mantém consistência.** Se a corrida vinculada for apagada, remover o vínculo e devolver o treino ao estado planejado, indicando que a evidência foi removida. Aplicar isso também à exclusão em lote.
- **Reagendamento é permitido em treinos abertos.** Guardar a data original e a data vigente; a nova data orienta o resumo da agenda. Objetivos de treinos concluídos ficam preservados para comparação; uma correção exige reabrir o treino.
- **Agenda privada por conta.** O UID vem do token autenticado. Planejamento e observações são consultados somente pelo proprietário, independentemente da visibilidade pública do perfil.

### Datas e horários

Guardar a data local, o horário opcional e o fuso IANA do treino, por exemplo `America/Sao_Paulo`. Quando houver horário, calcular também o instante UTC correspondente. Um treino sem horário representa aquele dia local, sem inventar uma hora.

Essa separação preserva o dia escolhido em viagens e evita interpretar `YYYY-MM-DD` como meia-noite UTC. O PostgreSQL armazena instantes com timezone em UTC e não conserva o nome do fuso original; por isso o fuso do planejamento precisa de um campo próprio.

Ao viajar, mostrar claramente o fuso do compromisso e oferecer conversão para o fuso atual. A mudança de fuso do aparelho não deve deslocar silenciosamente a data planejada.

## 5. Estrutura técnica proposta

### Frontend

Criar a rota protegida `/calendario-treinos` e os componentes de calendário, lista do dia, formulário e detalhe/comparação. Reaproveitar os estilos do app e as funções de data já disponíveis, com foco em navegação móvel, teclado e rótulos acessíveis.

Arquivos previstos:

- `src/pages/app/TrainingCalendar.tsx`
- `src/components/training/TrainingCalendarView.tsx`
- `src/components/training/WorkoutForm.tsx`
- `src/components/training/WorkoutDetails.tsx`
- `src/services/trainingApi.ts`
- `src/types/training.ts`

Integrar os acessos em `App.tsx`, `SideNav.tsx`, perfil e tela inicial. No registro da corrida, manter o ID do treino selecionado no estado recuperável, associado ao UID correto. Validar a seleção ao retornar ao app ou trocar de conta.

Tratar carregamento, agenda vazia, erro e tentativa novamente. Na primeira entrega, alterações dependem de confirmação da API; a interface mostra falhas e evita apresentar um treino como salvo ou concluído quando o envio falhou.

### Banco e backend

Criar `planned_workouts` com:

| Grupo | Campos propostos |
| --- | --- |
| Identificação | `id`, `user_id` com FK e exclusão em cascata da conta. |
| Conteúdo | `title`, `category`, `notes`. |
| Agenda | `planned_date`, `planned_time` opcional, `timezone`, `scheduled_at` UTC opcional, `original_date`. |
| Objetivos | `target_distance_km` e `target_duration_minutes`, opcionais. |
| Resultado | `status`, `completion_source` — atividade ou autorrelato —, `completed_at`, `completed_activity_id` opcional e único. |
| Controle | `created_at`, `updated_at`, `revision` para detectar edição concorrente. |

Usar índice por `user_id + planned_date`. Validar categorias, fuso, limites de texto e objetivos positivos, compatíveis com os limites existentes das atividades. Descanso aceita objetivos ausentes. Listagens devem ter intervalo e paginação limitados.

A associação com atividade exige a mesma conta e usa transação/lock para evitar dois vínculos simultâneos. O FK para atividade pode usar `ON DELETE SET NULL`, acompanhado de tratamento explícito do status nas rotas de exclusão individual e em lote.

| Método | Rota proposta | Finalidade |
| --- | --- | --- |
| GET | `/training/workouts?from=...&to=...` | Consultar a agenda própria por intervalo. |
| POST | `/training/workouts` | Criar treino ou descanso. |
| PATCH | `/training/workouts/{id}` | Editar ou reagendar, com verificação de revisão. |
| DELETE | `/training/workouts/{id}` | Excluir o planejamento próprio. |
| PUT | `/training/workouts/{id}/status` | Concluir manualmente, marcar não realizado, cancelar ou reabrir. |
| PUT | `/training/workouts/{id}/activity` | Associar uma corrida própria e concluir o treino; repetição idempotente. |
| DELETE | `/training/workouts/{id}/activity` | Remover o vínculo e reabrir o treino. |
| GET | `/training/summary?week=...` | Consultar o resumo semanal. |

As rotas de mudança exigem autenticação e e-mail confirmado, conforme os módulos privados recentes. As respostas públicas de atividades continuam contendo somente os dados já públicos da corrida; o planejamento fica nas rotas privadas de treinamento.

### Indicadores

Separar três informações: quantidade de compromissos cumpridos, volume planejado e volume das corridas registradas. Exibir autorrelatos como tal; eles não fornecem quilômetros comprovados.

Para semanas encerradas, a taxa de cumprimento considera concluídos sobre o total de treinos elegíveis, incluindo não realizados e pendentes, excluindo cancelados e descanso. Semana sem treinos fica “sem dados”. Para a semana atual, priorizar contagens e indicar que o período ainda está em andamento.

O volume realizado da semana usa cada atividade uma vez, no fuso escolhido. A comparação de cada treino usa sua corrida vinculada mesmo se foi concluída em outro dia. Mostrar a data real de registro: atualmente `created_at` é a data de salvamento da atividade, e não um campo específico de início da corrida.

## 6. Ordem de execução e entregáveis

| Etapa | Ação | Entregável e critério de conclusão |
| --- | --- | --- |
| 1 — Preparação | Atualizar a base da main, fechar contratos e regras de datas/status. | Escopo P0 definido e branch isolada pronta para desenvolvimento. |
| 2 — Persistência | Criar modelo, schemas, serviço privado, rotas e migração Alembic. | CRUD autenticado funcionando, migração do zero e `alembic check` aprovados. |
| 3 — Interface | Construir mês/semana/lista, formulário e detalhe; ligar menu/perfil. | Usuário cria, encontra, edita, copia, reagenda e acompanha treinos. |
| 4 — Corrida | Abrir a corrida pelo treino e associar o ID da atividade salva. | Comparação real funcionando; falha no vínculo preserva a corrida. |
| 5 — Acompanhamento | Adicionar resumo semanal e cartão de próximo treino. | Planejado, autorrelato e volume real claramente identificados. |
| 6 — Validação | Testar privacidade, datas, concorrência, exclusões e regressão de corrida/XP. | Testes, build web e build Android aprovados. |
| 7 — Integração | Atualizar documentação, conferir migrações e abrir PR para main. | PR revisável, sem conflitos e com critérios de aceite demonstrados. |

A estimativa de prazo deve ser fechada após a etapa 1, considerando o escopo aprovado e a disponibilidade para testes em aparelho.

## 7. Etapas seguintes

**Etapa 2 — Organização automática:** duplicar uma semana, criar repetição semanal com data de término, editar uma ocorrência ou as futuras e tratar exceções. Evitar gerar séries ilimitadas ou recriar ocorrências excluídas.

**Etapa 3 — Lembretes opcionais:** agendar notificações locais no Android com plugin compatível com Capacitor 8, ativadas pelo usuário. Tratar permissão recusada/revogada, edição, cancelamento, conclusão, logout e troca de conta. Usar um aviso discreto na tela bloqueada.

O plugin oficial permite agendamento local; a documentação exige verificação de permissão no Android 13+ e descreve restrições de entrega/exatidão. Planejar lembretes aproximados, com estado de disponibilidade visível, e testar em aparelho. A web pode começar com lembretes dentro do app; notificações com navegador fechado exigem projeto próprio.

**Etapa 4 — Integrações do Runnex:** mostrar o acesso ao resumo de sono no dia do treino, respeitando o consentimento e a disponibilidade; permitir consultar/escolher tênis após a integração do módulo correspondente; importar um evento escolhido para a agenda e exportar compromissos em ICS por ação do usuário.

A opção de tênis no planejamento será uma preferência: o desgaste é atualizado somente pela corrida efetivamente realizada e pelo tênis realmente usado. Dados de sono são consultados no módulo responsável; eventual mudança da agenda permanece uma decisão explícita do corredor.

**Etapa 5 — Treinos estruturados:** blocos de aquecimento, intervalos, recuperações e desaquecimento, além de sugestões do treinador virtual e sincronização externa. Essa evolução requer regras e validações próprias; as categorias do MVP permanecem organizacionais.

## 8. Critérios de aceite

- Criar um treino, fechar o app e encontrá-lo novamente na mesma conta.
- Consultar a mesma agenda em outro dispositivo após autenticação.
- Alternar mês, semana e lista mantendo datas e filtros coerentes.
- Editar e reagendar sem duplicar registros; preservar a data original.
- Exibir corretamente treinos sem horário, virada de mês/ano e fuso diferente.
- Iniciar pelo calendário, pausar, retomar e preservar a seleção do treino.
- Só marcar conclusão por atividade depois de confirmar que a corrida foi salva.
- Repetir uma associação sem duplicar vínculo ou conceder XP adicional.
- Manter a corrida salva quando a ligação com a agenda falhar, permitindo nova tentativa.
- Impedir acesso, mudança ou associação envolvendo a conta de outra pessoa.
- Ao apagar uma corrida, atualizar o vínculo e o estado do treino correspondente.
- Identificar conclusão manual como autorrelato; manter quilômetros e gamificação vinculados às atividades reais.
- Apresentar comparação entre meta e resultado, inclusive abaixo/acima do planejado.
- Apagar os planejamentos ao excluir a conta, pelas relações do banco.
- Aprovar frontend, backend com PostgreSQL, migrações, regras existentes e build Android.

## 9. Preparação para main

Criar a branch `calendario-de-treinos` a partir da main vigente no momento da implementação. Se os PRs de tênis ou sono forem integrados durante o desenvolvimento, atualizar a branch e verificar a cadeia de migrações Alembic antes do PR final.

Aplicar a migração do calendário no backend antes de disponibilizar a interface. Documentar endpoints, estados, exclusões e testes. A expansão para sono e tênis deve ocorrer após suas dependências estarem disponíveis.

A primeira entrega está implementada na branch `calendario-de-treinos`. Consulte `CALENDARIO_TREINOS.md` para contratos, validação e limites da versão; as etapas seguintes permanecem no roteiro.

## 10. Referências

- [Repositório Runnex](https://github.com/CodeBreakers-Runnex/Runnex): base do plano e código atual de corridas, eventos, autenticação e navegação.
- [Controle de tênis — PR #1](https://github.com/CodeBreakers-Runnex/Runnex/pull/1).
- [Sono e recuperação — PR #2](https://github.com/CodeBreakers-Runnex/Runnex/pull/2).
- [PostgreSQL 16 — tipos de data e hora](https://www.postgresql.org/docs/16/datatype-datetime.html): armazenamento de instantes e necessidade de preservar o fuso original separadamente.
- [Capacitor — Local Notifications](https://capacitorjs.com/docs/apis/local-notifications): planejamento da etapa de lembretes e permissões Android.

