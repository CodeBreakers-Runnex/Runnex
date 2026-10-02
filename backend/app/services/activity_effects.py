"""Efeitos colaterais disparados ao salvar uma corrida (POST /activities):
garantir que o usuario existe, aplicar XP/km ao perfil e atualizar o km
semanal dos grupos dos quais ele participa.

Antes vivia espalhado por routers/users.py e routers/groups.py, com
activities.py importando funcao de outro router (from app.routers.groups
import ...) em vez de um modulo de servico dedicado - funcionava, mas so
activities.py chamava essas funcoes, entao a dependencia cruzada entre
routers nao tinha motivo para existir.
"""

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.gamification import get_level_from_xp
from app.models import Group, GroupMember, User


def _current_month() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


def get_or_create_user(db: Session, user_id: str, display_name: str, photo_url: str | None) -> User:
    """Bug real encontrado em teste manual: login com Google nunca chamava
    createUserProfile (só o cadastro por email/senha chamava) — no Firestore
    isso nunca quebrava nada, mas activities.user_id agora é uma foreign key
    de verdade para users.uid, e a primeira corrida de uma conta Google
    violava a constraint antes mesmo de chegar em apply_xp_and_km. Por isso
    isso precisa ser chamado logo no inicio de POST /activities, nao só aqui."""
    user = db.get(User, user_id)
    if not user:
        user = User(uid=user_id, display_name=display_name, photo_url=photo_url)
        db.add(user)
        db.flush()
    return user


def apply_xp_and_km(
    db: Session,
    user_id: str,
    xp_amount: int,
    km_amount: float,
    display_name: str,
    photo_url: str | None,
) -> User:
    """Port de updateUserXP (database.ts) — reset mensal de monthlyKm incluso."""

    user = get_or_create_user(db, user_id, display_name, photo_url)
    current_month = _current_month()
    if user.monthly_km_month != current_month:
        user.monthly_km = 0
        user.monthly_km_month = current_month

    user.total_xp = (user.total_xp or 0) + xp_amount
    user.monthly_km = round((user.monthly_km or 0) + km_amount, 2)
    user.level = get_level_from_xp(user.total_xp)
    user.last_updated = datetime.now(timezone.utc)

    db.commit()
    db.refresh(user)
    return user


def update_weekly_km_for_user_groups(db: Session, user_id: str, distance_km: float) -> None:
    """Port de addDistanceToUserGroups: soma a distancia ao km semanal de
    cada grupo do qual o usuario participa, resetando quando a semana muda.
    Chamado direto por POST /activities — nao precisa mais filtrar grupos
    fallback, pois esses nunca tem linha em group_members."""
    if distance_km <= 0:
        return

    now = datetime.now(timezone.utc)
    iso_year, iso_week, _ = now.isocalendar()
    current_week = f"{iso_year}-W{iso_week:02d}"

    group_ids = [gm.group_id for gm in db.query(GroupMember).filter(GroupMember.user_id == user_id).all()]
    if not group_ids:
        return

    for group in db.query(Group).filter(Group.id.in_(group_ids)).all():
        same_week = group.weekly_km_week == current_week
        previous_km = group.weekly_km if same_week else 0
        group.weekly_km = min(round(previous_km + distance_km, 2), 100000)
        group.weekly_km_week = current_week
        group.updated_at = now
    db.commit()
