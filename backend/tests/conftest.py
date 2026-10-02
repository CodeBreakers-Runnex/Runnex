"""Fixtures da suite. Os testes de API rodam contra um Postgres de verdade
(ARRAY/JSON e array_remove nao existem no SQLite), com o schema criado
pelas migrations do Alembic - o mesmo caminho do deploy (render-start.sh).

    DATABASE_URL=postgresql+psycopg://postgres@localhost:5432/veloxy_test \\
    FIREBASE_PROJECT_ID=test pytest
"""

import os
from pathlib import Path

import pytest
from sqlalchemy.engine import make_url

BACKEND_DIR = Path(__file__).resolve().parent.parent

os.environ.setdefault("FIREBASE_PROJECT_ID", "veloxy-test")
_database_url = os.environ.get("DATABASE_URL", "")

# Cada teste da TRUNCATE em todas as tabelas: rodar isso contra o banco de
# dev ou de producao por engano apagaria tudo.
_database_name = (make_url(_database_url).database or "") if _database_url else ""
if "test" not in _database_name:
    raise pytest.UsageError(
        "Defina DATABASE_URL apontando para um banco cujo nome contenha 'test' "
        "(ex.: veloxy_test). A suite apaga todos os dados entre os testes."
    )


@pytest.fixture(scope="session")
def migrated_db():
    from alembic import command
    from alembic.config import Config

    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    command.upgrade(config, "head")


@pytest.fixture
def db(migrated_db):
    from sqlalchemy import text

    from app.database import Base, SessionLocal, engine

    session = SessionLocal()
    yield session
    session.close()

    tables = ", ".join(table.name for table in Base.metadata.sorted_tables)
    with engine.begin() as connection:
        connection.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))


@pytest.fixture
def client(db):
    from fastapi.testclient import TestClient

    from app import rate_limit
    from app.main import app

    rate_limit._hits.clear()
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def login(client):
    """login("ana") passa a autenticar as proximas requests como "ana".
    So get_current_user e trocado: require_verified_email continua real e
    le email_verified do usuario falso."""
    from app.auth import FirebaseUser, get_current_user
    from app.main import app

    def _login(uid: str, *, email_verified: bool = True) -> FirebaseUser:
        user = FirebaseUser(uid=uid, email=f"{uid}@veloxy.test", email_verified=email_verified)
        app.dependency_overrides[get_current_user] = lambda: user
        return user

    return _login


@pytest.fixture
def make_user(client, login):
    """Cria o perfil no Postgres e deixa o usuario logado."""

    def _make_user(uid: str, name: str | None = None, **profile) -> dict:
        login(uid)
        response = client.put(f"/users/{uid}", json={"displayName": name or uid, **profile})
        assert response.status_code == 200, response.text
        return response.json()

    return _make_user
