"""Controle de tênis e vínculo opcional com corridas existentes.

Revision ID: f6b8c3d9e102
Revises: d48faef56a35
"""
from alembic import op
import sqlalchemy as sa

revision = "f6b8c3d9e102"
down_revision = "d48faef56a35"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "shoes",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("brand", sa.String(80), nullable=True),
        sa.Column("model", sa.String(80), nullable=True),
        sa.Column("purchase_date", sa.Date(), nullable=True),
        sa.Column("initial_km", sa.Float(), nullable=False),
        sa.Column("limit_km", sa.Float(), nullable=False),
        sa.Column("is_default", sa.Boolean(), nullable=False),
        sa.Column("manually_worn", sa.Boolean(), nullable=False),
        sa.Column("retired", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("initial_km >= 0 AND initial_km <= 1000000", name="ck_shoes_initial_km"),
        sa.CheckConstraint("limit_km > 0 AND limit_km <= 100000", name="ck_shoes_limit_km"),
        sa.CheckConstraint("NOT (retired AND is_default)", name="ck_shoes_active_default"),
        sa.ForeignKeyConstraint(["user_id"], ["users.uid"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_shoes_user_id", "shoes", ["user_id"])
    op.create_index("uq_shoes_default_per_user", "shoes", ["user_id"], unique=True, postgresql_where=sa.text("is_default"))
    op.add_column("activities", sa.Column("shoe_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_activities_shoe_id", "activities", "shoes", ["shoe_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_activities_shoe_id", "activities", ["shoe_id"])


def downgrade() -> None:
    op.drop_index("ix_activities_shoe_id", table_name="activities")
    op.drop_constraint("fk_activities_shoe_id", "activities", type_="foreignkey")
    op.drop_column("activities", "shoe_id")
    op.drop_index("ix_shoes_user_id", table_name="shoes")
    op.drop_index("uq_shoes_default_per_user", table_name="shoes")
    op.drop_table("shoes")
