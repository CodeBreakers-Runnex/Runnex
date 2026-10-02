from datetime import datetime, timedelta, timezone

import pytest

from app.models import Event


@pytest.fixture
def event_id(db):
    # Eventos nao tem endpoint de criacao (sao gerenciados fora do app)
    event = Event(
        title="Corrida de Teste",
        date="24 SET",
        location="Parque Ibirapuera",
        city="Sao Paulo",
        category="10K",
        event_timestamp=datetime.now(timezone.utc) + timedelta(days=10),
    )
    db.add(event)
    db.commit()
    return event.id


def test_list_and_join_event(client, make_user, event_id):
    make_user("ana")
    events = client.get("/events").json()
    assert [e["title"] for e in events] == ["Corrida de Teste"]
    assert events[0]["participantsCount"] == 0

    joined = client.post(f"/events/{event_id}/join").json()
    assert joined["participantsCount"] == 1 and "ana" in joined["participantsIds"]
    assert client.get("/events/enrolled/ana").json() == [str(event_id)]


def test_join_is_idempotent(client, make_user, event_id):
    make_user("ana")
    client.post(f"/events/{event_id}/join")
    assert client.post(f"/events/{event_id}/join").json()["participantsCount"] == 1
