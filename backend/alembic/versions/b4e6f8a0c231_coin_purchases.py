"""Compras de pacotes de RunCoins.

Revision ID: b4e6f8a0c231
Revises: a3d5e7f9b120
"""
from alembic import op
import sqlalchemy as sa

revision = "b4e6f8a0c231"
down_revision = "a3d5e7f9b120"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "coin_purchases",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("pack_id", sa.String(64), nullable=False),
        sa.Column("coins", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("transaction_id", sa.String(200), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("refunded_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.uid"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("provider", "transaction_id", name="uq_coin_purchases_provider_tx"),
    )
    op.create_index("ix_coin_purchases_user_id", "coin_purchases", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_coin_purchases_user_id", table_name="coin_purchases")
    op.drop_table("coin_purchases")
