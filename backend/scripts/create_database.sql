-- Script de criacao do banco gerado a partir do schema real do Veloxy
-- Extraido via pg_dump --schema-only em 2026-09-10
-- Model: Veloxy (backend proprio)    Versao: Fase 2 (beta-1.5)
-- Banco: PostgreSQL 16
--
-- Observacao: os valores default de colunas como total_xp=0, likes=[],
-- onboarded=false etc. sao aplicados pela aplicacao (SQLAlchemy), nao pelo
-- Postgres — por isso nao aparecem como DEFAULT aqui. So os IDs (SERIAL)
-- tem default de verdade no banco.

-- -----------------------------------------------------
-- Schema veloxy_dev
-- -----------------------------------------------------
-- Nao precisa de CREATE SCHEMA/USE como no MySQL: o Postgres ja cria o
-- schema "public" por padrao dentro do banco veloxy_dev (criado
-- separadamente, ver README do backend).


-- -----------------------------------------------------
-- Tabela `users`
-- -----------------------------------------------------
-- Perfil do usuario. uid = mesmo UID do Firebase Auth (nao ha tabela de
-- autenticacao aqui — login/senha ficam inteiramente no Firebase).
CREATE TABLE IF NOT EXISTS users (
    uid                        VARCHAR NOT NULL,
    display_name               VARCHAR NOT NULL,
    photo_url                  VARCHAR,
    total_xp                   INTEGER NOT NULL,
    level                      VARCHAR NOT NULL,
    monthly_km                 DOUBLE PRECISION NOT NULL,
    monthly_km_month           VARCHAR,
    bio                        VARCHAR,
    location                   VARCHAR,
    private_profile            BOOLEAN NOT NULL,
    weekly_goal_km             DOUBLE PRECISION,
    onboarded                  BOOLEAN NOT NULL,
    terms_accepted_at          TIMESTAMP WITH TIME ZONE,
    terms_version              VARCHAR,
    created_at                 TIMESTAMP WITH TIME ZONE NOT NULL,
    last_updated                TIMESTAMP WITH TIME ZONE NOT NULL,
    pet_species                VARCHAR,
    pet_name                   VARCHAR,
    pet_coins                  INTEGER NOT NULL,
    pet_unlocked_accessory_ids VARCHAR[] NOT NULL,
    pet_equipped_cabeca        VARCHAR,
    pet_equipped_pescoco       VARCHAR,
    pet_equipped_fundo         VARCHAR,
    CONSTRAINT users_pkey PRIMARY KEY (uid)
);


-- -----------------------------------------------------
-- Tabela `products`
-- -----------------------------------------------------
-- Catalogo de produtos (loja) — sem FK para outras tabelas.
CREATE TABLE IF NOT EXISTS products (
    id             SERIAL NOT NULL,
    name           VARCHAR NOT NULL,
    category       VARCHAR NOT NULL,
    price          DOUBLE PRECISION NOT NULL,
    original_price DOUBLE PRECISION,
    rating         DOUBLE PRECISION NOT NULL,
    reviews        INTEGER NOT NULL,
    tag            VARCHAR,
    gradient       VARCHAR NOT NULL,
    accent         VARCHAR NOT NULL,
    emoji          VARCHAR NOT NULL,
    external_url   VARCHAR,
    CONSTRAINT products_pkey PRIMARY KEY (id)
);


-- -----------------------------------------------------
-- Tabela `events`
-- -----------------------------------------------------
-- Eventos/corridas de terceiros (o app so lista e permite se inscrever;
-- a inscricao de verdade acontece no site da organizadora).
CREATE TABLE IF NOT EXISTS events (
    id                SERIAL NOT NULL,
    title             VARCHAR NOT NULL,
    date              VARCHAR NOT NULL,
    location          VARCHAR NOT NULL,
    city              VARCHAR NOT NULL,
    state             VARCHAR,
    country           VARCHAR,
    lat               DOUBLE PRECISION,
    lng               DOUBLE PRECISION,
    category          VARCHAR NOT NULL,
    distance_options  VARCHAR[],
    image             VARCHAR,
    price             VARCHAR NOT NULL,
    official_url      VARCHAR,
    source            VARCHAR,
    source_url        VARCHAR,
    source_type       VARCHAR,
    verified          BOOLEAN NOT NULL,
    status            VARCHAR NOT NULL,
    last_synced_at    TIMESTAMP WITH TIME ZONE,
    distance_km       DOUBLE PRECISION,
    created_at        TIMESTAMP WITH TIME ZONE NOT NULL,
    event_timestamp   TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT events_pkey PRIMARY KEY (id)
);


-- -----------------------------------------------------
-- Tabela `activities`
-- -----------------------------------------------------
-- Corridas salvas pelos usuarios. FK em user_id: apagar o usuario apaga
-- suas corridas (ON DELETE CASCADE).
CREATE TABLE IF NOT EXISTS activities (
    id               SERIAL NOT NULL,
    user_id          VARCHAR NOT NULL,
    user_name        VARCHAR NOT NULL,
    user_avatar      VARCHAR,
    distance         DOUBLE PRECISION NOT NULL,
    "time"           VARCHAR NOT NULL,
    duration_seconds INTEGER NOT NULL,
    pace             VARCHAR NOT NULL,
    calories         INTEGER,
    type             VARCHAR NOT NULL,
    likes            VARCHAR[] NOT NULL,
    route            JSON,
    xp_gained        INTEGER,
    created_at       TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT activities_pkey PRIMARY KEY (id),
    CONSTRAINT activities_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES users (uid) ON DELETE CASCADE
);


-- -----------------------------------------------------
-- Tabela `groups`
-- -----------------------------------------------------
-- Comunidades de corredores. created_by usa ON DELETE RESTRICT: nao deixa
-- apagar um usuario que ainda e criador de algum grupo (evita grupo orfao).
CREATE TABLE IF NOT EXISTS groups (
    id             SERIAL NOT NULL,
    name           VARCHAR NOT NULL,
    city           VARCHAR NOT NULL,
    description    VARCHAR NOT NULL,
    tag            VARCHAR NOT NULL,
    photo_url      VARCHAR,
    created_by     VARCHAR NOT NULL,
    weekly_km      DOUBLE PRECISION NOT NULL,
    weekly_km_week VARCHAR,
    created_at     TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at     TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT groups_pkey PRIMARY KEY (id),
    CONSTRAINT groups_created_by_fkey FOREIGN KEY (created_by)
        REFERENCES users (uid) ON DELETE RESTRICT
);


-- -----------------------------------------------------
-- Tabela `group_members`
-- -----------------------------------------------------
-- Quem participa de qual grupo. UNIQUE(group_id, user_id) impede o mesmo
-- usuario entrar duas vezes no mesmo grupo.
CREATE TABLE IF NOT EXISTS group_members (
    id        SERIAL NOT NULL,
    group_id  INTEGER NOT NULL,
    user_id   VARCHAR NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT group_members_pkey PRIMARY KEY (id),
    CONSTRAINT uq_group_member UNIQUE (group_id, user_id),
    CONSTRAINT group_members_group_id_fkey FOREIGN KEY (group_id)
        REFERENCES groups (id) ON DELETE CASCADE,
    CONSTRAINT group_members_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES users (uid) ON DELETE CASCADE
);


-- -----------------------------------------------------
-- Tabela `posts`
-- -----------------------------------------------------
-- Publicacoes no feed de um grupo.
CREATE TABLE IF NOT EXISTS posts (
    id              SERIAL NOT NULL,
    group_id        INTEGER NOT NULL,
    author_id       VARCHAR NOT NULL,
    text            VARCHAR NOT NULL,
    image_url       VARCHAR,
    likes           VARCHAR[] NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL,
    comments_count  INTEGER NOT NULL,
    CONSTRAINT posts_pkey PRIMARY KEY (id),
    CONSTRAINT posts_group_id_fkey FOREIGN KEY (group_id)
        REFERENCES groups (id) ON DELETE CASCADE,
    CONSTRAINT posts_author_id_fkey FOREIGN KEY (author_id)
        REFERENCES users (uid) ON DELETE CASCADE
);


-- -----------------------------------------------------
-- Tabela `comments`
-- -----------------------------------------------------
-- Comentarios em uma publicacao do grupo.
CREATE TABLE IF NOT EXISTS comments (
    id         SERIAL NOT NULL,
    post_id    INTEGER NOT NULL,
    author_id  VARCHAR NOT NULL,
    text       VARCHAR NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT comments_pkey PRIMARY KEY (id),
    CONSTRAINT comments_post_id_fkey FOREIGN KEY (post_id)
        REFERENCES posts (id) ON DELETE CASCADE,
    CONSTRAINT comments_author_id_fkey FOREIGN KEY (author_id)
        REFERENCES users (uid) ON DELETE CASCADE
);


-- -----------------------------------------------------
-- Tabela `messages`
-- -----------------------------------------------------
-- Mensagens do chat de um grupo.
CREATE TABLE IF NOT EXISTS messages (
    id         SERIAL NOT NULL,
    group_id   INTEGER NOT NULL,
    sender_id  VARCHAR NOT NULL,
    text       VARCHAR NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT messages_pkey PRIMARY KEY (id),
    CONSTRAINT messages_group_id_fkey FOREIGN KEY (group_id)
        REFERENCES groups (id) ON DELETE CASCADE,
    CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id)
        REFERENCES users (uid) ON DELETE CASCADE
);


-- -----------------------------------------------------
-- Tabela `event_participants`
-- -----------------------------------------------------
-- Quem marcou interesse/inscricao num evento. UNIQUE(event_id, user_id)
-- torna a inscricao idempotente (inscrever de novo nao duplica).
CREATE TABLE IF NOT EXISTS event_participants (
    id            SERIAL NOT NULL,
    event_id      INTEGER NOT NULL,
    user_id       VARCHAR NOT NULL,
    registered_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT event_participants_pkey PRIMARY KEY (id),
    CONSTRAINT uq_event_participant UNIQUE (event_id, user_id),
    CONSTRAINT event_participants_event_id_fkey FOREIGN KEY (event_id)
        REFERENCES events (id) ON DELETE CASCADE,
    CONSTRAINT event_participants_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES users (uid) ON DELETE CASCADE
);


-- -----------------------------------------------------
-- Fim do script
-- -----------------------------------------------------
-- Nota: em uso normal, esse schema e criado pelo Alembic
-- (cd backend && alembic upgrade head), nao rodando este .sql direto —
-- ele existe como documentacao/modelo fisico do banco, nao como parte
-- do fluxo de deploy.
