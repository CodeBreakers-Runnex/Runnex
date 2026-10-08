from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import FirebaseUser, get_current_user, require_verified_email
from app.database import get_db
from app.models import Shoe, User
from app.rate_limit import rate_limit
from app.schemas_shoe import ShoeInput, ShoeOut
from app.services.activity_effects import get_or_create_user
from app.services.shoes import list_shoes, owned_shoe

router = APIRouter(prefix="/shoes", tags=["shoes"])


@router.get("", response_model=list[ShoeOut])
def get_shoes(db: Session = Depends(get_db), current_user: FirebaseUser = Depends(get_current_user)):
    return list_shoes(db, current_user.uid)


def lock_owner(db: Session, uid: str) -> None:
    get_or_create_user(db, uid, "Corredor", None)
    db.flush()
    # Serializa mudanças do tênis padrão feitas em duas abas/dispositivos.
    db.query(User).filter(User.uid == uid).with_for_update().one()


def apply_input(db: Session, shoe: Shoe, payload: ShoeInput, uid: str) -> None:
    values = payload.model_dump()
    if values["retired"]:
        values["is_default"] = False
    if values["is_default"]:
        db.query(Shoe).filter(Shoe.user_id == uid, Shoe.is_default.is_(True)).update({Shoe.is_default: False})
    for key, value in values.items():
        setattr(shoe, key, value)


@router.post("", response_model=ShoeOut, status_code=201, dependencies=[Depends(rate_limit("shoes:create", 30, 3600))])
def create_shoe(payload: ShoeInput, db: Session = Depends(get_db), current_user: FirebaseUser = Depends(require_verified_email)):
    lock_owner(db, current_user.uid)
    shoe = Shoe(user_id=current_user.uid)
    apply_input(db, shoe, payload, current_user.uid)
    db.add(shoe)
    db.commit()
    return next(item for item in list_shoes(db, current_user.uid) if item.id == str(shoe.id))


@router.put("/{shoe_id}", response_model=ShoeOut, dependencies=[Depends(rate_limit("shoes:update", 60, 60))])
def update_shoe(shoe_id: int, payload: ShoeInput, db: Session = Depends(get_db), current_user: FirebaseUser = Depends(require_verified_email)):
    lock_owner(db, current_user.uid)
    shoe = owned_shoe(db, shoe_id, current_user.uid)
    apply_input(db, shoe, payload, current_user.uid)
    db.commit()
    return next(item for item in list_shoes(db, current_user.uid) if item.id == str(shoe.id))
