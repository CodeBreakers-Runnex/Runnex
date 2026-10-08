from datetime import date, datetime, time

from sqlalchemy import CheckConstraint, Date, DateTime, Float, ForeignKey, Index, Integer, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.time_utils import utcnow


class PlannedWorkout(Base):
    __tablename__ = "planned_workouts"
    __table_args__ = (
        Index("ix_planned_workouts_user_date", "user_id", "planned_date"),
        CheckConstraint("status IN ('planned','completed','skipped','cancelled')", name="ck_workout_status"),
        CheckConstraint("target_distance_km IS NULL OR target_distance_km > 0", name="ck_workout_distance"),
        CheckConstraint("target_duration_minutes IS NULL OR target_duration_minutes > 0", name="ck_workout_duration"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.uid", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(80))
    category: Mapped[str] = mapped_column(String(20))
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    planned_date: Mapped[date] = mapped_column(Date)
    planned_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    timezone: Mapped[str] = mapped_column(String(80))
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    original_date: Mapped[date] = mapped_column(Date)
    target_distance_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    target_duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="planned")
    completion_source: Mapped[str | None] = mapped_column(String(20), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_activity_id: Mapped[int | None] = mapped_column(ForeignKey("activities.id", ondelete="SET NULL"), nullable=True, unique=True)
    evidence_removed: Mapped[bool] = mapped_column(default=False)
    revision: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
