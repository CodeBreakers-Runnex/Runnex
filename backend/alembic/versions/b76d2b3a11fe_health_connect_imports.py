"""Health Connect import deduplication

Revision ID: b76d2b3a11fe
Revises: e4b7c2a9d150
"""
from alembic import op
import sqlalchemy as sa

revision = "b76d2b3a11fe"
down_revision = "e4b7c2a9d150"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        "health_imports",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.uid", ondelete="CASCADE"), nullable=False),
        sa.Column("source", sa.String(255), nullable=False),
        sa.Column("external_id", sa.String(255), nullable=False),
        sa.Column("activity_id", sa.Integer(), sa.ForeignKey("activities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("imported_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "source", "external_id", name="uq_health_import_identity"),
        sa.UniqueConstraint("activity_id", name="uq_health_import_activity"),
    )
    op.create_index("ix_health_imports_user_id", "health_imports", ["user_id"])

def downgrade():
    op.drop_index("ix_health_imports_user_id", table_name="health_imports")
    op.drop_table("health_imports")
