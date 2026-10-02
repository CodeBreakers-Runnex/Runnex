from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import FirebaseUser, get_current_user
from app.database import get_db
from app.models import Event, EventParticipant
from app.rate_limit import rate_limit
from app.schemas_event import RunningEventOut

router = APIRouter(prefix="/events", tags=["events"])


def _serialize_event(event: Event) -> RunningEventOut:
    return RunningEventOut(
        id=event.id,
        title=event.title,
        date=event.date,
        location=event.location,
        city=event.city,
        state=event.state,
        country=event.country,
        lat=event.lat,
        lng=event.lng,
        participants_count=len(event.participants),
        participants_ids=[p.user_id for p in event.participants],
        category=event.category,
        distance_options=event.distance_options,
        image=event.image,
        price=event.price,
        official_url=event.official_url,
        source=event.source,
        source_url=event.source_url,
        source_type=event.source_type,
        verified=event.verified,
        status=event.status,
        last_synced_at=event.last_synced_at,
        distance_km=event.distance_km,
        event_timestamp=event.event_timestamp,
    )


@router.get("", response_model=list[RunningEventOut])
def list_events(db: Session = Depends(get_db), _: FirebaseUser = Depends(get_current_user)):
    events = db.query(Event).order_by(Event.event_timestamp.asc()).all()
    return [_serialize_event(e) for e in events]


@router.post("/{event_id}/join", response_model=RunningEventOut, dependencies=[Depends(rate_limit("events:join", 20, 60))])
def join_event(
    event_id: int, db: Session = Depends(get_db), current_user: FirebaseUser = Depends(get_current_user)
):
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Evento nao encontrado.")

    already_joined = db.query(EventParticipant).filter(
        EventParticipant.event_id == event_id, EventParticipant.user_id == current_user.uid
    ).first()
    if not already_joined:
        db.add(EventParticipant(event_id=event_id, user_id=current_user.uid))
        db.commit()
        db.refresh(event)

    return _serialize_event(event)


@router.get("/enrolled/{user_id}", response_model=list[str])
def get_enrolled_event_ids(
    user_id: str, db: Session = Depends(get_db), _: FirebaseUser = Depends(get_current_user)
):
    """IDs dos eventos reais (Postgres) em que o usuario esta inscrito. Usado
    por getUserProfile no frontend para mesclar com enrolledEvents do
    Firestore (eventos locais/demo, que nao tem linha correspondente aqui)."""
    rows = db.query(EventParticipant.event_id).filter(EventParticipant.user_id == user_id).all()
    return [str(event_id) for (event_id,) in rows]
