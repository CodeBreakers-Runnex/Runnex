from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import DateTime, and_, cast, func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import FirebaseUser, require_verified_email
from app.database import get_db
from app.models import Activity
from app.models.training import PlannedWorkout
from app.schemas_training import ActivityLinkInput, StatusInput, WorkoutInput, WorkoutOut, WorkoutPage, WorkoutUpdate, scheduled_instant, valid_zone
from app.services.activity_effects import get_or_create_user
from app.services.training import check_revision, owned_workout, reopen, serialize_many, serialize_workout, touch
from app.time_utils import utcnow

router = APIRouter(prefix="/training", tags=["training"])


@router.get("/workouts", response_model=WorkoutPage)
def list_workouts(start: date = Query(alias="from"), end: date = Query(alias="to"), offset: int = Query(0, ge=0, le=10000), limit: int = Query(100, ge=1, le=100), db: Session = Depends(get_db), user: FirebaseUser = Depends(require_verified_email)):
    if not 0 <= (end - start).days <= 92:
        raise HTTPException(422, "Consulte um intervalo de até 93 dias.")
    query = db.query(PlannedWorkout).filter(PlannedWorkout.user_id == user.uid, PlannedWorkout.planned_date >= start, PlannedWorkout.planned_date <= end)
    total = query.count()
    rows = query.order_by(PlannedWorkout.planned_date, PlannedWorkout.planned_time.asc().nullsfirst(), PlannedWorkout.id).offset(offset).limit(limit).all()
    return WorkoutPage(items=serialize_many(db, user.uid, rows), total=total, next_offset=offset + len(rows) if offset + len(rows) < total else None)


@router.get("/next", response_model=WorkoutOut | None)
def next_workout(db: Session = Depends(get_db), user: FirebaseUser = Depends(require_verified_email)):
    now = utcnow()
    local_today = func.date(func.timezone(PlannedWorkout.timezone, now))
    start_instant = func.coalesce(PlannedWorkout.scheduled_at, func.timezone(PlannedWorkout.timezone, cast(PlannedWorkout.planned_date, DateTime())))
    workout = db.query(PlannedWorkout).filter(PlannedWorkout.user_id == user.uid, PlannedWorkout.status == "planned", or_(PlannedWorkout.scheduled_at >= now, and_(PlannedWorkout.scheduled_at.is_(None), PlannedWorkout.planned_date >= local_today))).order_by(func.greatest(now, start_instant), PlannedWorkout.id).first()
    return serialize_workout(workout) if workout else None


@router.get("/summary")
def summary(week: date, zone: str = "America/Sao_Paulo", db: Session = Depends(get_db), user: FirebaseUser = Depends(require_verified_email)):
    try:
        valid_zone(zone)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    if week.weekday() != 0:
        raise HTTPException(422, "A semana deve começar na segunda-feira.")
    end = week + timedelta(days=7)
    rows = db.query(PlannedWorkout).filter(PlannedWorkout.user_id == user.uid, PlannedWorkout.planned_date >= week, PlannedWorkout.planned_date < end).all()
    eligible = [w for w in rows if w.category != "rest" and w.status != "cancelled"]
    completed = [w for w in eligible if w.status == "completed"]
    start_utc = datetime.combine(week, time.min, ZoneInfo(zone)).astimezone(timezone.utc)
    end_utc = datetime.combine(end, time.min, ZoneInfo(zone)).astimezone(timezone.utc)
    runs = db.query(Activity).filter(Activity.user_id == user.uid, Activity.created_at >= start_utc, Activity.created_at < end_utc).all()
    closed = end <= utcnow().astimezone(ZoneInfo(zone)).date()
    return {"week": week, "end": end - timedelta(days=1), "timezone": zone, "plannedCount": len(eligible), "completedCount": len(completed), "manualCount": sum(w.completion_source == "manual" for w in completed), "skippedCount": sum(w.status == "skipped" for w in eligible), "restCount": sum(w.category == "rest" and w.status != "cancelled" for w in rows), "targetKm": round(sum(w.target_distance_km or 0 for w in eligible), 2), "targetMinutes": sum(w.target_duration_minutes or 0 for w in eligible), "recordedKm": round(sum(a.distance for a in runs), 2), "recordedMinutes": round(sum(a.duration_seconds for a in runs) / 60, 1), "runCount": len(runs), "closed": closed, "completionRate": round(len(completed) / len(eligible) * 100, 1) if closed and eligible else None}


@router.post("/workouts", response_model=WorkoutOut, status_code=201)
def create(payload: WorkoutInput, db: Session = Depends(get_db), user: FirebaseUser = Depends(require_verified_email)):
    get_or_create_user(db, user.uid, user.uid, None)
    workout = PlannedWorkout(user_id=user.uid, **payload.model_dump(), original_date=payload.planned_date, scheduled_at=scheduled_instant(payload.planned_date, payload.planned_time, payload.timezone))
    db.add(workout)
    db.commit()
    db.refresh(workout)
    return serialize_workout(workout)


@router.get("/workouts/{workout_id}", response_model=WorkoutOut)
def detail(workout_id: int, db: Session = Depends(get_db), user: FirebaseUser = Depends(require_verified_email)):
    return serialize_many(db, user.uid, [owned_workout(db, user.uid, workout_id)])[0]


@router.patch("/workouts/{workout_id}", response_model=WorkoutOut)
def update(workout_id: int, payload: WorkoutUpdate, db: Session = Depends(get_db), user: FirebaseUser = Depends(require_verified_email)):
    workout = owned_workout(db, user.uid, workout_id, lock=True)
    check_revision(workout, payload.revision)
    if workout.status == "completed":
        raise HTTPException(409, "Reabra o treino para alterar seu planejamento.")
    for key, value in payload.model_dump(exclude={"revision"}).items():
        setattr(workout, key, value)
    workout.scheduled_at = scheduled_instant(workout.planned_date, workout.planned_time, workout.timezone)
    touch(workout)
    db.commit()
    return serialize_workout(workout)


@router.delete("/workouts/{workout_id}", status_code=204)
def delete(workout_id: int, revision: int = Query(ge=1), db: Session = Depends(get_db), user: FirebaseUser = Depends(require_verified_email)):
    workout = owned_workout(db, user.uid, workout_id, lock=True)
    check_revision(workout, revision)
    db.delete(workout)
    db.commit()


@router.put("/workouts/{workout_id}/status", response_model=WorkoutOut)
def set_status(workout_id: int, payload: StatusInput, db: Session = Depends(get_db), user: FirebaseUser = Depends(require_verified_email)):
    workout = owned_workout(db, user.uid, workout_id, lock=True)
    check_revision(workout, payload.revision)
    if workout.completed_activity_id and payload.status != "planned":
        raise HTTPException(409, "Reabra o treino para remover o vínculo com a corrida.")
    if payload.status == "planned":
        reopen(workout)
    else:
        workout.status = payload.status
        workout.completion_source = "manual" if payload.status == "completed" else None
        workout.completed_at = utcnow() if payload.status == "completed" else None
        workout.completed_activity_id = None
        workout.evidence_removed = False
        touch(workout)
    db.commit()
    return serialize_workout(workout)


@router.put("/workouts/{workout_id}/activity", response_model=WorkoutOut)
def link(workout_id: int, payload: ActivityLinkInput, db: Session = Depends(get_db), user: FirebaseUser = Depends(require_verified_email)):
    activity = db.query(Activity).filter(Activity.id == payload.activity_id, Activity.user_id == user.uid).with_for_update().first()
    if not activity:
        raise HTTPException(404, "Corrida não encontrada.")
    workout = owned_workout(db, user.uid, workout_id, lock=True)
    if workout.completed_activity_id == activity.id:
        return serialize_workout(workout, activity)
    check_revision(workout, payload.revision)
    if workout.category == "rest" or workout.status != "planned":
        raise HTTPException(409, "Apenas treinos planejados podem receber uma corrida.")
    if db.query(PlannedWorkout.id).filter(PlannedWorkout.completed_activity_id == activity.id).first():
        raise HTTPException(409, "Essa corrida já está vinculada a outro treino.")
    workout.status = "completed"
    workout.completed_activity_id = activity.id
    workout.completion_source = "activity"
    workout.completed_at = utcnow()
    workout.evidence_removed = False
    touch(workout)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "Essa corrida já está vinculada a outro treino.") from exc
    return serialize_workout(workout, activity)


@router.delete("/workouts/{workout_id}/activity", response_model=WorkoutOut)
def unlink(workout_id: int, revision: int = Query(ge=1), db: Session = Depends(get_db), user: FirebaseUser = Depends(require_verified_email)):
    workout = owned_workout(db, user.uid, workout_id, lock=True)
    check_revision(workout, revision)
    reopen(workout)
    db.commit()
    return serialize_workout(workout)
