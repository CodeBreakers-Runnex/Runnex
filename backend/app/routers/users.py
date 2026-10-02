from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.auth import FirebaseUser, get_current_user
from app.database import get_db
from app.listing import MAX_PAGE_SIZE, page_size, visible_to
from app.models import User
from app.rate_limit import rate_limit
from app.schemas import UserProfileCreate, UserProfileOut
from app.services.account_deletion import delete_account

router = APIRouter(prefix="/users", tags=["users"])


# Rotas com path estatico (by-ids, ranking/global) precisam vir ANTES de
# /{user_id} — senao o FastAPI casa "by-ids" e "ranking" como se fossem um
# user_id literal, ja que rotas sao resolvidas na ordem de declaracao.


@router.get("/by-ids", response_model=list[UserProfileOut])
def get_users_by_ids(
    ids: str, db: Session = Depends(get_db), current_user: FirebaseUser = Depends(get_current_user)
):
    """Usado pelo ranking de grupo (getGroupLeaderboard) — grupos ainda nao
    migraram do Firestore, mas perfis so existem aqui desde a Fase 1."""
    uid_list = [uid for uid in ids.split(",") if uid]
    if not uid_list:
        return []
    return db.query(User).filter(User.uid.in_(uid_list[:MAX_PAGE_SIZE]), visible_to(current_user.uid)).all()


@router.get("/ranking/global", response_model=list[UserProfileOut])
def get_global_ranking(
    limit: int = 10, db: Session = Depends(get_db), _: FirebaseUser = Depends(get_current_user)
):
    users = (
        db.query(User)
        .filter(User.private_profile.is_(False))
        .order_by(desc(User.total_xp))
        .limit(page_size(limit))
        .all()
    )
    return users


@router.get("/{user_id}", response_model=UserProfileOut)
def get_user_profile(
    user_id: str, db: Session = Depends(get_db), current_user: FirebaseUser = Depends(get_current_user)
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Perfil nao encontrado.")
    # Bug real encontrado em revisao: private_profile so era respeitado no
    # ranking global (get_global_ranking) - qualquer usuario autenticado
    # conseguia ver o perfil completo de uma conta marcada como privada
    # direto por aqui, sabendo/adivinhando o uid.
    if user.private_profile and current_user.uid != user_id:
        raise HTTPException(status_code=403, detail="Este perfil e privado.")
    return user


@router.put("/{user_id}", response_model=UserProfileOut, dependencies=[Depends(rate_limit("users:update", 20, 60))])
def create_or_update_user_profile(
    user_id: str,
    payload: UserProfileCreate,
    db: Session = Depends(get_db),
    current_user: FirebaseUser = Depends(get_current_user),
):
    if current_user.uid != user_id:
        raise HTTPException(status_code=403, detail="So e possivel editar o proprio perfil.")

    user = db.get(User, user_id)
    if not user:
        user = User(uid=user_id, display_name=payload.display_name or "Corredor")
        db.add(user)

    if payload.display_name is not None:
        user.display_name = payload.display_name
    if payload.photo_url is not None:
        user.photo_url = payload.photo_url
    if payload.terms_version:
        user.terms_version = payload.terms_version
        user.terms_accepted_at = datetime.now(timezone.utc)
    if payload.bio is not None:
        user.bio = payload.bio
    if payload.location is not None:
        user.location = payload.location
    if payload.onboarded is not None:
        user.onboarded = payload.onboarded
    if payload.weekly_goal_km is not None:
        user.weekly_goal_km = payload.weekly_goal_km
    if payload.private_profile is not None:
        user.private_profile = payload.private_profile

    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=204, dependencies=[Depends(rate_limit("users:delete", 3, 3600))])
def delete_user_account(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: FirebaseUser = Depends(get_current_user),
):
    """Apaga os dados do usuario no Postgres. O login (Firebase Auth) e
    apagado pelo proprio app logo em seguida - o backend nao usa Admin SDK."""
    if current_user.uid != user_id:
        raise HTTPException(status_code=403, detail="So e possivel excluir a propria conta.")
    delete_account(db, user_id)
