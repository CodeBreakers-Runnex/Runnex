"""Registra quantos RunCoins cada corrida creditou de fato.

NULL nas corridas existentes: o estorno continua recalculando pela distancia.

Revision ID: e3b5d7f9a124
Revises: d1a3f5b7c902
"""
from alembic import op
import sqlalchemy as sa

revision = "e3b5d7f9a124"
down_revision = "d1a3f5b7c902"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("activities", sa.Column("coins_credited", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("activities", "coins_credited")
