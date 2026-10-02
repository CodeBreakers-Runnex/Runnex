from datetime import datetime

from sqlalchemy import ARRAY, DateTime, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.time_utils import utcnow


class Activity(Base):
    __tablename__ = "activities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.uid", ondelete="CASCADE"), nullable=False)

    user_name: Mapped[str] = mapped_column(String, nullable=False)
    user_avatar: Mapped[str | None] = mapped_column(String, nullable=True)
    distance: Mapped[float] = mapped_column(nullable=False)
    time: Mapped[str] = mapped_column(String, nullable=False)
    duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    pace: Mapped[str] = mapped_column(String, nullable=False)
    calories: Mapped[int | None] = mapped_column(Integer, nullable=True)
    type: Mapped[str] = mapped_column(String, nullable=False)
    likes: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    # Lista de {lat, lng} — mantido como JSON, não normalizado em tabela própria
    # (mesma decisão do Firestore: rota é lida/escrita inteira, nunca por ponto).
    route: Mapped[list[dict] | None] = mapped_column(JSON, nullable=True)
    xp_gained: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user = relationship("User", back_populates="activities")
