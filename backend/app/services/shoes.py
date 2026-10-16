from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Activity, Shoe
from app.schemas_shoe import ShoeOut
from app.shoe_rules import shoe_usage


def owned_shoe(db: Session, shoe_id: int, uid: str, *, require_active: bool = False) -> Shoe:
    shoe = db.query(Shoe).filter(Shoe.id == shoe_id, Shoe.user_id == uid).with_for_update().first()
    if not shoe:
        raise HTTPException(status_code=404, detail="Tênis não encontrado para este usuário.")
    if require_active and shoe.retired:
        raise HTTPException(status_code=422, detail="Este tênis está aposentado. Reative-o em Meus tênis ou escolha outro.")
    return shoe


def shoe_output(shoe: Shoe, activity_km: float, runs_count: int) -> ShoeOut:
    return ShoeOut(
        id=shoe.id, name=shoe.name, brand=shoe.brand, model=shoe.model,
        purchase_date=shoe.purchase_date, initial_km=shoe.initial_km, limit_km=shoe.limit_km,
        is_default=shoe.is_default, manually_worn=shoe.manually_worn, retired=shoe.retired,
        runs_count=runs_count,
        **shoe_usage(shoe.initial_km, activity_km, shoe.limit_km, shoe.manually_worn, shoe.retired),
    )


def list_shoes(db: Session, uid: str) -> list[ShoeOut]:
    # Soma as corridas atuais em uma consulta: excluir/reassociar corridas
    # nunca exige consertar um contador persistido nem duplica quilometragem.
    usage = (
        db.query(Activity.shoe_id, func.sum(Activity.distance).label("km"), func.count(Activity.id).label("runs"))
        .filter(Activity.user_id == uid, Activity.shoe_id.is_not(None))
        .group_by(Activity.shoe_id).subquery()
    )
    rows = (
        db.query(Shoe, func.coalesce(usage.c.km, 0), func.coalesce(usage.c.runs, 0))
        .outerjoin(usage, usage.c.shoe_id == Shoe.id)
        .filter(Shoe.user_id == uid)
        .order_by(Shoe.retired, Shoe.is_default.desc(), Shoe.id.desc()).all()
    )
    return [shoe_output(shoe, km, runs) for shoe, km, runs in rows]
