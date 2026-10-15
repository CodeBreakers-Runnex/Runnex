"""Private training calendar.

Revision ID: c3a6f14d8209
Revises: d48faef56a35
"""
from alembic import op
import sqlalchemy as sa

revision = "c3a6f14d8209"
down_revision = "d48faef56a35"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "planned_workouts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("title", sa.String(80), nullable=False),
        sa.Column("category", sa.String(20), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("planned_date", sa.Date(), nullable=False),
        sa.Column("planned_time", sa.Time(), nullable=True),
        sa.Column("timezone", sa.String(80), nullable=False),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("original_date", sa.Date(), nullable=False),
        sa.Column("target_distance_km", sa.Float(), nullable=True),
        sa.Column("target_duration_minutes", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("completion_source", sa.String(20), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_activity_id", sa.Integer(), nullable=True),
        sa.Column("evidence_removed", sa.Boolean(), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("status IN ('planned','completed','skipped','cancelled')", name="ck_workout_status"),
        sa.CheckConstraint("target_distance_km IS NULL OR target_distance_km > 0", name="ck_workout_distance"),
        sa.CheckConstraint("target_duration_minutes IS NULL OR target_duration_minutes > 0", name="ck_workout_duration"),
        sa.ForeignKeyConstraint(["user_id"], ["users.uid"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["completed_activity_id"], ["activities.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("completed_activity_id"),
    )
    op.create_index("ix_planned_workouts_user_date", "planned_workouts", ["user_id", "planned_date"])


def downgrade():
    op.drop_table("planned_workouts")
