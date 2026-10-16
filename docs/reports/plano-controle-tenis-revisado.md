# Controle de tênis — plano

Branch `controle-tenis` · PR [CodeBreakers-Runnex/Runnex#1](https://github.com/CodeBreakers-Runnex/Runnex/pull/1)

## O que o recurso faz

O corredor registra os tênis que usa e o app soma os km das corridas feitas com cada um. Quando o uso se aproxima do limite escolhido, o app avisa. O app **estima** o desgaste a partir da quilometragem; ele não mede a condição física do tênis.

**Uso total = km anterior ao app + soma das corridas vinculadas.** O total é calculado na consulta, então excluir ou trocar o tênis de uma corrida atualiza a conta sozinho.

| Estado | Quando |
|---|---|
| Bom | abaixo de 80% do limite |
| Atenção | a partir de 80% |
| Gasto | a partir de 100%, ou marcado pelo usuário |
| Aposentado | marcado pelo usuário; não aceita novas corridas |

O limite padrão é 600 km, editável. Só pode haver um tênis padrão por usuário. Corridas antigas não recebem tênis automaticamente.

## O que foi implementado

- **Banco:** tabela `shoes` e coluna `activities.shoe_id`, criadas pela migration `f6b8c3d9e102`.
- **API:**
  - `GET/POST /shoes` e `PUT /shoes/{id}`;
  - `PUT /activities/{id}/shoe`;
  - campo `shoeId` opcional em `POST /activities`.
- **Telas:**
  - "Meus tênis" (`/tenis`);
  - seletor na tela de corrida (troca só com a corrida pausada);
  - aviso depois de salvar a corrida.
- **Testes:** `backend/tests/test_shoes.py` e `src/test/shoes.test.tsx`.

## Falta antes do merge

- [ ] **Testar o caso "Corredor".** `lock_owner` cria o usuário com esse nome quando ele ainda não existe no Postgres. Se o nome ficar errado, usar o nome do token Firebase.
- [ ] **Tirar `shoeId` das atividades de outros usuários** em `/activities/feed` e `/activities/by-users`. Os tênis devem ser privados.
- [ ] **Revisão de alguém além do autor.**

## Deploy

1. Fazer o merge em `main`.
2. Publicar o **backend primeiro**. O `render-start.sh` já roda `alembic upgrade head`.
3. Depois publicar o frontend e gerar um novo build Android.

Na ordem inversa, a tela de corrida não consegue carregar os tênis.

## Fora do escopo agora

- **Excluir tênis.** Hoje só é possível aposentar. Decidir se precisa.
- **Corrigir corridas além das 50 mais recentes.** A API já permite; falta paginar a tela.
