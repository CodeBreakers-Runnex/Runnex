from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import Activity
from app.models.training import PlannedWorkout
from app.schemas_training import ActivityEvidence, WorkoutOut
from app.time_utils import utcnow


def owned_workout(db: Session, uid: str, workout_id: int, *, lock=False) -> PlannedWorkout:
    query = db.query(PlannedWorkout).filter(PlannedWorkout.id == workout_id, PlannedWorkout.user_id == uid)
    if lock:
        query = query.with_for_update()
    workout = query.first()
    if not workout:
        raise HTTPException(404, "Treino não encontrado.")
    return workout


def check_revision(workout: PlannedWorkout, revision: int):
    if workout.revision != revision:
        raise HTTPException(409, "Esse treino foi atualizado. Recarregue a agenda e tente novamente.")


def touch(workout: PlannedWorkout):
    workout.revision += 1
    workout.updated_at = utcnow()


def reopen(workout: PlannedWorkout, *, removed=False):
    workout.status = "planned"
    workout.completion_source = None
    workout.completed_at = None
    workout.completed_activity_id = None
    workout.evidence_removed = removed
    touch(workout)


def clear_activity_links(db: Session, uid: str, activity_ids: list[int]):
    if not activity_ids:
        return
    for workout in db.query(PlannedWorkout).filter(PlannedWorkout.user_id == uid, PlannedWorkout.completed_activity_id.in_(activity_ids)).order_by(PlannedWorkout.id).with_for_update().all():
        reopen(workout, removed=True)


def serialize_workout(workout: PlannedWorkout, activity: Activity | None = None) -> WorkoutOut:
    now = utcnow()
    overdue = workout.status == "planned" and (
        (workout.scheduled_at is not None and workout.scheduled_at < now)
        or (workout.scheduled_at is None and workout.planned_date < now.astimezone(ZoneInfo(workout.timezone)).date())
    )
    evidence = ActivityEvidence(id=activity.id, distance=activity.distance, duration_seconds=activity.duration_seconds, pace=activity.pace, recorded_at=activity.created_at) if activity else None
    return WorkoutOut(**{field: getattr(workout, field) for field in WorkoutOut.model_fields if field not in {"overdue", "activity"}}, overdue=overdue, activity=evidence)


def serialize_many(db: Session, uid: str, workouts: list[PlannedWorkout]):
    ids = [w.completed_activity_id for w in workouts if w.completed_activity_id is not None]
    activities = {a.id: a for a in db.query(Activity).filter(Activity.user_id == uid, Activity.id.in_(ids)).all()} if ids else {}
    return [serialize_workout(w, activities.get(w.completed_activity_id)) for w in workouts]
