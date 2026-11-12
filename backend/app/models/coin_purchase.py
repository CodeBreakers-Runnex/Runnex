from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.time_utils import utcnow


class CoinPurchase(Base):
    """Uma compra de pacote de RunCoins.

    (provider, transaction_id) e unico: a loja/RevenueCat pode reenviar o
    mesmo aviso varias vezes, e cada transacao so pode creditar uma vez.
    """

    __tablename__ = "coin_purchases"
    __table_args__ = (UniqueConstraint("provider", "transaction_id", name="uq_coin_purchases_provider_tx"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.uid", ondelete="CASCADE"), index=True)
    pack_id: Mapped[str] = mapped_column(String(64))
    coins: Mapped[int] = mapped_column(Integer)
    # "mock" (modo de teste) | "google_play" (futuro)
    provider: Mapped[str] = mapped_column(String(32))
    transaction_id: Mapped[str] = mapped_column(String(200))
    # "credited" | "refunded"
    status: Mapped[str] = mapped_column(String(16), default="credited")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    refunded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
