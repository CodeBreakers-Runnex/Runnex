# Performance do Runnex

As três branches compartilham uma migração e a API de performance, mas habilitam interfaces independentes:

- `fix/calculo-recordes`: melhores trechos contínuos de 1, 5, 10, 21,0975 e 42,195 km.
- `feature/zonas-cardiacas`: sensor BLE, FC média/máxima e Z1–Z5.
- `feature/evolucao-corredor`: oito semanas/meses, volume e pace ponderado.

Aplicar `alembic upgrade head` antes do novo frontend. A migração `a81f2c4d903e` preserva atividades antigas; os novos campos são opcionais. Todas as branches usam a mesma revisão, evitando múltiplas migrations concorrentes.

`POST /activities` aceita `performanceSamples`, `heartRateSamples`, `heartRateMaxBpm` e `isSimulated`. Cada amostra possui tempo ativo e `segmentId` opcional. Pausas, recuperação e reconexões separam segmentos. Distância pode permanecer igual durante paradas, mas não pode regredir. Tempos são crescentes, finitos e limitados à duração da corrida.

`GET /activities/performance/me?utc_offset_minutes=-180` usa somente o usuário autenticado. Dados brutos não são expostos no feed. Apagar atividades recalcula os resultados na próxima consulta. Simulações novas são excluídas dos três resumos; atividades antigas sem essa marca não podem ser reclassificadas automaticamente.

A recuperação em andamento exige correspondência com o usuário que iniciou o treino. Snapshots antigos sem identificação não são recuperados nesta versão.

Recordes são estimativas por interpolação de distância/tempo, nunca projeções do pace médio. Históricos sem amostras continuam na evolução, mas não geram recordes de trecho. O limite de 5000 pontos implica redução da série e perda de resolução.

Zonas usam a referência escolhida pelo corredor: Z1 50–<60%, Z2 60–<70%, Z3 70–<80%, Z4 80–<90%, Z5 >=90%. Tempo abaixo de Z1 é separado. Intervalos sem sensor, com quebra de segmento ou maiores que 10s não entram na média/zonas. Uma única leitura fornece máximo, mas não média temporal.

Limitações a validar em aparelho: relógio JavaScript legado, GPS e entrega BLE com tela apagada. O Bluetooth requer sensor compatível e um novo APK após `npx cap sync android`. Testes com mocks não substituem hardware. A API lê o histórico do usuário; históricos muito grandes podem exigir agregação/cache.

Validação: `npm run lint`, `npm test`, `npm run build`; no backend, `DATABASE_URL` deve apontar para PostgreSQL isolado com nome contendo `test`, seguido de `alembic upgrade head`, `alembic check` e `pytest`. O CI executa esses fluxos em PostgreSQL 16 e Node 22.
