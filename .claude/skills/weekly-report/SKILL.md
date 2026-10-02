---
name: weekly-report
description: Generates a complete weekly development report for the current Git repository — analyzes commits, diffs, and changed files from the last 7 days (or since the last report), interprets what was actually built/fixed/refactored (not just commit messages), runs safe build/lint/test checks, compares against previous weekly reports in docs/reports/, and saves a structured Markdown report. Use this whenever the user asks "o que foi feito essa semana", "gera o relatório semanal", "resumo do desenvolvimento", "weekly report", "status update do projeto", wants to catch up on recent progress, needs a summary to present to a team/stakeholder, or invokes /weekly-report directly. Read-only against the project — never modifies source files, never commits, never pushes.
---

# Relatório Semanal de Desenvolvimento

Gera um relatório técnico do que aconteceu no repositório na última semana —
não um resumo das mensagens de commit, e sim uma leitura real dos diffs para
explicar o que mudou, por que provavelmente mudou, e qual o estado atual do
projeto. É uma skill **somente leitura**: nunca edita arquivos do projeto,
nunca commita, nunca faz push, nunca instala dependências. O único arquivo
que ela cria é o próprio relatório em `docs/reports/`.

## Por que existe um script bundled

Coletar os dados do Git de forma consistente (período certo, diff certo,
detecção de stack, scripts de build disponíveis) é um trabalho mecânico e
repetitivo — exatamente o tipo de coisa que deve ser feita por um script, não
reinventada a cada execução. `scripts/gather-git-data.sh` faz essa coleta uma
vez, de forma determinística, e devolve tudo already-organizado. A
interpretação técnica dos dados (o que realmente é essa auditoria) continua
sendo trabalho seu, não do script.

## Passo a passo de execução

### 1. Coletar os dados

Rode o script bundled a partir de qualquer diretório dentro do repositório
(ele mesmo localiza a raiz):

```bash
bash "<caminho-desta-skill>/scripts/gather-git-data.sh"
```

Sem argumentos, ele calcula o período automaticamente: continua do dia
seguinte ao último relatório em `docs/reports/` se houver um recente (até 14
dias atrás), senão usa os últimos 7 dias. Para forçar um período específico
(ex.: o usuário pede "relatório de 1 a 8 de agosto"):

```bash
bash "<caminho-desta-skill>/scripts/gather-git-data.sh" 2026-08-01 2026-08-08
```

O output traz, em seções rotuladas: informação do repo/branch, o período
resolvido (e por que esse período foi escolhido), se já existe um relatório
para a data final, a lista de relatórios anteriores, a stack detectada, os
scripts de build/lint/test disponíveis, a lista de commits, o diffstat de
todo o período, a lista completa de arquivos alterados com inserções/deleções,
e os 15 arquivos com maior volume de mudança.

Se `### COMMITS` vier vazio, não invente atividade — gere o relatório
mesmo assim, deixando claro nas seções relevantes que não houve commits nesse
período (isso por si só é uma informação útil: pode indicar uma semana de
planejamento, férias, ou trabalho fora do controle de versão).

### 2. Ler e interpretar as mudanças

Não pare no `git log`. Para os arquivos listados em `TOP_CHANGED_FILES` (e
qualquer outro que pareça relevante), leia o diff de verdade:

```bash
git diff <oldest_parent> <newest_hash> -- caminho/do/arquivo
```

(os hashes `oldest_parent`/`newest_hash` vêm impressos na seção
`DIFF_RANGE_FOR_MANUAL_INSPECTION` do output do script).

Siga **`references/analysis-guidelines.md`** para: como separar fato de
inferência, como agrupar commits relacionados numa única entrega em vez de
tratar cada commit isoladamente, como categorizar o tipo de mudança
(feature/bug/refactor/segurança/UI/performance/config), como adaptar a
análise à stack detectada, e como identificar funcionalidades incompletas sem
adivinhar. Leia esse arquivo antes de escrever o relatório — ele existe
justamente para as partes que exigem julgamento técnico, não coleta de dados.

### 3. Rodar verificações de qualidade (com segurança)

Olhe `PACKAGE_SCRIPTS` (ou equivalente da stack) no output do script e rode
os comandos de verificação que existirem — tipicamente `typecheck`, `lint`,
`build`, `test`. Regras:

- Só rode comandos **não-destrutivos e não-interativos** (nunca `npm
  install`, nunca migração de banco, nunca deploy, nunca algo que peça
  confirmação).
- Se um script combinar verificação com instalação/deploy, não rode — reporte
  que não foi possível verificar automaticamente.
- Capture o resultado real (passou/falhou/erro específico) para a seção
  "Testes e Qualidade" do relatório. Nunca afirme que um build passa sem tê-lo
  rodado.
- Se algo travar, cancele e siga em frente — a skill não deve ficar presa
  esperando um comando que não retorna.

### 4. Comparar com relatórios anteriores

Se `### PREVIOUS_REPORTS` não estiver vazio, leia pelo menos o mais recente
(e o penúltimo, se existir) com a ferramenta de leitura de arquivos. Procure
por: itens de "Pontos de Atenção" ou "Recomendações" que ainda não foram
resolvidos (cheque se os arquivos/problemas citados lá continuam com o mesmo
problema no código atual), tarefas de "Próximos Passos" que viraram entregas
desta semana ou que ainda não começaram, e padrões que se repetem (o mesmo
tipo de problema aparecendo relatório após relatório). Isso vira a seção
"Comparação com semanas anteriores" no final do relatório — omita essa seção
inteiramente se não houver relatório anterior.

### 5. Escrever o relatório

Siga a estrutura exata de **`references/report-template.md`** — os 17
títulos de seção, nessa ordem, sempre. Onde uma seção não tiver conteúdo,
use a frase de "nada encontrado" indicada no template em vez de omitir a
seção ou inventar conteúdo.

### 6. Salvar o arquivo

Caminho: `docs/reports/weekly-report-<data-final>.md`, onde `<data-final>` é
a data de término do período no formato `YYYY-MM-DD` (o script já informa o
caminho exato e se é criação ou atualização em
`### EXISTING_REPORT_FOR_THIS_END_DATE`). Se o arquivo já existir para essa
data, **atualize-o** (sobrescreva com a versão nova) em vez de criar um
duplicado com outro nome. Crie `docs/reports/` se ainda não existir.

### 7. Resumo no terminal

Depois de salvar o relatório, imprima um resumo neste formato exato (ajuste
os números aos dados reais — não são um exemplo a copiar literalmente):

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 RELATÓRIO SEMANAL GERADO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 Período: DD/MM/AAAA → DD/MM/AAAA
📝 Commits analisados: N
📁 Arquivos modificados: N

🚀 Novas funcionalidades: N
🐛 Bugs corrigidos: N
🔧 Refatorações: N
🎨 Melhorias de UI: N

⚠️ Pontos de atenção: N
🔴 Problemas críticos: N
🟡 Problemas importantes: N

📄 Relatório:
docs/reports/weekly-report-AAAA-MM-DD.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Os números desse resumo devem bater com o que está no corpo do relatório —
não recalcule diferente, apenas contabilize o que você já escreveu nas
seções 2-5 e 12.

## Regras que sempre valem

- **Nunca invente.** Se não há evidência no Git/código para uma afirmação,
  não a faça. É melhor uma seção curta e honesta ("nenhuma alteração
  relevante") do que uma seção longa e especulativa.
- **Separe Confirmado / Inferência / Recomendação** sempre que a distinção
  importar — ver `references/analysis-guidelines.md`.
- **Não trate cada commit como uma entrega.** Agrupe o que faz parte do
  mesmo esforço.
- **Não modifique o projeto.** Esta skill não edita código, não cria
  commits, não altera configuração, não faz push. A única escrita permitida é
  o próprio arquivo de relatório em `docs/reports/`.
- **Não corrija problemas que encontrar.** Se um build falhar ou um teste
  quebrar durante a verificação de qualidade, reporte — não tente consertar
  para "fazer o relatório ficar bonito".
- **Genérica por padrão.** Esta skill não assume uma stack específica —
  ela se adapta ao que `STACK_DETECTED` encontrar. Ao rodar em um projeto
  diferente, confie no que o script reportar em vez de assumir que é
  React/Firebase só porque foi assim da primeira vez.

## Arquivos desta skill

- `scripts/gather-git-data.sh` — coleta determinística de dados do Git e do
  projeto (rode primeiro, sempre).
- `references/analysis-guidelines.md` — como interpretar os dados
  coletados (leia antes de escrever o relatório).
- `references/report-template.md` — estrutura exata de saída (siga ao
  escrever o relatório).
