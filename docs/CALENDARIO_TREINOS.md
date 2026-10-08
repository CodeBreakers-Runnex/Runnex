# Calendário de treinos

Primeira entrega do [plano de ação](PLANO_CALENDARIO_TREINOS.md), na branch `calendario-de-treinos`, baseada na main beta 2.0. Acesse `/calendario-treinos` pelo perfil, menu lateral ou cartão da tela inicial.

## Funcionalidade

- Mês, semana iniciando na segunda-feira e lista do mês.
- Cadastro, edição, cópia para outra data, reagendamento, cancelamento e exclusão.
- Categorias organizacionais: leve, intervalado, longo, ritmo, caminhada, outro e descanso.
- Horário opcional, fuso IANA, objetivos opcionais de km/minutos e observações privadas.
- Conclusão manual identificada como autorrelato, não realizado e reabertura.
- Iniciar corrida pelo treino, recuperar a seleção ao retomar uma corrida e vincular a atividade salva.
- Vinculação manual pelas até 100 corridas mais recentes e comparação entre objetivos e valores reais.
- Resumo semanal e próximo treino na página inicial.

Planejamento, descanso e autorrelatos não alteram atividades, distância acumulada, XP, RunCoin, pet, ranking ou conquistas. Esses efeitos continuam no fluxo existente de registro de corridas. Objetivos não precisam ser atingidos para uma conclusão; a comparação mostra a diferença.

## Persistência e datas

A migração `c3a6f14d8209`, após `d48faef56a35`, cria `planned_workouts`. FK de usuário com `ON DELETE CASCADE`; índice de UID/data; FK opcional e única para uma atividade. Aplicar `alembic upgrade head` no backend antes de disponibilizar a tela.

Data local, horário e fuso são preservados. Quando há horário, também é gravado um instante UTC. Sem horário, a agenda é do dia inteiro, sem meia-noite UTC artificial. Horários inexistentes ou ambíguos em mudanças de horário de verão são recusados para o usuário escolher outro horário. A tela exibe o fuso do compromisso e, quando diferente, a conversão para o fuso do aparelho.

Datas de planejamento entre 2000 e 2100; metas de 0 a 500 km (zero recusado) e de 1 a 1.440 minutos, opcionais; descanso exige metas ausentes. Não gera prescrição a partir da categoria.

`original_date` registra a data inicial. Edição conserva esse campo. Concluídos precisam ser reabertos antes de editar objetivos. Uma data passada calcula `overdue`; o status só muda por ação do usuário.

## API privada

Todas as rotas exigem Firebase Auth e e-mail confirmado. Proprietário vem do token, não do corpo. Campos desconhecidos são recusados; o modelo não é incluído nas respostas públicas de usuário ou feed.

| Método | Rota | Uso |
| --- | --- | --- |
| GET | `/training/workouts?from=YYYY-MM-DD&to=YYYY-MM-DD` | Agenda própria, intervalo de até 93 dias, `limit` até 100 e `offset` até 10.000. Retorna `items`, `total`, `nextOffset`. |
| GET | `/training/workouts/{id}` | Detalhe privado com evidência da atividade vinculada. |
| POST | `/training/workouts` | Criar treino/descanso. |
| PATCH | `/training/workouts/{id}` | Formulário completo e `revision` atual para edição/reagendamento. |
| DELETE | `/training/workouts/{id}?revision=N` | Excluir o planejamento, preservando a corrida. |
| PUT | `/training/workouts/{id}/status` | `status` e `revision`: planned, completed, skipped, cancelled. |
| PUT | `/training/workouts/{id}/activity` | `activityId` e `revision`: vincular corrida da própria conta. |
| DELETE | `/training/workouts/{id}/activity?revision=N` | Remover vínculo/reabrir. |
| GET | `/training/summary?week=YYYY-MM-DD&zone=America/Sao_Paulo` | Semana com início na segunda; contagens e volume. |
| GET | `/training/next` | Próximo compromisso planejado elegível ou null. |

Revisão divergente retorna 409. Alterações bloqueiam a linha do planejamento. Associação e exclusão de atividades bloqueiam primeiro a atividade, depois os planejamentos, mantendo a mesma ordem de locks. Repetir o vínculo com a mesma atividade retorna o resultado atual mesmo após avanço de revisão. A mesma corrida não pode completar dois treinos; uma atividade de outra conta é recusada.

Excluir uma corrida, individualmente ou em lote, reabre o planejamento, remove evidência e incrementa a revisão na mesma transação. A tela identifica que a corrida vinculada foi apagada. Excluir só o planejamento mantém a atividade real e seus efeitos.

## Integração com a corrida

A seleção do treino guarda apenas UID e ID localmente. O servidor revalida proprietário/status; snapshot da corrida inclui UID e ID do planejamento. Recuperação não atribui uma corrida em aberto a um treino novo escolhido depois. Rascunhos locais antigos sem UID não são retomados automaticamente, pois seu proprietário não pode ser confirmado.

A corrida é salva pelo fluxo original de `/activities`. Depois do ID confirmado, ocorre o vínculo com `/training/workouts/{id}/activity`. A corrida fica preservada se a ligação falhar; um aviso direciona à agenda para vincular manualmente. Troca de conta bloqueia a associação. Planejamento não é incluído no payload público da atividade.

O resumo separa previstos/concluídos, autorrelatos, descanso e volume real. Descanso e cancelados ficam fora da taxa de cumprimento. Essa taxa só aparece em semanas encerradas; semana vazia fica sem dados. Cada corrida entra uma vez no volume da semana, usando seu `created_at` no fuso indicado. Esse campo é data de salvamento, não um registro específico de início. Comparação individual usa os valores da corrida vinculada, inclusive quando concluída em outro dia.

## Validação e integração

- Frontend: `npm run lint`, `npm run test`, `npm run build`.
- Backend: `alembic upgrade head`, `alembic check` e `pytest` com PostgreSQL de teste. Novos testes cobrem privacidade, revisão, UTC/fusos/DST, autorrelato, vinculação única/idempotente, exclusões, resumo, paginação e cascade.
- Testes do fluxo de corrida verificam recuperação da seleção, salvar antes de vincular, falha de vínculo e falha ao salvar preservando o rascunho.
- Workflow Android: JDK 21, SDK 36, build web, Capacitor sync e `:app:assembleDebug`. Esta entrega não adiciona permissões nativas nem altera o minSdk da main.

Teste em aparelho antes da distribuição pública: navegar mês/semana/lista, editar e reagendar, iniciar/pausar/retomar uma corrida planejada, encerrar o app e recuperar, simular falha de rede na associação, trocar de conta, excluir atividade individualmente/em lote e comparar fusos em viagem.

As branches de tênis e sono partem da mesma migração base. Se outro PR com migração entrar primeiro, atualizar a branch e unir os heads do Alembic antes de integrar. A agenda funciona sem depender desses módulos.

Repetição semanal, lembretes, ICS/eventos e integrações com sono/tênis são as próximas etapas do plano. A política de privacidade geral segue na entrega informada pela equipe; o calendário não modifica seu texto.

## Revisão dos fluxos

Finalizar pausa o GPS/cronômetro e bloqueia a retomada durante o salvamento. A resposta de uma gravação anterior não interrompe uma corrida retomada por outra conta, e a seleção do treino é capturada antes do envio. Falhas mantêm o rascunho pausado. Troca de conta encerra o bloqueio da agenda anterior; a conclusão de uma operação antiga não altera a interface nem o bloqueio de uma nova operação. O cartão do próximo treino recupera o estado normal após uma consulta bem-sucedida.
