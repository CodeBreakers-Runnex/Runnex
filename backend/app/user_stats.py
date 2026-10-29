"""Estatisticas do proprio usuario (Home, Perfil, Dashboard, Pet, Conquistas).

Antes o app baixava TODAS as corridas (limit=100000, com rota e amostras) e
somava no celular. Agora o servidor le so as colunas pequenas e devolve os
numeros prontos; o app apenas formata. As regras sao as mesmas do antigo
getUserStats em src/services/activitiesApi.ts.
"""

from datetime import date, datetime, timedelta, timezone

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.models import Activity

DAY_LABELS = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"]  # date.weekday(): 0 = segunda


def _local(moment: datetime, offset: timedelta) -> datetime:
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return moment.astimezone(timezone.utc) + offset


def current_streak(active_days: set[date], today: date) -> int:
    """Dias seguidos com corrida terminando hoje ou, se hoje ainda nao teve, ontem."""
    cursor = today if today in active_days else today - timedelta(days=1)
    streak = 0
    while cursor in active_days:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def compute_user_stats(rows, now: datetime, utc_offset_minutes: int) -> dict:
    """rows: (distance, duration_seconds, calories, created_at), em qualquer ordem."""
    offset = timedelta(minutes=utc_offset_minutes)
    today = _local(now, offset).date()
    week_days = [today - timedelta(days=i) for i in range(6, -1, -1)]
    week_km = {day: 0.0 for day in week_days}

    total_km = 0.0
    total_seconds = 0
    total_calories = 0
    runs_count = 0
    has_hour_long_run = False
    has_sub_10k_run = False
    dawn_runs = 0
    night_runs = 0
    active_days: set[date] = set()

    for distance, duration_seconds, calories, created_at in rows:
        distance = float(distance or 0)
        duration_seconds = int(duration_seconds or 0)
        total_km += distance
        total_seconds += duration_seconds
        total_calories += int(calories or 0)
        runs_count += 1

        if duration_seconds >= 3600:
            has_hour_long_run = True
        if distance >= 10 and 0 < duration_seconds <= 3600:
            has_sub_10k_run = True

        if created_at is None:
            continue
        local = _local(created_at, offset)
        active_days.add(local.date())
        if local.date() in week_km:
            week_km[local.date()] += distance
        # Amanhecer: 4h-7h. Noite: 20h-4h (conquistas "10 amanheceres"/"10 noites").
        if 4 <= local.hour < 7:
            dawn_runs += 1
        elif local.hour >= 20 or local.hour < 4:
            night_runs += 1

    weekly_data = [{"day": DAY_LABELS[day.weekday()], "km": round(week_km[day], 2)} for day in week_days]

    return {
        "totalKm": total_km,
        "runsCount": runs_count,
        "totalSeconds": total_seconds,
        "totalCalories": total_calories,
        "currentStreak": current_streak(active_days, today),
        "weeklyTotalKm": round(sum(day["km"] for day in weekly_data), 2),
        "weeklyData": weekly_data,
        "hasHourLongRun": has_hour_long_run,
        "hasSub10kRun": has_sub_10k_run,
        "dawnRunsCount": dawn_runs,
        "nightRunsCount": night_runs,
    }


def user_stats(db: Session, user_id: str, now: datetime, utc_offset_minutes: int) -> dict:
    base = db.query(Activity).filter(Activity.user_id == user_id)
    rows = base.with_entities(
        Activity.distance, Activity.duration_seconds, Activity.calories, Activity.created_at
    ).all()
    stats = compute_user_stats(rows, now, utc_offset_minutes)
    # Mesma regra do app: a mais recente, e a mais longa (empate: a mais recente).
    stats["lastActivity"] = base.order_by(desc(Activity.created_at), desc(Activity.id)).first()
    stats["bestActivity"] = base.order_by(
        desc(Activity.distance), desc(Activity.created_at), desc(Activity.id)
    ).first()
    return stats
