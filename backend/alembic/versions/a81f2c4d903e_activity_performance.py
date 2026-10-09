"""Store timed distance and real sensor samples without changing legacy runs."""
from alembic import op
import sqlalchemy as sa

revision = "a81f2c4d903e"
down_revision = "d48faef56a35"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("activities", sa.Column("performance_samples", sa.JSON(), nullable=True))
    op.add_column("activities", sa.Column("heart_rate_samples", sa.JSON(), nullable=True))
    op.add_column("activities", sa.Column("heart_rate_max_bpm", sa.Integer(), nullable=True))
    op.add_column("activities", sa.Column("is_simulated", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.alter_column("activities", "is_simulated", server_default=None)


def downgrade():
    for name in ("is_simulated", "heart_rate_max_bpm", "heart_rate_samples", "performance_samples"):
        op.drop_column("activities", name)
