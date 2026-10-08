from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models.activity import Activity
from app.models.sleep import RecoveryPreferences, SleepCheckIn, SleepImportExclusion, SleepSession
from app.schemas_sleep import RETENTION_DAYS, SLEEP_CONSENT_VERSION
from app.time_utils import utcnow


def preferences(db: Session, uid: str, *, lock: bool = False) -> RecoveryPreferences:
    db.execute(insert(RecoveryPreferences).values(user_id=uid).on_conflict_do_nothing(index_elements=["user_id"]))
    query = db.query(RecoveryPreferences).filter_by(user_id=uid)
    return (query.with_for_update() if lock else query).populate_existing().one()


def purge_old_data(db: Session, now: datetime | None = None) -> None:
    cutoff = (now or utcnow()) - timedelta(days=RETENTION_DAYS)
    db.execute(delete(SleepSession).where(SleepSession.end_time < cutoff))
    # Um dia adicional cobre os fusos UTC-12 a UTC+14.
    db.execute(delete(SleepCheckIn).where(SleepCheckIn.day < cutoff.date() - timedelta(days=1)))
    db.execute(delete(SleepImportExclusion).where(SleepImportExclusion.created_at < cutoff))


def wake_date(end: datetime, offset: int | None, zone: str) -> date:
    local_zone = timezone(timedelta(minutes=offset)) if offset is not None else ZoneInfo(zone)
    return end.astimezone(local_zone).date()


def settings_out(prefs: RecoveryPreferences) -> dict:
    return {
        "goalMinutes": prefs.goal_minutes,
        "timezone": prefs.timezone,
        "preferredOrigin": prefs.preferred_origin,
        "consented": prefs.consent_version == SLEEP_CONSENT_VERSION,
        "consentVersion": prefs.consent_version,
        "consentedAt": prefs.consented_at,
        "healthConnectEnabled": prefs.health_connect_enabled,
        "syncGeneration": prefs.sync_generation,
        "lastSyncedAt": prefs.last_synced_at,
    }


def session_out(record: SleepSession) -> dict:
    return {
        "id": str(record.id),
        "source": record.source,
        "origin": record.origin,
        "originLabel": "Registro manual" if record.source == "manual" else record.origin_label or "Health Connect",
        "externalId": record.external_id,
        "sourceModifiedAt": record.source_modified_at,
        "startTime": record.start_time,
        "endTime": record.end_time,
        "wakeDate": record.wake_date,
        "endOffsetMinutes": record.end_offset_minutes,
        "sleepSeconds": record.sleep_seconds,
        "periodSeconds": int((record.end_time - record.start_time).total_seconds()),
        "kind": record.kind,
    }


def checkin_out(record: SleepCheckIn) -> dict:
    return {"date": record.day, "quality": record.quality, "fatigue": record.fatigue}


def primary_session(records: list[SleepSession], preferred_origin: str | None) -> SleepSession | None:
    mains = [r for r in records if r.kind == "main"]
    manual = [r for r in mains if r.source == "manual"]
    preferred = [r for r in mains if r.origin == preferred_origin] if preferred_origin else []
    candidates = manual or preferred or mains
    if not candidates:
        return None
    # Uma única sessão principal evita contar o mesmo episódio de dois relógios.
    return max(candidates, key=lambda r: ((r.end_time - r.start_time).total_seconds(), r.end_time, r.id))


def day_summary(day: date, records: list[SleepSession], checkin: SleepCheckIn | None, prefs: RecoveryPreferences) -> dict:
    primary = primary_session(records, prefs.preferred_origin)
    minutes = primary.sleep_seconds / 60 if primary is not None and primary.sleep_seconds is not None else None
    signals = []
    reasons = []
    if minutes is not None and prefs.goal_minutes is not None and minutes < prefs.goal_minutes:
        signals.append("below_goal")
        reasons.append("O tempo de sono informado ou estimado ficou abaixo da sua meta pessoal.")
    if checkin is not None and checkin.fatigue is not None and checkin.fatigue >= 4:
        signals.append("fatigue")
        reasons.append("Você informou cansaço alto no check-in deste dia.")
    if minutes is None:
        signals.append("missing_sleep")
        reasons.append("Ainda não há uma estimativa de tempo dormido para este dia." if primary is not None else "Não há registro de sono principal para este dia.")
    if prefs.goal_minutes is None:
        reasons.append("Configure sua meta pessoal para comparar a duração do sono.")
    status = "attention" if "below_goal" in signals or "fatigue" in signals else "insufficient" if minutes is None or checkin is None else "no_alerts"
    return {
        "date": day,
        "mainSession": session_out(primary) if primary else None,
        "sleepMinutes": round(minutes, 1) if minutes is not None else None,
        "napCount": sum(1 for r in records if r.kind == "nap" and r.source == "manual"),
        "checkIn": checkin_out(checkin) if checkin else None,
        "status": status,
        "signals": signals,
        "reasons": reasons,
    }


def overview(db: Session, uid: str, prefs: RecoveryPreferences, days: int) -> dict:
    now = utcnow()
    zone = ZoneInfo(prefs.timezone)
    today = now.astimezone(zone).date()
    first = today - timedelta(days=max(days, 14) - 1)
    records = db.query(SleepSession).filter(SleepSession.user_id == uid, SleepSession.wake_date >= first, SleepSession.wake_date <= today).order_by(SleepSession.end_time.desc(), SleepSession.id.desc()).all()
    checkins = {r.day: r for r in db.query(SleepCheckIn).filter(SleepCheckIn.user_id == uid, SleepCheckIn.day >= first, SleepCheckIn.day <= today).all()}
    by_day = defaultdict(list)
    for record in records:
        by_day[record.wake_date].append(record)
    history = [day_summary(today - timedelta(days=i), by_day[today - timedelta(days=i)], checkins.get(today - timedelta(days=i)), prefs) for i in range(max(days, 14))]
    trend_values = [d["sleepMinutes"] for d in history[:14] if d["sleepMinutes"] is not None]
    visible_ids = {r.id for r in records if r.wake_date >= today - timedelta(days=days - 1)}
    window_start = datetime.combine(today - timedelta(days=6), time.min, zone).astimezone(timezone.utc)
    prior_start = datetime.combine(today - timedelta(days=13), time.min, zone).astimezone(timezone.utc)
    activities = db.query(Activity).filter(Activity.user_id == uid, Activity.created_at >= prior_start, Activity.created_at <= now).all()
    current = [r for r in activities if r.created_at >= window_start]
    previous = [r for r in activities if r.created_at < window_start]
    return {
        "settings": settings_out(prefs),
        "today": history[0],
        "history": history[:days],
        "sessions": [session_out(r) for r in records if r.id in visible_ids],
        "origins": sorted({r.origin for r in records if r.source == "health_connect"}),
        "trend": {"validDays": len(trend_values), "requiredDays": 7, "windowDays": 14, "averageMinutes": round(sum(trend_values) / len(trend_values), 1) if len(trend_values) >= 7 else None},
        "training": {
            "currentKm": round(sum(r.distance for r in current), 2),
            "currentMinutes": round(sum(r.duration_seconds for r in current) / 60, 1),
            "previousKm": round(sum(r.distance for r in previous), 2),
            "previousMinutes": round(sum(r.duration_seconds for r in previous) / 60, 1),
        },
        "algorithmVersion": "sleep-signals-v1",
    }
