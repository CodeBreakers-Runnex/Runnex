"""Credito e estorno de pacotes de RunCoins.

Toda entrada de dinheiro passa por aqui, venha do modo de teste ou (no
futuro) do webhook do Google Play/RevenueCat, para que as duas regras
valham sempre:
  1. a mesma transacao nunca credita duas vezes;
  2. o numero de moedas vem do catalogo do servidor (COIN_PACKS).
"""

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import CoinPurchase, User
from app.pet_catalog import COIN_PACKS
from app.time_utils import utcnow


def credit_purchase(db: Session, user_id: str, pack_id: str, provider: str, transaction_id: str) -> CoinPurchase:
    if pack_id not in COIN_PACKS:
        raise HTTPException(status_code=400, detail="Pacote invalido.")

    existing = db.scalar(
        select(CoinPurchase).where(CoinPurchase.provider == provider, CoinPurchase.transaction_id == transaction_id)
    )
    if existing:
        if existing.user_id != user_id:
            raise HTTPException(status_code=409, detail="Transacao pertence a outro usuario.")
        return existing  # reenvio: nao credita de novo

    # FOR UPDATE: duas compras simultaneas nao podem ler o mesmo saldo.
    user = db.get(User, user_id, with_for_update=True)
    if not user:
        raise HTTPException(status_code=404, detail="Perfil nao encontrado.")

    coins = COIN_PACKS[pack_id]
    purchase = CoinPurchase(
        user_id=user_id, pack_id=pack_id, coins=coins, provider=provider, transaction_id=transaction_id
    )
    db.add(purchase)
    user.pet_coins = (user.pet_coins or 0) + coins
    db.commit()
    db.refresh(purchase)
    return purchase


def refund_purchase(db: Session, provider: str, transaction_id: str) -> CoinPurchase | None:
    """Estorna as moedas de uma compra reembolsada. O saldo pode ficar
    negativo se o usuario ja gastou: assim comprar, gastar e pedir
    reembolso nao rende item de graca (com saldo negativo nao se compra nada)."""
    purchase = db.scalar(
        select(CoinPurchase).where(CoinPurchase.provider == provider, CoinPurchase.transaction_id == transaction_id)
    )
    if not purchase or purchase.status == "refunded":
        return purchase

    user = db.get(User, purchase.user_id, with_for_update=True)
    if user:
        user.pet_coins = (user.pet_coins or 0) - purchase.coins
    purchase.status = "refunded"
    purchase.refunded_at = utcnow()
    db.commit()
    db.refresh(purchase)
    return purchase
