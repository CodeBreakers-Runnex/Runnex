"""Exportacao dos dados do usuario (LGPD, art. 18: acesso e portabilidade).

Em vez de listar tabela por tabela, percorre todas as tabelas do banco e
pega as linhas cujas colunas apontam para users.uid. Assim uma tabela nova
com dado do usuario entra na exportacao sem ninguem precisar lembrar.
"""

from datetime import date, datetime, time
from decimal import Decimal
from uuid import UUID

from sqlalchemy import Table, or_, select
from sqlalchemy.orm import Session

import app.models  # noqa: F401  (registra todas as tabelas no metadata)
from app.database import Base

EXPORT_VERSION = 1


def _json_value(value):
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, (list, tuple)):
        return [_json_value(item) for item in value]
    if isinstance(value, dict):
        return {key: _json_value(item) for key, item in value.items()}
    return value


def _user_columns(table: Table) -> list:
    """Colunas desta tabela que guardam o uid do usuario."""
    if table.name == "users":
        return [table.c.uid]
    return [
        column
        for column in table.columns
        if any(fk.column.table.name == "users" and fk.column.name == "uid" for fk in column.foreign_keys)
    ]


def export_user_data(db: Session, uid: str, now: datetime) -> dict:
    tables: dict[str, list[dict]] = {}
    for table in Base.metadata.sorted_tables:
        columns = _user_columns(table)
        if not columns:
            continue
        query = select(table).where(or_(*(column == uid for column in columns)))
        primary_key = list(table.primary_key.columns)
        if primary_key:
            query = query.order_by(*primary_key)
        rows = db.execute(query).mappings().all()
        tables[table.name] = [{key: _json_value(value) for key, value in row.items()} for row in rows]

    # Curtidas ficam num array "likes" dentro do conteudo de outra pessoa
    # (corridas, posts de grupo): exporta so os ids do que foi curtido.
    likes: dict[str, list] = {}
    for table in Base.metadata.sorted_tables:
        if "likes" in table.c and "id" in table.c:
            liked = db.execute(select(table.c.id).where(table.c.likes.any(uid)).order_by(table.c.id)).scalars().all()
            likes[table.name] = list(liked)

    return {
        "exportVersion": EXPORT_VERSION,
        "exportedAt": now.isoformat(),
        "uid": uid,
        "tables": tables,
        "likes": likes,
    }
