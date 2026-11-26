"""Plano VIP: marca no usuario (sem pagamento nem validade).

Revision ID: d1a3f5b7c902
Revises: c7d2e9a1f340
"""
from alembic import op
import sqlalchemy as sa

revision = "d1a3f5b7c902"
down_revision = "c7d2e9a1f340"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("is_vip", sa.Boolean(), server_default="false", nullable=False))


def downgrade() -> None:
    op.drop_column("users", "is_vip")
