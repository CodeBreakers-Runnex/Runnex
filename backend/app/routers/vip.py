"""Plano VIP sem pagamento.

Nao ha cobranca nem expiracao: so o modo de teste do servidor
(VIP_MOCK_ACTIVATION=true) liga e desliga a marca, para demonstracao. Com a
flag desligada (padrao) ninguem consegue virar VIP. Ver docs/MONETIZACAO.md.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import FirebaseUser, get_current_user, require_verified_email
from app.config import settings
from app.database import get_db
from app.models import User
from app.rate_limit import rate_limit

router = APIRouter(tags=["vip"])


@router.get("/vip")
def vip_info(_: FirebaseUser = Depends(get_current_user)):
    return {"mockActivation": settings.vip_mock_activation}


def _set_vip(db: Session, user_id: str, current_user: FirebaseUser, value: bool) -> dict:
    if not settings.vip_mock_activation:
        raise HTTPException(status_code=403, detail="Plano VIP ainda nao disponivel.")
    if current_user.uid != user_id:
        raise HTTPException(status_code=403, detail="So e possivel alterar a propria conta.")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Perfil nao encontrado.")
    user.is_vip = value
    db.commit()
    return {"isVip": user.is_vip}


@router.post("/users/{user_id}/vip/mock-activate", dependencies=[Depends(rate_limit("vip", 20, 60))])
def mock_activate(
    user_id: str, db: Session = Depends(get_db), current_user: FirebaseUser = Depends(require_verified_email)
):
    return _set_vip(db, user_id, current_user, True)


@router.post("/users/{user_id}/vip/mock-deactivate", dependencies=[Depends(rate_limit("vip", 20, 60))])
def mock_deactivate(
    user_id: str, db: Session = Depends(get_db), current_user: FirebaseUser = Depends(require_verified_email)
):
    return _set_vip(db, user_id, current_user, False)
