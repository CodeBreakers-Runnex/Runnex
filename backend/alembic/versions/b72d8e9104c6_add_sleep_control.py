"""Controle de sono privado.

Revision ID: b72d8e9104c6
Revises: d48faef56a35
"""

from alembic import op
import sqlalchemy as sa

revision = "b72d8e9104c6"
down_revision = "d48faef56a35"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "recovery_preferences",
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("goal_minutes", sa.Integer(), nullable=True),
        sa.Column("timezone", sa.String(80), nullable=False),
        sa.Column("preferred_origin", sa.String(200), nullable=True),
        sa.Column("consent_version", sa.String(40), nullable=True),
        sa.Column("consented_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("health_connect_enabled", sa.Boolean(), nullable=False),
        sa.Column("sync_generation", sa.String(36), nullable=False),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("goal_minutes IS NULL OR goal_minutes BETWEEN 60 AND 960", name="ck_recovery_goal"),
        sa.ForeignKeyConstraint(["user_id"], ["users.uid"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )
    op.create_table(
        "sleep_sessions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("source", sa.String(20), nullable=False),
        sa.Column("origin", sa.String(200), nullable=False),
        sa.Column("origin_label", sa.String(120), nullable=True),
        sa.Column("external_id", sa.String(200), nullable=True),
        sa.Column("source_modified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("wake_date", sa.Date(), nullable=False),
        sa.Column("end_offset_minutes", sa.Integer(), nullable=True),
        sa.Column("sleep_seconds", sa.Integer(), nullable=True),
        sa.Column("kind", sa.String(10), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("end_time > start_time", name="ck_sleep_time_order"),
        sa.CheckConstraint("sleep_seconds IS NULL OR sleep_seconds >= 0", name="ck_sleep_seconds"),
        sa.CheckConstraint("source IN ('manual', 'health_connect')", name="ck_sleep_source"),
        sa.CheckConstraint("kind IN ('main', 'nap')", name="ck_sleep_kind"),
        sa.ForeignKeyConstraint(["user_id"], ["users.uid"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "origin", "external_id", name="uq_sleep_external_record"),
    )
    for field in ("user_id", "end_time", "wake_date"):
        op.create_index(f"ix_sleep_sessions_{field}", "sleep_sessions", [field])
    op.create_table(
        "sleep_checkins",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("quality", sa.Integer(), nullable=True),
        sa.Column("fatigue", sa.Integer(), nullable=True),
        sa.CheckConstraint("quality IS NULL OR quality BETWEEN 1 AND 5", name="ck_sleep_quality"),
        sa.CheckConstraint("fatigue IS NULL OR fatigue BETWEEN 1 AND 5", name="ck_sleep_fatigue"),
        sa.ForeignKeyConstraint(["user_id"], ["users.uid"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "day", name="uq_sleep_checkin_day"),
    )
    for field in ("user_id", "day"):
        op.create_index(f"ix_sleep_checkins_{field}", "sleep_checkins", [field])
    op.create_table(
        "sleep_import_exclusions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("external_id", sa.String(200), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.uid"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "external_id", name="uq_sleep_exclusion"),
    )
    op.create_index("ix_sleep_import_exclusions_user_id", "sleep_import_exclusions", ["user_id"])


def downgrade() -> None:
    for table in ("sleep_import_exclusions", "sleep_checkins", "sleep_sessions", "recovery_preferences"):
        op.drop_table(table)
