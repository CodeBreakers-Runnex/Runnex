"""Dados de sono privados; nenhum campo integra perfis ou feeds públicos."""

from datetime import date, datetime
from uuid import uuid4

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.time_utils import utcnow


class RecoveryPreferences(Base):
    __tablename__ = "recovery_preferences"
    __table_args__ = (CheckConstraint("goal_minutes IS NULL OR goal_minutes BETWEEN 60 AND 960", name="ck_recovery_goal"),)

    user_id: Mapped[str] = mapped_column(ForeignKey("users.uid", ondelete="CASCADE"), primary_key=True)
    goal_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    timezone: Mapped[str] = mapped_column(String(80), default="America/Sao_Paulo")
    preferred_origin: Mapped[str | None] = mapped_column(String(200), nullable=True)
    consent_version: Mapped[str | None] = mapped_column(String(40), nullable=True)
    consented_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    health_connect_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    sync_generation: Mapped[str] = mapped_column(String(36), default=lambda: str(uuid4()))
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class SleepSession(Base):
    __tablename__ = "sleep_sessions"
    __table_args__ = (
        UniqueConstraint("user_id", "origin", "external_id", name="uq_sleep_external_record"),
        CheckConstraint("end_time > start_time", name="ck_sleep_time_order"),
        CheckConstraint("sleep_seconds IS NULL OR sleep_seconds >= 0", name="ck_sleep_seconds"),
        CheckConstraint("source IN ('manual', 'health_connect')", name="ck_sleep_source"),
        CheckConstraint("kind IN ('main', 'nap')", name="ck_sleep_kind"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.uid", ondelete="CASCADE"), index=True)
    source: Mapped[str] = mapped_column(String(20))
    origin: Mapped[str] = mapped_column(String(200))
    origin_label: Mapped[str | None] = mapped_column(String(120), nullable=True)
    external_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    source_modified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    wake_date: Mapped[date] = mapped_column(Date, index=True)
    end_offset_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sleep_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    kind: Mapped[str] = mapped_column(String(10), default="main")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class SleepCheckIn(Base):
    __tablename__ = "sleep_checkins"
    __table_args__ = (
        UniqueConstraint("user_id", "day", name="uq_sleep_checkin_day"),
        CheckConstraint("quality IS NULL OR quality BETWEEN 1 AND 5", name="ck_sleep_quality"),
        CheckConstraint("fatigue IS NULL OR fatigue BETWEEN 1 AND 5", name="ck_sleep_fatigue"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.uid", ondelete="CASCADE"), index=True)
    day: Mapped[date] = mapped_column(Date, index=True)
    quality: Mapped[int | None] = mapped_column(Integer, nullable=True)
    fatigue: Mapped[int | None] = mapped_column(Integer, nullable=True)


class SleepImportExclusion(Base):
    """Impede que um registro importado apagado pelo usuário reapareça no replay."""

    __tablename__ = "sleep_import_exclusions"
    __table_args__ = (UniqueConstraint("user_id", "external_id", name="uq_sleep_exclusion"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.uid", ondelete="CASCADE"), index=True)
    external_id: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
