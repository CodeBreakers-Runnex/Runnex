"""Pet: slots de acessorio corpo e pes.

Revision ID: a3d5e7f9b120
Revises: c91e4f2a7b30
"""
from alembic import op
import sqlalchemy as sa

revision = "a3d5e7f9b120"
down_revision = "c91e4f2a7b30"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("pet_equipped_corpo", sa.String(), nullable=True))
    op.add_column("users", sa.Column("pet_equipped_pes", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "pet_equipped_pes")
    op.drop_column("users", "pet_equipped_corpo")
