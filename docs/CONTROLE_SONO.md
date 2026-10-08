# Controle de sono e recuperação

Entrega na branch `controle-de-sono`, baseada na `main` Runnex beta 2.0. Acesse pelo botão **Sono e recuperação** do perfil ou pela navegação lateral; rota `/sono`.

## Funcionalidade

- Registro, edição e exclusão de sono manual e cochilos.
- Duração informada opcional: sem ela, a tela identifica apenas o período registrado e não presume tempo efetivamente dormido.
- Check-in diário de qualidade percebida e cansaço, cada resposta opcional, em escala de 1 a 5.
- Meta pessoal, sem recomendação universal predefinida.
- Resumo com motivos, histórico de 7–30 dias, lacunas explícitas e tendência após 7 dias válidos nos últimos 14.
- Volume de corridas dos últimos 7 dias e período anterior; nenhum efeito sobre XP, pet ou conquistas.
- Leitura opcional de sono pelo Health Connect, sincronização manual e ao abrir o módulo, tratamento de revogação de permissão ao retornar ao app.
- Exportação JSON na web e pelo seletor nativo de arquivos no Android; desconexão e exclusão total com retirada do consentimento.

Frequência cardíaca de repouso, HRV, diagnóstico e uma nota percentual de recuperação permanecem fora desta versão. O resumo explica dados disponíveis e não certifica aptidão para treinar.

## Integração Android

Plugin local `SleepHealthConnect`, registrado em `MainActivity`, usando Health Connect **1.1.0 estável**, Kotlin 2.2.0 e coroutines. A SDK estável exige **API 26/Android 8**; o serviço Health Connect é utilizado apenas a partir de **API 28/Android 9**. O mínimo do novo APK passou de 24 para 26. O registro manual continua disponível no Android 8 e na web; este novo APK não é instalável no Android 7.

Solicita exclusivamente `android.permission.health.READ_SLEEP`. Não escreve no Health Connect, não coleta sensores continuamente e não solicita FC/HRV, localização adicional, histórico ampliado ou leitura de saúde em segundo plano. A fonte do relógio precisa publicar `SleepSessionRecord` no Health Connect; compatibilidade por fabricante requer teste real. Não há garantia universal para Wear OS/Galaxy Watch/Garmin nem uma implementação Apple Watch.

Quando os estágios cobrem integralmente a sessão, a estimativa soma os estágios reconhecidos como sono e desconta os acordados. Lacunas, desconhecidos e sobreposições produzem duração indisponível; não são convertidos em sono. Não são enviados estágios individuais ao servidor.

O primeiro sync lê uma janela de 30 dias com paginação, captura o token de mudanças antes da leitura e depois consome alterações pendentes. Tokens expirados geram novo snapshot completo e reconciliação somente dentro da janela lida. O código considera token de página vazio como fim da paginação. Lotes com mais de 1.000 registros são interrompidos sem confirmação parcial.

Tokens ficam separados por UID e geração de conexão. Cada token só é persistido após sucesso da API; replay é idempotente. A geração muda ao desconectar/apagar, invalidando lotes em trânsito. Troca de usuário interrompe envio e confirmação do lote. Tokens são excluídos dos backups/transferências Android; dados de saúde não são persistidos no navegador.

A atividade de justificativa de permissões abre a mesma página `/termos-e-privacidade` usada pelo app, inclusive nos intents específicos de Android 14+.

## Banco e API

Migração `b72d8e9104c6` após `d48faef56a35`: tabelas `recovery_preferences`, `sleep_sessions`, `sleep_checkins` e `sleep_import_exclusions`, todas ligadas ao UID com `ON DELETE CASCADE`. Não adiciona saúde ao modelo público de usuário ou atividade.

Execute `alembic upgrade head` antes de publicar o frontend. `alembic check` deve continuar sem alterações pendentes. Se outra PR com migração entrar antes, atualize esta branch e resolva os heads do Alembic antes do merge; ambas as entregas partem da mesma migração base.

Todas as rotas exigem Firebase Auth e e-mail confirmado; proprietário vem do token. Não aceitam `userId` no corpo. Datas de sessão exigem offset explícito, ordem válida, no máximo 36 horas e sono já concluído nos últimos 90 dias. Preservam offset do despertar e atribuem a sessão ao dia correspondente. Rotas de alteração usam lock das preferências para serializar exclusão/retirada de consentimento com importações.

| Método | Rota | Uso |
| --- | --- | --- |
| GET | `/recovery/overview?days=7` | Preferências, resumo diário, histórico, sessões, fontes, tendência e corridas; de 7 a 30 dias. |
| POST | `/recovery/consent` | Aceite específico versionado e fuso IANA. |
| PUT | `/recovery/preferences` | Meta em minutos, fuso e origem preferencial. |
| POST | `/recovery/sleep` | Criar registro manual. |
| PUT / DELETE | `/recovery/sleep/{id}` | Editar manual / apagar registro próprio. |
| PUT / DELETE | `/recovery/check-in/{YYYY-MM-DD}` | Salvar / remover check-in próprio. |
| PUT | `/recovery/connection` | Habilitar ou interromper novas importações. |
| POST | `/recovery/import` | Lote autenticado com geração, registros, IDs apagados e janela de snapshot opcional. |
| GET | `/recovery/export` | Exportação dos registros privados da conta ativa. |
| DELETE | `/recovery/data` | Apagar sono/check-ins, retirar consentimento e invalidar sincronização. |

No resumo, registros manuais de sono principal têm prioridade sobre importados. Depois, aplica-se a fonte preferencial; na seleção automática usa-se a maior sessão e, em empate, a mais recente. Uma única sessão principal por dia evita soma duplicada entre fontes. Cochilos manuais ficam identificados separadamente e não são somados à duração principal. Fragmentos de sono importados não são reunidos por heurística nesta versão.

Importações usam unicidade `(user_id, origin, external_id)` e `source_modified_at`: uma alteração antiga não sobrescreve a mais recente. Exclusões externas só atingem importados da mesma conta. Exclusão de importado no Runnex cria uma exclusão persistida que evita sua volta em um replay. Apagar tudo também interrompe importações; uma reconexão explícita pode importar novamente a janela autorizada.

## Privacidade e publicação

A atualização da política geral está em andamento em outra entrega, conforme informado pela equipe. Este módulo não reescreve `legalContent.ts`; possui aceite específico `sleep-v1-2026-10-08`, com texto da finalidade e controles reais. Alinhar a política em atualização, inclusive retenção e usuários de 16–17 anos, e as declarações de saúde/segurança de dados no Google Play antes de ativar a versão pública.

Os registros ficam privados independentemente de `private_profile`. Nenhum dado de sono é enviado ao chatbot, feed, ranking, Firestore ou telemetria. Desconectar mantém histórico existente; apagar dados retira o consentimento e exclui sono/check-ins. Dados nas aplicações de origem permanecem sob controle delas. Exportação só ocorre por ação do usuário.

O expurgo é executado ao consultar o módulo/exportar/sincronizar. Configure também uma execução diária de `python -m app.purge_sleep` no ambiente do backend para remover registros de contas inativas. São removidas sessões e exclusões com mais de 90 dias; check-ins usam margem de um dia para fusos. Sem esse agendamento, a remoção de contas inativas ocorre apenas na próxima operação do módulo.

## Verificação

Frontend: `npm run lint`, `npm run test`, `npm run build`.

Backend: `alembic upgrade head`, `alembic check`, `pytest` com PostgreSQL de teste, incluindo `tests/test_sleep.py`. Cobertura: CRUD, privacidade entre contas, aceite/e-mail, datas e offsets, ausência versus zero, atualização/idempotência, exclusões, múltiplas fontes, geração invalidada, cascade da conta e retenção.

Android: `npm run android:sync`, depois `bash gradlew :app:testDebugUnitTest :app:assembleDebug` na pasta `android`, com JDK 21 e SDK 36. O workflow `Android` realiza build e testes de duração junto à CI existente.

Checklist em aparelho real antes da publicação: Android 9–13 e 14+, conectar/recusar/revogar `READ_SLEEP`, importar uma noite e um cochilo de cada fonte anunciada, apagar/alterar origem, repetir sync após falha de rede, alternar contas, testar snapshot após reinstalação/token expirado e salvar exportação pelo seletor de arquivos. Build e testes automatizados não substituem essa validação com relógios reais.

## Fontes técnicas

- [Health Connect — versões e release estável](https://developer.android.com/jetpack/androidx/releases/health-connect).
- [Health Connect — configuração e permissões](https://developer.android.com/health-and-fitness/health-connect/get-started).
- [Sessões de sono](https://developer.android.com/health-and-fitness/health-connect/features/sleep-sessions).
- [Leitura e paginação](https://developer.android.com/health-and-fitness/health-connect/read-data).
- [Sincronização e eventos de exclusão](https://developer.android.com/health-and-fitness/health-connect/sync-data).
- [Capacitor — plugins Android e callbacks](https://capacitorjs.com/docs/plugins/android).
