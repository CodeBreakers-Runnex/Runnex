from datetime import datetime

from sqlalchemy import ARRAY, Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.time_utils import utcnow


class User(Base):
    __tablename__ = "users"

    # uid do Firebase Auth, preservado como chave primária na migração
    uid: Mapped[str] = mapped_column(String, primary_key=True)

    display_name: Mapped[str] = mapped_column(String, nullable=False)
    photo_url: Mapped[str | None] = mapped_column(String, nullable=True)
    total_xp: Mapped[int] = mapped_column(Integer, default=0)
    level: Mapped[str] = mapped_column(String, default="Iniciante")
    monthly_km: Mapped[float] = mapped_column(default=0)
    monthly_km_month: Mapped[str | None] = mapped_column(String, nullable=True)
    bio: Mapped[str | None] = mapped_column(String, nullable=True)
    location: Mapped[str | None] = mapped_column(String, nullable=True)
    private_profile: Mapped[bool] = mapped_column(Boolean, default=False)
    weekly_goal_km: Mapped[float | None] = mapped_column(nullable=True)
    onboarded: Mapped[bool] = mapped_column(Boolean, default=False)
    terms_accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    terms_version: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_updated: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    # Gamificação de pet
    pet_species: Mapped[str | None] = mapped_column(String, nullable=True)
    pet_name: Mapped[str | None] = mapped_column(String, nullable=True)
    pet_coins: Mapped[int] = mapped_column(Integer, default=0)
    pet_unlocked_accessory_ids: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    pet_equipped_cabeca: Mapped[str | None] = mapped_column(String, nullable=True)
    pet_equipped_pescoco: Mapped[str | None] = mapped_column(String, nullable=True)
    pet_equipped_fundo: Mapped[str | None] = mapped_column(String, nullable=True)

    activities = relationship("Activity", back_populates="user", cascade="all, delete-orphan")
    group_memberships = relationship("GroupMember", back_populates="user", cascade="all, delete-orphan")
    event_registrations = relationship("EventParticipant", back_populates="user", cascade="all, delete-orphan")
