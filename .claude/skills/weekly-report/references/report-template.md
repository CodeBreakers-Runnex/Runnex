# Template do relatório semanal

Use esta estrutura exata, na ordem exata, com estes 17 títulos de seção. Se uma
seção não tiver conteúdo real para reportar, mantenha o título e escreva a frase
de "nada encontrado" indicada — nunca omita a seção nem invente conteúdo para
preenchê-la.

Escreva em português, tom técnico mas legível. Não repita a mesma informação em
seções diferentes só para parecer mais completo — se um bug e uma entrega são a
mesma coisa, mencione uma vez e referencie a outra seção brevemente.

```markdown
# Relatório Semanal de Desenvolvimento

**Projeto:** [nome do projeto]
**Período:** [data inicial] → [data final]
**Branch:** [branch]
**Commits analisados:** [quantidade]

## 1. Resumo Executivo

[5 a 10 linhas: principal evolução da semana, funcionalidades mais importantes,
principais problemas resolvidos, mudanças arquiteturais relevantes, estado
geral do projeto.]

## 2. Principais Entregas

### [Nome da entrega]

**O que foi feito:** [explicação técnica da alteração]

**Por que foi feito:** [problema ou necessidade — marque como Confirmado ou
Inferência conforme a origem, e use a frase padrão de motivo não identificado
quando aplicável]

**Impacto:** [impacto para o usuário e/ou sistema]

**Arquivos principais:** [lista dos arquivos mais relevantes, com contagem de
linhas se ajudar a dar noção de tamanho]

**Status:** Concluído | Parcialmente concluído | Em andamento | Necessita revisão

[Repita este bloco para cada entrega. Agrupe commits relacionados na mesma
entrega — não trate cada commit isolado como uma entrega própria.]

## 3. Bugs Corrigidos

### [Descrição curta do bug]

- **Problema:** ...
- **Causa provável:** ...
- **Solução aplicada:** ...
- **Arquivos envolvidos:** ...
- **Impacto da correção:** ...
- **Possíveis riscos de regressão:** ...

[Se nenhum bug foi claramente identificado no período, escreva:
"Nenhum bug corrigido foi identificado com clareza nos commits e diffs deste
período."]

## 4. Novas Funcionalidades

### [Nome da funcionalidade]

- **Objetivo:** ...
- **Funcionamento:** ...
- **Principais componentes envolvidos:** ...
- **Integração com backend/API/banco:** [quando aplicável; senão omita a linha]
- **Estado atual:** ...
- **O que ainda falta:** ...

[Se nenhuma funcionalidade nova foi adicionada, escreva:
"Nenhuma funcionalidade nova foi identificada neste período — as alterações
foram de manutenção/correção/refatoração."]

## 5. Refatorações e Melhorias Técnicas

[Liste alterações que não adicionaram funcionalidade diretamente, mas
melhoraram o projeto — organização, separação de responsabilidades,
componentes reutilizáveis, tipagem, redução de duplicação, arquitetura,
tratamento de erros, estado, serviços, performance. Para cada uma, explique o
benefício real, não apenas descreva a mudança.]

## 6. Banco de Dados e Backend

[Se houver alterações: novas coleções/tabelas, campos adicionados/removidos,
queries, regras de segurança, APIs, endpoints, autenticação, autorização,
validações, mudanças de estrutura, migrações.

Se não houver, escreva exatamente:
"Nenhuma alteração relevante de backend ou banco de dados foi identificada
nesta semana."]

## 7. Frontend e UI/UX

[Novas páginas, novos componentes, layout, responsividade, animações,
navegação, formulários, feedback visual, acessibilidade, estados de
loading/erro, melhorias de experiência. Explique o impacto de cada uma.

Se não houver alterações de frontend, escreva:
"Nenhuma alteração de frontend/UI foi identificada nesta semana."]

## 8. Segurança

[Autenticação, autorização, regras do Firestore/banco, variáveis de ambiente,
exposição de chaves, validação de dados, permissões, armazenamento de
informação sensível, CORS, APIs, dependências vulneráveis.

Classifique cada achado real com um destes marcadores — nunca invente um
achado só para preencher a seção:
🔴 Crítico · 🟠 Alto · 🟡 Médio · 🟢 Baixo

Se nada foi encontrado, escreva:
⚪ Nenhum problema de segurança identificado nesta semana.

Se houver apenas uma possibilidade não confirmada, deixe explícito que é
recomendação de revisão, não um achado confirmado.]

## 9. Dependências e Configurações

[package.json/lockfile, Vite, TypeScript, ESLint, Firebase, Capacitor,
variáveis de ambiente, CI/CD, build, outras ferramentas relevantes ao stack
detectado. Explique alterações importantes e possíveis impactos.

Se não houve mudança de dependências/config, escreva:
"Nenhuma alteração de dependências ou configuração foi identificada nesta
semana."]

## 10. Testes e Qualidade

[Testes adicionados/modificados/removidos, cobertura (se identificável),
resultado de build/lint/typecheck/testes executados nesta análise (ver seção
"Verificações de qualidade" do SKILL.md), funcionalidades aparentemente sem
teste.

Reporte o resultado real dos comandos executados (passou/falhou, com o erro
relevante resumido) — nunca afirme que passou sem ter rodado.]

## 11. Git e Histórico

[Quantidade de commits, principais commits (agrupados logicamente, não um por
um), arquivos mais modificados, áreas do projeto que mais mudaram, commits
muito grandes, commits que parecem parte do mesmo problema/entrega.]

## 12. Problemas Encontrados

[Problemas que ainda existem no projeto, identificados durante esta análise —
não necessariamente introduzidos nesta semana. Para cada um:
- descrição
- evidência encontrada (arquivo:linha ou comportamento observado)
- impacto
- recomendação

Classifique: 🔴 Crítico · 🟠 Importante · 🟡 Moderado · 🟢 Baixa prioridade]

## 13. Pontos de Atenção

[Funcionalidades incompletas, código duplicado, uso excessivo de `any` (ou
equivalente na stack), falta de testes, possíveis problemas de segurança,
componentes muito grandes, problemas de arquitetura, código temporário, TODOs
encontrados, dependências desatualizadas, possíveis problemas de performance.]

## 14. Recomendações

🔴 **Prioridade alta** — [problemas que devem ser tratados primeiro]

🟡 **Prioridade média** — [melhorias importantes, não urgentes]

🟢 **Prioridade baixa** — [melhorias futuras]

[Baseie exclusivamente no que foi encontrado nesta análise — não copie
recomendações genéricas.]

## 15. Próximos Passos

1. **[Tarefa]**
   - Motivo: ...
   - Impacto esperado: ...
2. **[Tarefa]**
   - Motivo: ...
   - Impacto esperado: ...
3. **[Tarefa]**
   - Motivo: ...
   - Impacto esperado: ...

[Priorize tarefas que desbloqueiam outras — se uma tarefa depende de outra,
diga isso.]

## 16. Evolução do Projeto

[Compare o estado no início vs. no final do período. Escala 0–5 (0 =
inexistente, 1 = muito ruim, 2 = ruim, 3 = razoável, 4 = bom, 5 = muito bom).
Deixe claro que é uma avaliação técnica aproximada, não uma métrica objetiva.]

| Dimensão | Início da semana | Final da semana | Observação |
|---|---|---|---|
| Funcionalidades | X | Y | ... |
| Estabilidade | X | Y | ... |
| Arquitetura | X | Y | ... |
| Segurança | X | Y | ... |
| Qualidade do código | X | Y | ... |
| UX/UI | X | Y | ... |
| Testes | X | Y | ... |
| Performance | X | Y | ... |

## 17. Resumo para Apresentação

**Esta semana**
- ✅ [principal entrega]
- ✅ [principal correção]
- 🔧 [principal melhoria técnica]
- 🎨 [principal melhoria visual]
- 🛡️ [principal melhoria de segurança]

**Próxima semana**
- 🎯 [objetivo 1]
- 🎯 [objetivo 2]
- 🎯 [objetivo 3]

---

## Comparação com semanas anteriores

[Só inclua esta seção final se existir ao menos um relatório anterior em
docs/reports/. Explique brevemente a evolução: o que melhorou, problemas
recorrentes, tarefas que continuam pendentes de relatórios passados, melhorias
que regrediram, padrões de desenvolvimento, funcionalidades que estão
demorando muitas semanas para fechar.

Se não houver relatório anterior, omita esta seção inteira (não a inclua
vazia).]
```
