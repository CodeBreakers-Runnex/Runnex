import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import FirebaseUser, require_verified_email
from app.config import settings
from app.database import get_db
from app.models import CoinPurchase, User
from app.pet_catalog import COIN_PACKS
from app.rate_limit import rate_limit
from app.services.coin_purchases import credit_purchase

router = APIRouter(tags=["coins"])


class MockPurchaseIn(BaseModel):
    pack_id: str = Field(validation_alias="packId")


@router.get("/coins/packs")
def list_packs():
    return {
        "packs": [{"id": pack_id, "coins": coins} for pack_id, coins in COIN_PACKS.items()],
        "mockPurchases": settings.coin_mock_purchases,
    }


@router.post("/users/{user_id}/coins/mock-purchase", dependencies=[Depends(rate_limit("coins", 20, 60))])
def mock_purchase(
    user_id: str,
    payload: MockPurchaseIn,
    db: Session = Depends(get_db),
    current_user: FirebaseUser = Depends(require_verified_email),
):
    """Compra simulada: credita o pacote sem cobrar. Desligada por padrao
    (COIN_MOCK_PURCHASES=true no ambiente para ligar)."""
    if not settings.coin_mock_purchases:
        raise HTTPException(status_code=403, detail="Compra de RunCoins ainda nao disponivel.")
    if current_user.uid != user_id:
        raise HTTPException(status_code=403, detail="So e possivel comprar para a propria conta.")

    purchase = credit_purchase(db, user_id, payload.pack_id, "mock", f"mock-{uuid.uuid4()}")
    user = db.get(User, user_id)
    return {"petCoins": user.pet_coins if user else 0, "credited": purchase.coins}


@router.get("/users/{user_id}/coins/purchases")
def list_purchases(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: FirebaseUser = Depends(require_verified_email),
):
    if current_user.uid != user_id:
        raise HTTPException(status_code=403, detail="Historico de outra conta.")
    rows = db.scalars(
        select(CoinPurchase).where(CoinPurchase.user_id == user_id).order_by(CoinPurchase.created_at.desc()).limit(50)
    ).all()
    return [
        {
            "id": row.id,
            "packId": row.pack_id,
            "coins": row.coins,
            "provider": row.provider,
            "status": row.status,
            "createdAt": row.created_at.isoformat(),
        }
        for row in rows
    ]
