from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.time_utils import utcnow


class ChatbotProfile(Base):
    """Memoria do treinador virtual por usuario (EstadoConversa em
    app/chatbot_logic.py). Corridas, nome e meta semanal nao ficam aqui: o
    chatbot le de activities e users a cada mensagem, entao nunca diverge do
    que o resto do app mostra."""

    __tablename__ = "chatbot_profiles"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.uid", ondelete="CASCADE"), primary_key=True)

    pace_informado: Mapped[float | None] = mapped_column(nullable=True)
    distancia_frequente: Mapped[float | None] = mapped_column(nullable=True)
    objetivo_principal: Mapped[str | None] = mapped_column(String, nullable=True)
    nivel: Mapped[str | None] = mapped_column(String, nullable=True)
    aguardando_aprofundamento: Mapped[bool] = mapped_column(Boolean, default=False)
    ultimo_topico_explicado: Mapped[str | None] = mapped_column(String, nullable=True)
    # {pergunta_normalizada: {"resposta": str, "frequencia": int}} — lido e
    # gravado inteiro a cada mensagem, por isso JSON e nao tabela propria.
    respostas_aprendidas: Mapped[dict] = mapped_column(JSON, default=dict)

    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
