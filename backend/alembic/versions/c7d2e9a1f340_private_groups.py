"""Grupo privado: flag e hash do codigo de entrada.

Revision ID: c7d2e9a1f340
Revises: b4e6f8a0c231
"""
from alembic import op
import sqlalchemy as sa

revision = "c7d2e9a1f340"
down_revision = "b4e6f8a0c231"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("groups", sa.Column("is_private", sa.Boolean(), server_default="false", nullable=False))
    op.add_column("groups", sa.Column("join_code_hash", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("groups", "join_code_hash")
    op.drop_column("groups", "is_private")
