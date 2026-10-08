from datetime import date, datetime

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, Index, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.time_utils import utcnow


class Shoe(Base):
    __tablename__ = "shoes"
    __table_args__ = (
        CheckConstraint("initial_km >= 0 AND initial_km <= 1000000", name="ck_shoes_initial_km"),
        CheckConstraint("limit_km > 0 AND limit_km <= 100000", name="ck_shoes_limit_km"),
        CheckConstraint("NOT (retired AND is_default)", name="ck_shoes_active_default"),
        Index("uq_shoes_default_per_user", "user_id", unique=True, postgresql_where=text("is_default")),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.uid", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    brand: Mapped[str | None] = mapped_column(String(80), nullable=True)
    model: Mapped[str | None] = mapped_column(String(80), nullable=True)
    purchase_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    initial_km: Mapped[float] = mapped_column(default=0)
    limit_km: Mapped[float] = mapped_column(default=600)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    manually_worn: Mapped[bool] = mapped_column(Boolean, default=False)
    retired: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
