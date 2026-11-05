"""Copia todos os dados de um banco Postgres do Runnex para outro.

Feito para trocar o banco de região (ex.: Neon de São Paulo para Ohio, junto
do servidor no Render). O banco de destino precisa já ter a estrutura na
mesma versão do Alembic e estar vazio; o de origem não é alterado.

    cd backend
    SOURCE_DATABASE_URL="postgresql://...sa-east-1..." \\
    TARGET_DATABASE_URL="postgresql://...us-east-2..." \\
    .venv/bin/python scripts/copy_database.py

No Windows (PowerShell):

    $env:SOURCE_DATABASE_URL="..."; $env:TARGET_DATABASE_URL="..."
    .venv\\Scripts\\python scripts\\copy_database.py

Tudo roda numa transação no destino: se algo falhar, nada é gravado. No fim
o script compara a quantidade de linhas de cada tabela nos dois bancos.
"""

from __future__ import annotations

import os
import sys

import psycopg
from psycopg import sql


def connect(env_name: str) -> psycopg.Connection:
    url = os.environ.get(env_name)
    if not url:
        sys.exit(f"Defina a variável {env_name}.")
    # O app usa o formato do SQLAlchemy (postgresql+psycopg://); o psycopg puro não.
    return psycopg.connect(url.replace("postgresql+psycopg://", "postgresql://", 1))


def tables_in_dependency_order(conn: psycopg.Connection) -> list[str]:
    """Tabelas do schema public, com quem é referenciado antes de quem referencia."""
    tables = [r[0] for r in conn.execute(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
    )]
    deps: dict[str, set[str]] = {t: set() for t in tables}
    for child, parent in conn.execute(
        """
        SELECT c.relname, p.relname
        FROM pg_constraint k
        JOIN pg_class c ON c.oid = k.conrelid
        JOIN pg_class p ON p.oid = k.confrelid
        WHERE k.contype = 'f' AND k.connamespace = 'public'::regnamespace
        """
    ):
        if child != parent:
            deps[child].add(parent)

    ordered: list[str] = []
    while deps:
        ready = sorted(t for t, parents in deps.items() if not parents - set(ordered))
        if not ready:
            sys.exit(f"Dependência circular entre tabelas: {sorted(deps)}")
        for t in ready:
            ordered.append(t)
            del deps[t]
    return ordered


def count(conn: psycopg.Connection, table: str) -> int:
    return conn.execute(sql.SQL("SELECT count(*) FROM {}").format(sql.Identifier(table))).fetchone()[0]


def columns(conn: psycopg.Connection, table: str) -> list[tuple[str, str]]:
    return [tuple(r) for r in conn.execute(
        "SELECT column_name, data_type FROM information_schema.columns "
        "WHERE table_schema = 'public' AND table_name = %s ORDER BY ordinal_position",
        (table,),
    )]


def alembic_version(conn: psycopg.Connection) -> str | None:
    row = conn.execute("SELECT version_num FROM alembic_version").fetchone()
    return row[0] if row else None


def main() -> None:
    with connect("SOURCE_DATABASE_URL") as src, connect("TARGET_DATABASE_URL") as dst:
        src_tables = tables_in_dependency_order(src)
        dst_tables = tables_in_dependency_order(dst)
        if set(src_tables) != set(dst_tables):
            sys.exit(
                "Os bancos não têm as mesmas tabelas. Rode `alembic upgrade head` no destino.\n"
                f"Só na origem: {sorted(set(src_tables) - set(dst_tables))}\n"
                f"Só no destino: {sorted(set(dst_tables) - set(src_tables))}"
            )

        different = [t for t in src_tables if columns(src, t) != columns(dst, t)]
        if different:
            sys.exit(
                f"Colunas diferentes em {different}. Rode `alembic upgrade head` no destino "
                "(com DATABASE_URL apontando para ele) e tente de novo."
            )

        version = alembic_version(src)
        target_version = alembic_version(dst)
        if target_version not in (None, version):
            sys.exit(f"Versões do Alembic diferentes: origem {version}, destino {target_version}.")

        not_empty = [t for t in dst_tables if t != "alembic_version" and count(dst, t) > 0]
        if not_empty:
            sys.exit(f"O destino já tem dados em {not_empty}. Use um banco vazio.")

        with dst.transaction():
            for table in dst_tables:
                ident = sql.Identifier(table)
                if table == "alembic_version":
                    dst.execute("DELETE FROM alembic_version")
                with src.cursor().copy(sql.SQL("COPY {} TO STDOUT").format(ident)) as out:
                    with dst.cursor().copy(sql.SQL("COPY {} FROM STDIN").format(ident)) as inp:
                        for chunk in out:
                            inp.write(chunk)

            # Sem isso, o próximo INSERT tentaria id=1 e bateria na chave primária.
            for table, column, sequence in dst.execute(
                """
                SELECT t.relname, a.attname, pg_get_serial_sequence(format('public.%I', t.relname), a.attname)
                FROM pg_class t
                JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum > 0 AND NOT a.attisdropped
                WHERE t.relnamespace = 'public'::regnamespace AND t.relkind = 'r'
                  AND pg_get_serial_sequence(format('public.%I', t.relname), a.attname) IS NOT NULL
                """
            ).fetchall():
                dst.execute(
                    sql.SQL("SELECT setval({seq}, COALESCE((SELECT max({col}) FROM {tbl}), 0) + 1, false)").format(
                        seq=sql.Literal(sequence), col=sql.Identifier(column), tbl=sql.Identifier(table)
                    )
                )

        print(f"{'tabela':<26}{'origem':>8}{'destino':>9}")
        mismatches = 0
        for table in dst_tables:
            a, b = count(src, table), count(dst, table)
            mismatches += a != b
            print(f"{table:<26}{a:>8}{b:>9}{'' if a == b else '  <- DIFERENTE'}")

        if mismatches:
            sys.exit("Contagens diferentes. Não troque o DATABASE_URL ainda.")
        print(f"\nPronto: dados copiados (Alembic {version}). Agora troque o DATABASE_URL no Render.")


if __name__ == "__main__":
    main()
