# Conteúdo dos slides da banca

Roteiro de 9 slides, pensado para sobrar tempo para a **demonstração**, que é o centro da apresentação (ver `docs/APRESENTACAO_BANCA.md`). Cada slide tem pouco texto, e o que falar vai nas notas.

**Preencher antes:** nome do grupo, orientador, curso e data. Não preenchi nada disso porque não tenho essas informações.
**Conferir antes de falar:** os números de testes mudam a cada rodada. Rode `npx vitest run` e o `pytest` do backend e use o que sair.

---

## 1. Capa
- **Runnex**: aplicativo de corrida com gamificação e comunidade
- Nome do grupo, integrantes, orientador, curso, data

## 2. O problema
- Corredor amador perde a constância e não tem comunidade
- Apps de corrida costumam ser só cronômetro, ou complexos demais
- **Notas:** abra com a pessoa, não com a tecnologia. Uma frase sobre quem é o usuário.

## 3. A solução
- Registra a corrida por GPS e guarda o histórico
- Gamificação: XP, nível, pet e RunCoins ganhos correndo
- Comunidade: feed, ranking e grupos com chat em tempo real
- Treinador (chatbot) com dicas de treino, hidratação e alimentação
- **Notas:** 1 km = 1 RunCoin. O pet é o elo entre correr e a recompensa.

## 4. O que o app faz (demonstração)
- Início e estatísticas: recordes e evolução
- Corrida salva, com tênis e desgaste
- Social: curtir, ranking, grupos e chat
- Pet, conquistas e treinador
- **Notas:** aqui entra a demonstração (6 a 7 min). Não corra ao vivo; use corrida já salva ou o vídeo.

## 5. Arquitetura
- **App:** React + TypeScript + Vite, empacotado para Android com Capacitor
- **Login:** Firebase Authentication (e-mail e Google)
- **API:** FastAPI (Python) com SQLAlchemy e Alembic (migrações)
- **Banco:** PostgreSQL
- **Hospedagem:** Render (API)
- **Tempo real:** WebSocket para o chat dos grupos
- **Notas:** o app só confia no servidor para nome, foto, XP e moedas. O cliente não decide isso.

## 6. Qualidade e segurança
- Auditoria completa do código, documentada em `docs/reports/auditoria-refatoracao.md`
- Testes automatizados no app e na API (rodar antes e citar o número real)
- Correções: dependência com falha conhecida atualizada, token do chat fora da URL, limites de entrada, documentação da API fechada em produção, limite de tentativas
- Telas grandes divididas e código morto removido
- **Notas:** diga "revisado e corrigido o que a auditoria encontrou". Nunca "100% seguro".

## 7. Decisões e limites (o que deixamos de fora e por quê)
- **Compra de RunCoins e plano VIP:** modelados, **sem cobrança real**. Exigiriam empresa, nota fiscal e o faturamento da loja de aplicativos
- VIP hoje: selo no perfil e criar grupo privado, ativado só em modo de teste
- Sono, relógio e sensor cardíaco: desligados nesta versão (código preservado)
- **Notas:** este slide mostra maturidade: você sabe onde está o limite. Ver `docs/MONETIZACAO.md`. Não diga que a compra funciona.

## 8. Trabalho futuro
- Cobrança real: empresa, nota fiscal, Google Play Billing, webhook de reembolso
- Fotos fora do banco (armazenamento de arquivos)
- Remover o Firestore restante e os dados de demonstração
- Separar a lógica de GPS da tela de corrida, com teste em aparelho
- Estatísticas e relógios (Health Connect) quando a versão permitir
- **Notas:** cada item aqui é uma limitação que você já conhece; isso responde antes a pergunta da banca.

## 9. Encerramento
- O que entregamos, em uma frase
- Obrigado. Perguntas?
- **Notas:** tenha `docs/APRESENTACAO_BANCA.md` aberto na seção de perguntas difíceis.

---

## Dicas de montagem
- No máximo 5 linhas por slide; sem tabela longa.
- Uma captura de tela do app por slide de funcionalidade (Início, Feed/Grupo, Pet, Treinador), tiradas do APK 0.2.1, não de mock.
- Fonte legível à distância; tema escuro com bom contraste.
- Se o tempo apertar, corte o slide 8, nunca a demonstração.
