from datetime import datetime, timezone
from math import isfinite

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import FirebaseUser, require_verified_email
from app.database import get_db
from app.models import Activity, User
from app.models.health_import import HealthImport
from app.rate_limit import rate_limit

router = APIRouter(prefix="/health-imports", tags=["health-imports"])

class ImportedRun(BaseModel):
    external_id: str = Field(min_length=1, max_length=255)
    source: str = Field(min_length=1, max_length=255)
    started_at: datetime
    ended_at: datetime
    # Minimo de 100 m: abaixo disso nao e corrida e o ritmo dividiria por zero.
    distance_meters: float = Field(ge=100, le=500000)

    @model_validator(mode="after")
    def validate_run(self):
        if self.started_at.tzinfo is None or self.ended_at.tzinfo is None:
            raise ValueError("Datas devem conter fuso horario")
        seconds = (self.ended_at - self.started_at).total_seconds()
        if not 0 < seconds <= 86400 or self.started_at > datetime.now(timezone.utc):
            raise ValueError("Intervalo de corrida invalido")
        if not isfinite(self.distance_meters) or self.distance_meters / seconds > 12:
            raise ValueError("Distancia ou velocidade invalida")
        return self

class ImportBatch(BaseModel):
    runs: list[ImportedRun] = Field(max_length=100)

@router.post("", dependencies=[Depends(rate_limit("health:import", 20, 600))])
def import_runs(
    payload: ImportBatch,
    db: Session = Depends(get_db),
    current_user: FirebaseUser = Depends(require_verified_email),
):
    user = db.get(User, current_user.uid)
    if not user:
        raise HTTPException(status_code=409, detail="Perfil nao encontrado. Abra o perfil antes de sincronizar.")
    created = 0
    duplicates = 0
    for run in payload.runs:
        existing = db.query(HealthImport).filter_by(
            user_id=current_user.uid, source=run.source, external_id=run.external_id
        ).first()
        if existing:
            duplicates += 1
            continue
        seconds = int((run.ended_at - run.started_at).total_seconds())
        km = round(run.distance_meters / 1000, 3)
        pace_seconds = round(seconds / km)
        pace = f"{pace_seconds // 60}'{pace_seconds % 60:02d}\""
        activity = Activity(
            user_id=current_user.uid,
            user_name=user.display_name or "Corredor",
            user_avatar=user.photo_url,
            distance=km,
            time=f"{seconds // 60}m {seconds % 60}s",
            duration_seconds=seconds,
            pace=pace,
            calories=None,
            type="Corrida",
            likes=[],
            route=None,
            xp_gained=0,  # Importações não concedem XP até política antifraude específica.
            created_at=run.started_at,
        )
        try:
            # Savepoint prevents a concurrent duplicate from invalidating other imports.
            with db.begin_nested():
                db.add(activity)
                db.flush()
                db.add(HealthImport(
                    user_id=current_user.uid, source=run.source,
                    external_id=run.external_id, activity_id=activity.id
                ))
                db.flush()
            created += 1
        except IntegrityError:
            duplicates += 1
    db.commit()
    return {"created": created, "duplicates": duplicates}
