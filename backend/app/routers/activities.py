import traceback
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.activity_rules import MAX_DURATION_PER_DAY_SECONDS
from app.auth import FirebaseUser, get_current_user, require_verified_email
from app.database import get_db
from app.gamification import calculate_run_coins, calculate_xp, get_level_from_xp
from app.listing import MAX_PAGE_SIZE, page_size, visible_to
from app.models import Activity, User
from app.rate_limit import rate_limit
from app.schemas import ActivityCreate, ActivityOut, SaveActivityResult, ToggleLikeIn
from app.services.activity_effects import (
    apply_xp_and_km,
    get_or_create_user,
    update_weekly_km_for_user_groups,
)

router = APIRouter(prefix="/activities", tags=["activities"])


@router.post("", response_model=SaveActivityResult, dependencies=[Depends(rate_limit("activities:create", 10, 600))])
def save_activity(
    payload: ActivityCreate,
    db: Session = Depends(get_db),
    # Fase 1.5: agora que a tela de confirmacao de email existe no frontend
    # (PrivateRoute bloqueia antes de chegar aqui), o backend tambem exige —
    # nunca confiar soh na checagem do client.
    current_user: FirebaseUser = Depends(require_verified_email),
):
    if current_user.uid != payload.user_id:
        raise HTTPException(status_code=403, detail="userId nao corresponde ao usuario autenticado.")

    # Velocidade e rota ja foram checadas no schema (activity_rules); aqui
    # fica o que depende do banco: ninguem corre mais de 24h em 24h.
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    recent_seconds = (
        db.query(func.coalesce(func.sum(Activity.duration_seconds), 0))
        .filter(Activity.user_id == payload.user_id, Activity.created_at >= since)
        .scalar()
    )
    if recent_seconds + payload.duration_seconds > MAX_DURATION_PER_DAY_SECONDS:
        raise HTTPException(status_code=422, detail="Limite de 24h de corrida nas ultimas 24 horas atingido.")

    # print(flush=True) em vez de logging: em pelo menos um ambiente de
    # teste real o uvicorn nao estava imprimindo tracebacks de excecoes
    # convertidas em HTTPException, dificultando diagnosticar bugs assim
    # que exigiu duas rodadas de investigacao. Isso garante visibilidade
    # do erro real independente da config de logging do processo.
    try:
        # Garante que o usuario existe no Postgres antes de inserir a
        # atividade (activities.user_id e foreign key de users.uid) —
        # necessario porque login com Google nunca chama createUserProfile,
        # só o cadastro por email/senha chama.
        get_or_create_user(db, payload.user_id, payload.user_name, payload.user_avatar)
        db.commit()
    except Exception:
        db.rollback()
        print("ERRO AO CRIAR/BUSCAR USUARIO:")
        print(traceback.format_exc(), flush=True)
        raise HTTPException(status_code=500, detail="Erro ao verificar perfil do usuario.")

    xp_gained = calculate_xp(payload.distance, payload.duration_seconds)

    activity = Activity(
        user_id=payload.user_id,
        user_name=payload.user_name,
        user_avatar=payload.user_avatar,
        distance=payload.distance,
        time=payload.time,
        duration_seconds=payload.duration_seconds,
        pace=payload.pace,
        calories=payload.calories,
        type=payload.type,
        likes=[],
        route=[p.model_dump() for p in payload.route] if payload.route else None,
        xp_gained=xp_gained,
    )
    db.add(activity)

    try:
        db.commit()
        db.refresh(activity)
    except Exception as exc:
        db.rollback()
        print("ERRO AO SALVAR ATIVIDADE:")
        print(traceback.format_exc(), flush=True)
        raise HTTPException(status_code=500, detail="Erro ao salvar atividade.") from exc

    xp_update_failed = False
    try:
        apply_xp_and_km(db, payload.user_id, xp_gained, payload.distance, payload.user_name, payload.user_avatar)

        user = db.get(User, payload.user_id)
        run_coins = calculate_run_coins(payload.distance)
        if user and user.pet_species and run_coins > 0:
            user.pet_coins = (user.pet_coins or 0) + run_coins
            db.commit()
    except Exception:
        db.rollback()
        xp_update_failed = True

    try:
        update_weekly_km_for_user_groups(db, payload.user_id, payload.distance)
    except Exception:
        db.rollback()

    return SaveActivityResult(id=activity.id, xp_update_failed=xp_update_failed)


@router.get("/user/{user_id}", response_model=list[ActivityOut])
def get_user_activities(
    user_id: str,
    limit: int | None = 10,
    db: Session = Depends(get_db),
    current_user: FirebaseUser = Depends(get_current_user),
):
    """limit=None retorna todas as corridas do usuario (usado por getUserStats no frontend).

    Bug real encontrado em revisao: private_profile so era respeitado no
    ranking global - as corridas de uma conta privada continuavam visiveis
    por aqui pra qualquer usuario autenticado que soubesse/adivinhasse o uid."""
    target_user = db.get(User, user_id)
    if target_user and target_user.private_profile and current_user.uid != user_id:
        raise HTTPException(status_code=403, detail="Este perfil e privado.")

    q = db.query(Activity).filter(Activity.user_id == user_id).order_by(desc(Activity.created_at))
    if current_user.uid == user_id:
        # O proprio usuario pode pedir tudo: getUserStats soma o historico inteiro.
        if limit is not None:
            q = q.limit(max(1, limit))
    else:
        q = q.limit(page_size(limit if limit is not None else MAX_PAGE_SIZE))
    return q.all()


@router.get("/by-users", response_model=list[ActivityOut])
def get_activities_by_users(
    user_ids: str,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: FirebaseUser = Depends(get_current_user),
):
    """Usado pelo feed de grupo (getGroupActivities) — grupos ainda nao migraram
    do Firestore, mas activities so existem aqui desde a Fase 1."""
    ids = [uid for uid in user_ids.split(",") if uid]
    if not ids:
        return []
    return (
        db.query(Activity)
        .join(User, User.uid == Activity.user_id)
        .filter(Activity.user_id.in_(ids), visible_to(current_user.uid))
        .order_by(desc(Activity.created_at))
        .limit(page_size(limit))
        .all()
    )


@router.get("/feed", response_model=list[ActivityOut])
def get_feed(
    limit: int = 10,
    before_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: FirebaseUser = Depends(get_current_user),
):
    """Substitui subscribeToFeed (onSnapshot) + loadMoreActivities (cursor).

    Real-time via WebSocket fica para a Fase 2 do plano; por enquanto o
    frontend faz polling curto ou refetch manual nesse endpoint.
    """
    q = (
        db.query(Activity)
        .join(User, User.uid == Activity.user_id)
        .filter(visible_to(current_user.uid))
        .order_by(desc(Activity.id))
    )
    if before_id is not None:
        q = q.filter(Activity.id < before_id)
    return q.limit(page_size(limit)).all()


@router.post("/{activity_id}/like", dependencies=[Depends(rate_limit("activities:like", 60, 60))])
def toggle_like(
    activity_id: int,
    payload: ToggleLikeIn,
    db: Session = Depends(get_db),
    current_user: FirebaseUser = Depends(get_current_user),
):
    activity = db.get(Activity, activity_id)
    if not activity:
        raise HTTPException(status_code=404, detail="Atividade nao encontrada.")

    likes = list(activity.likes or [])
    if payload.is_liked:
        if current_user.uid in likes:
            likes.remove(current_user.uid)
    else:
        if current_user.uid not in likes:
            likes.append(current_user.uid)
    activity.likes = likes
    db.commit()
    return {"likes": likes}


@router.delete("/{activity_id}", dependencies=[Depends(rate_limit("activities:delete", 30, 60))])
def delete_activity(
    activity_id: int,
    db: Session = Depends(get_db),
    current_user: FirebaseUser = Depends(get_current_user),
):
    activity = db.get(Activity, activity_id)
    if not activity or activity.user_id != current_user.uid:
        raise HTTPException(status_code=404, detail="Corrida nao encontrada para este usuario.")

    db.delete(activity)
    db.commit()

    _recompute_user_totals(db, current_user.uid)
    return {"deleted": True}


@router.delete("/user/{user_id}/all", dependencies=[Depends(rate_limit("activities:delete-all", 3, 3600))])
def delete_all_user_activities(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: FirebaseUser = Depends(get_current_user),
):
    if current_user.uid != user_id:
        raise HTTPException(status_code=403, detail="So e possivel apagar as proprias corridas.")

    count = db.query(Activity).filter(Activity.user_id == user_id).delete()

    user = db.get(User, user_id)
    if user:
        user.total_xp = 0
        user.monthly_km = 0
        user.level = "Iniciante"
        user.last_updated = datetime.now(timezone.utc)

    db.commit()
    return {"deleted_count": count}


def _recompute_user_totals(db: Session, user_id: str) -> None:
    """Port do recalculo em deleteUserActivity: soma XP/km restantes apos apagar 1 corrida."""

    remaining = db.query(Activity).filter(Activity.user_id == user_id).all()
    current_month = datetime.now(timezone.utc).strftime("%Y-%m")

    total_xp = 0
    monthly_km = 0.0
    for activity in remaining:
        activity_xp = activity.xp_gained or calculate_xp(activity.distance, activity.duration_seconds)
        total_xp += activity_xp
        if activity.created_at and activity.created_at.strftime("%Y-%m") == current_month:
            monthly_km += activity.distance

    user = db.get(User, user_id)
    if user:
        user.total_xp = total_xp
        user.monthly_km = round(monthly_km, 2)
        user.monthly_km_month = current_month
        user.level = get_level_from_xp(total_xp)
        user.last_updated = datetime.now(timezone.utc)
        db.commit()
