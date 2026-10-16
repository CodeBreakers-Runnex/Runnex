from datetime import date, timedelta, timezone
from uuid import uuid4
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.auth import FirebaseUser, require_verified_email
from app.database import get_db
from app.models import User
from app.models.sleep import SleepCheckIn, SleepImportExclusion, SleepSession
from app.rate_limit import rate_limit
from app.schemas_sleep import RETENTION_DAYS, SLEEP_CONSENT_VERSION, RecoveryPreferencesInput, SleepCheckInInput, SleepConnectionInput, SleepConsentInput, SleepImportInput, SleepSessionInput
from app.services.sleep import checkin_out, overview, preferences, purge_old_data, session_out, settings_out, wake_date
from app.time_utils import utcnow

router = APIRouter(prefix="/recovery", tags=["sleep-recovery"])


def own_preferences(db: Session, user: FirebaseUser, *, consent: bool = False, lock: bool = False):
    if db.get(User, user.uid) is None:
        raise HTTPException(404, "Crie seu perfil antes de registrar sono.")
    prefs = preferences(db, user.uid, lock=lock)
    if consent and prefs.consent_version != SLEEP_CONSENT_VERSION:
        raise HTTPException(403, "Autorize o uso dos dados de sono antes de continuar.")
    return prefs


@router.get("/overview")
def get_overview(days: int = Query(7, ge=7, le=30), db: Session = Depends(get_db), user: FirebaseUser = Depends(require_verified_email)):
    prefs = own_preferences(db, user)
    purge_old_data(db)
    result = overview(db, user.uid, prefs, days)
    db.commit()
    return result


@router.post("/consent", dependencies=[Depends(rate_limit("sleep:consent", 10, 60))])
def consent(payload: SleepConsentInput, db: Session = Depends(get_db), user: FirebaseUser = Depends(require_verified_email)):
    prefs = own_preferences(db, user, lock=True)
    prefs.consent_version = payload.version
    prefs.consented_at = utcnow()
    prefs.timezone = payload.timezone
    db.commit()
    return settings_out(prefs)


@router.put("/preferences")
def update_preferences(payload: RecoveryPreferencesInput, db: Session = Depends(get_db), user: FirebaseUser = Depends(require_verified_email)):
    prefs = own_preferences(db, user, consent=True, lock=True)
    prefs.goal_minutes = payload.goal_minutes
    prefs.timezone = payload.timezone
    prefs.preferred_origin = payload.preferred_origin
    db.commit()
    return settings_out(prefs)


@router.put("/connection")
def connection(payload: SleepConnectionInput, db: Session = Depends(get_db), user: FirebaseUser = Depends(require_verified_email)):
    prefs = own_preferences(db, user, consent=payload.enabled, lock=True)
    if prefs.health_connect_enabled != payload.enabled or not payload.enabled:
        prefs.sync_generation = str(uuid4())
    prefs.health_connect_enabled = payload.enabled
    db.commit()
    return settings_out(prefs)


@router.post("/sleep", status_code=201, dependencies=[Depends(rate_limit("sleep:write", 40, 60))])
def create_sleep(payload: SleepSessionInput, db: Session = Depends(get_db), user: FirebaseUser = Depends(require_verified_email)):
    prefs = own_preferences(db, user, consent=True, lock=True)
    values = payload.model_dump()
    record = SleepSession(user_id=user.uid, source="manual", origin="runnex", wake_date=wake_date(payload.end_time, payload.end_offset_minutes, prefs.timezone), **values)
    db.add(record)
    db.commit()
    return session_out(record)


def own_session(db: Session, uid: str, session_id: int) -> SleepSession:
    record = db.query(SleepSession).filter_by(id=session_id, user_id=uid).first()
    if record is None:
        raise HTTPException(404, "Registro de sono não encontrado.")
    return record


@router.put("/sleep/{session_id}", dependencies=[Depends(rate_limit("sleep:write", 40, 60))])
def update_sleep(session_id: int, payload: SleepSessionInput, db: Session = Depends(get_db), user: FirebaseUser = Depends(require_verified_email)):
    prefs = own_preferences(db, user, consent=True, lock=True)
    record = own_session(db, user.uid, session_id)
    if record.source != "manual":
        raise HTTPException(409, "Para corrigir um sono importado, crie um registro manual para o mesmo dia.")
    for key, value in payload.model_dump().items():
        setattr(record, key, value)
    record.wake_date = wake_date(payload.end_time, payload.end_offset_minutes, prefs.timezone)
    db.commit()
    return session_out(record)


@router.delete("/sleep/{session_id}", status_code=204)
def delete_sleep(session_id: int, db: Session = Depends(get_db), user: FirebaseUser = Depends(require_verified_email)):
    own_preferences(db, user, lock=True)
    record = own_session(db, user.uid, session_id)
    if record.external_id is not None:
        db.execute(insert(SleepImportExclusion).values(user_id=user.uid, external_id=record.external_id).on_conflict_do_nothing(index_elements=["user_id", "external_id"]))
    db.delete(record)
    db.commit()


@router.put("/check-in/{day}")
def check_in(day: date, payload: SleepCheckInInput, db: Session = Depends(get_db), user: FirebaseUser = Depends(require_verified_email)):
    prefs = own_preferences(db, user, consent=True, lock=True)
    today = utcnow().astimezone(ZoneInfo(prefs.timezone)).date()
    if not today - timedelta(days=RETENTION_DAYS) <= day <= today:
        raise HTTPException(422, "Informe um dia dos últimos 90 dias, sem data futura.")
    statement = insert(SleepCheckIn).values(user_id=user.uid, day=day, **payload.model_dump())
    db.execute(statement.on_conflict_do_update(index_elements=["user_id", "day"], set_=payload.model_dump()))
    db.commit()
    return checkin_out(db.query(SleepCheckIn).filter_by(user_id=user.uid, day=day).one())


@router.delete("/check-in/{day}", status_code=204)
def delete_check_in(day: date, db: Session = Depends(get_db), user: FirebaseUser = Depends(require_verified_email)):
    own_preferences(db, user, lock=True)
    db.execute(delete(SleepCheckIn).where(SleepCheckIn.user_id == user.uid, SleepCheckIn.day == day))
    db.commit()


@router.post("/import", dependencies=[Depends(rate_limit("sleep:import", 60, 60))])
def import_sleep(payload: SleepImportInput, db: Session = Depends(get_db), user: FirebaseUser = Depends(require_verified_email)):
    prefs = own_preferences(db, user, consent=True, lock=True)
    if not prefs.health_connect_enabled or prefs.sync_generation != payload.sync_generation:
        raise HTTPException(409, "A conexão mudou. Atualize a tela antes de sincronizar.")
    purge_old_data(db)
    excluded = {r.external_id for r in db.query(SleepImportExclusion).filter_by(user_id=user.uid).all()}
    # SDK fornece somente o ID nos eventos de exclusão. Nunca tocar nos manuais.
    deleted_ids = set(payload.deleted_ids)
    db.execute(delete(SleepSession).where(SleepSession.user_id == user.uid, SleepSession.source == "health_connect", SleepSession.external_id.in_(deleted_ids)))
    imported = 0
    for item in payload.records:
        if item.external_id in excluded or item.external_id in deleted_ids:
            continue
        values = item.model_dump()
        values["start_time"] = item.start_time.astimezone(timezone.utc)
        values["end_time"] = item.end_time.astimezone(timezone.utc)
        values["source_modified_at"] = item.source_modified_at.astimezone(timezone.utc)
        values.update(user_id=user.uid, source="health_connect", wake_date=wake_date(item.end_time, item.end_offset_minutes, prefs.timezone))
        statement = insert(SleepSession).values(**values)
        updates = {key: getattr(statement.excluded, key) for key in values if key not in ("user_id", "origin", "external_id", "source")}
        result = db.execute(statement.on_conflict_do_update(index_elements=["user_id", "origin", "external_id"], set_=updates, where=SleepSession.source_modified_at <= statement.excluded.source_modified_at))
        imported += result.rowcount
    if payload.snapshot_start is not None:
        # Snapshot completo após perda/expiração do token: reconciliar ausências
        # apenas na janela efetivamente lida, sem apagar histórico mais antigo.
        ids = {r.external_id for r in payload.records}
        db.execute(delete(SleepSession).where(SleepSession.user_id == user.uid, SleepSession.source == "health_connect", SleepSession.start_time >= payload.snapshot_start, SleepSession.start_time < payload.snapshot_end, SleepSession.external_id.not_in(ids)))
    prefs.last_synced_at = utcnow()
    db.commit()
    return {"imported": imported, "lastSyncedAt": prefs.last_synced_at}


@router.get("/export")
def export_sleep(db: Session = Depends(get_db), user: FirebaseUser = Depends(require_verified_email)):
    prefs = own_preferences(db, user)
    purge_old_data(db)
    result = {
        "formatVersion": 1,
        "exportedAt": utcnow(),
        "preferences": {key: value for key, value in settings_out(prefs).items() if key != "syncGeneration"},
        "sleepSessions": [session_out(r) for r in db.query(SleepSession).filter_by(user_id=user.uid).order_by(SleepSession.end_time.desc()).all()],
        "checkIns": [checkin_out(r) for r in db.query(SleepCheckIn).filter_by(user_id=user.uid).order_by(SleepCheckIn.day.desc()).all()],
    }
    db.commit()
    return result


@router.delete("/data", status_code=204)
def delete_sleep_data(db: Session = Depends(get_db), user: FirebaseUser = Depends(require_verified_email)):
    prefs = own_preferences(db, user, lock=True)
    for model in (SleepSession, SleepCheckIn, SleepImportExclusion):
        db.execute(delete(model).where(model.user_id == user.uid))
    prefs.consent_version = None
    prefs.consented_at = None
    prefs.health_connect_enabled = False
    prefs.last_synced_at = None
    prefs.goal_minutes = None
    prefs.preferred_origin = None
    prefs.sync_generation = str(uuid4())
    db.commit()
