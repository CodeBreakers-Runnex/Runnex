# Guia de análise

Como interpretar os dados que `scripts/gather-git-data.sh` coletou, e como
decidir o que vai em cada seção do relatório. O objetivo não é processar dados
— é entender tecnicamente o que aconteceu, o que qualquer script não consegue
fazer sozinho.

## Fato, inferência e recomendação

Toda afirmação técnica do relatório se encaixa em um destes três tipos.
Misturar os três sem deixar claro qual é qual é o principal jeito de um
relatório automático perder a confiança de quem lê.

- **Confirmado** — algo que você viu diretamente no diff, no código ou na
  mensagem do commit. Ex.: "o arquivo `firestore.rules` ganhou uma nova função
  `validGroupWeeklyKmUpdate`" (você leu isso no diff).
- **Inferência** — uma conclusão técnica sua, baseada no que foi encontrado,
  mas que o histórico não afirma explicitamente. Ex.: "a função provavelmente
  existe para permitir que membros atualizem o km semanal do grupo" — isso é
  dedução a partir do nome e do uso, não uma frase do commit.
- **Recomendação** — uma sugestão sua para melhorar o projeto, não uma
  descrição do que já existe.

Quando o motivo de uma mudança não puder ser determinado com segurança (a
mensagem do commit é vaga tipo "fix", "ajustes", "wip", e o diff não deixa o
motivo óbvio), escreva literalmente:

> Motivo não identificado diretamente no histórico; inferência baseada nas
> alterações encontradas.

Nunca invente um motivo plausível só para preencher a frase "Por que foi
feito". Se a inferência for razoavelmente segura (ex.: um diff que troca
`updateDoc` por `runTransaction` em duas escritas relacionadas claramente
existe para evitar dessincronia), pode apresentá-la como inferência sem essa
ressalva — só use a frase padrão quando genuinamente não houver pista.

## Não analise commit por commit

Um commit isolado raramente é a unidade certa de análise. Antes de escrever
qualquer seção, agrupe:

1. Olhe a lista de commits e os arquivos que cada um tocou (`git show
   --stat <hash>` para os que parecerem relevantes).
2. Agrupe commits que tocam os mesmos arquivos, têm mensagens que parecem
   continuação umas das outras, ou claramente fazem parte do mesmo esforço
   (ex.: "add group weekly km", "fix group weekly km validation", "test group
   weekly km" viram uma entrega só: "Sistema de km semanal por grupo").
3. Um commit gigante misturando várias coisas não relacionadas (ex.: um
   commit de limpeza que mexeu em 50 arquivos de áreas diferentes) deve ser
   **decomposto** na análise — trate as partes dele como entregas/achados
   diferentes, mesmo vindo de um único commit. É exatamente o caso mais comum
   em projetos pequenos: um "chore: limpeza" que na real remove uma
   funcionalidade, atualiza regras de segurança e adiciona testes ao mesmo
   tempo — três coisas para o relatório, um commit só no Git.

Priorize investigar os arquivos listados em `TOP_CHANGED_FILES` do script —
são onde a maior parte da mudança real aconteceu. Arquivos com poucas linhas
alteradas (1-3) raramente merecem uma entrega própria; mencione-os agrupados
("ajustes pontuais em N arquivos de configuração") em vez de dar a cada um o
mesmo peso de uma mudança de 200 linhas.

## Como ler os diffs

`git diff --numstat` já veio no output do script. Para entender o *conteúdo*
de uma mudança específica, use:

```bash
git diff <oldest_parent> <newest_hash> -- caminho/do/arquivo
```

Ou, para ver o histórico completo de um arquivo dentro do período (útil
quando um arquivo foi tocado por vários commits e você quer ver a progressão):

```bash
git log --since="<start>" --until="<end> 23:59:59" -p -- caminho/do/arquivo
```

Leia o suficiente do diff para saber **o que o código faz agora que não fazia
antes** — não pare na primeira linha adicionada. Arquivos deletados
(`FILES_CHANGED` mostra `0` de inserção e N de deleção) geralmente indicam
remoção de funcionalidade — verifique se ela foi substituída por outra coisa
ou simplesmente removida (isso é informação relevante para "Principais
Entregas" ou "Pontos de Atenção", dependendo do caso).

## Categorizando o tipo de mudança

Use uma combinação de caminho do arquivo + conteúdo do diff, não só a
mensagem do commit (ela pode estar errada ou incompleta):

| Sinal | Sugere |
|---|---|
| `*.test.*`, `*.spec.*`, `__tests__/`, `test/` | Testes |
| `*rules*` (firestore.rules, storage.rules), `auth`, `permission`, `.env*` | Segurança |
| `migrations/`, `*.sql`, `schema.*`, arquivos de modelo/entidade | Backend/banco de dados |
| `*.css`, `tailwind.config.*`, `className=`, componentes visuais, `*.tsx`/`*.jsx` com só mudança de classes/estilo | UI/UX |
| Mudança que reduz linhas sem alterar comportamento externo (extrai função, renomeia, move arquivo) | Refatoração |
| Palavras no diff/commit: "fix", "bug", "corrig", "erro", "crash" | Correção de bug |
| Palavras: "feat", "add", "novo", "nova", "implementa" + arquivo novo ou rota/endpoint novo | Nova funcionalidade |
| `useMemo`, `useCallback`, índice de banco, `limit()`, lazy loading, debounce adicionados | Performance |
| `package.json` (dependencies/devDependencies), lockfile, `vite.config.*`, `tsconfig.*`, `.eslintrc*`/`eslint.config.*` | Dependências/configuração |

Uma mesma entrega pode tocar várias dessas categorias — reporte-a na seção
principal (Entregas/Bugs/Funcionalidades) e só mencione de novo em outra
seção (Segurança, Backend etc.) se houver algo específico daquela lente para
dizer, sem repetir a explicação inteira.

## Detectando a stack (para adaptar a análise, não só o relatório)

O script já lista marcadores encontrados em `STACK_DETECTED`. Use isso para
decidir onde procurar cada tipo de mudança — não tente aplicar heurísticas de
React a um projeto Go, por exemplo:

- **React/Vite/TypeScript**: olhe `src/components`, `src/pages` ou
  `src/app`, `src/hooks`, `src/services`/`src/lib` para separar UI de lógica de
  negócio; `tsconfig*.json` para tipagem.
- **Firebase**: `firestore.rules`/`storage.rules` = seção 8 (Segurança) e
  seção 6 (Backend); `firebase.json`/`.firebaserc` = seção 9.
- **Capacitor/mobile nativo**: `android/`, `ios/`, `capacitor.config.*` —
  mudanças aqui costumam ser de configuração de build/permissões, raramente
  "funcionalidade" pura; cheque `AndroidManifest.xml` para permissões novas
  (isso é seção 8, Segurança/permissões).
- **Node/Express ou similar backend**: `routes/`, `controllers/`,
  `middleware/`, arquivo de servidor principal — mapeiam para seção 6.
  `.env*`/variáveis de ambiente sempre vão para seção 8 se houve alteração.
- **SQL/Postgres**: pasta `migrations/` ou arquivos `.sql` = seção 6,
  sempre mencione se uma migração parece destrutiva (`DROP`, `DELETE`,
  `ALTER ... DROP COLUMN`) como possível risco.
- **CI/CD**: `.github/workflows/*.yml` ou equivalente = seção 9.

Se a stack detectada não bater com nada dessa lista, use o mesmo raciocínio
por analogia (onde fica a lógica de negócio, onde ficam as regras de acesso a
dados, onde fica a UI) em vez de pular a seção.

## "Funcionalidades incompletas" — como detectar sem adivinhar

Sinais reais no código, não suposição:
- Uma função/componente exportado mas nunca importado em nenhum outro
  arquivo (confira com `grep`/busca de texto antes de afirmar).
- Um botão/elemento de UI sem handler (`onClick`, `onPress` etc. ausente ou
  vazio).
- `TODO`, `FIXME`, `XXX`, `HACK` no diff desta semana.
- Dado hardcoded onde o resto do código busca de uma API/banco (ex.: uma
  lista estática de itens ao lado de outras listas que vêm do banco).
- Uma rota/tela nova sem nenhum teste e sem nenhum tratamento de erro,
  quando o padrão do resto do projeto tem os dois.

Reporte só o que você conseguiu confirmar olhando o código — para o resto,
é aceitável dizer "não foi possível confirmar sem executar o app" em vez de
adivinhar.

## Verificações de qualidade (build/lint/test)

Antes de rodar qualquer comando, olhe `PACKAGE_SCRIPTS` (ou o equivalente da
stack detectada) e rode só o que existir e for seguro/não-interativo:

- Prefira `typecheck`, `lint`, `build`, `test` (ou os nomes equivalentes do
  projeto) nessa ordem de preferência quando existirem como scripts prontos.
- Nunca rode algo que instale dependências (`npm install`, `pip install`
  etc.) — isso não é analisar, é modificar o ambiente.
- Nunca rode algo com efeito colateral (deploy, migração de banco, publicação).
- Se um comando travar ou demorar muito, cancele e reporte "não foi possível
  executar em tempo hábil" em vez de esperar indefinidamente.
- Reporte o resultado real: passou, falhou (com a mensagem de erro relevante,
  resumida — não cole um stack trace de 200 linhas), ou não foi possível
  verificar (e por quê).

## Preenchendo a "Evolução do Projeto" (seção 16)

As notas 0-5 são uma avaliação técnica sua, não uma métrica calculada. Baseie
a nota de "início da semana" no que você conseguir observar do estado do
código *antes* do primeiro commit do período (o commit `OLDEST_PARENT` do
script) e a de "final da semana" no estado atual (`HEAD`). Quando não for
possível avaliar uma dimensão com confiança (ex.: performance, sem conseguir
rodar o app), diga isso na coluna de observação em vez de inventar um número
preciso — pode usar um intervalo ("3-4") se a incerteza for genuína.
