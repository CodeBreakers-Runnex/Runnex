"""Activity client_id for offline queue deduplication

Revision ID: c91e4f2a7b30
Revises: b76d2b3a11fe
"""
from alembic import op
import sqlalchemy as sa

revision = "c91e4f2a7b30"
down_revision = "b76d2b3a11fe"
branch_labels = None
depends_on = None


def upgrade():
    # Id gerado no celular. Uma corrida da fila offline reenviada depois de a
    # resposta se perder volta com o mesmo client_id e não vira duplicata.
    op.add_column("activities", sa.Column("client_id", sa.String(64), nullable=True))
    op.create_unique_constraint("uq_activities_user_client_id", "activities", ["user_id", "client_id"])


def downgrade():
    op.drop_constraint("uq_activities_user_client_id", "activities", type_="unique")
    op.drop_column("activities", "client_id")
