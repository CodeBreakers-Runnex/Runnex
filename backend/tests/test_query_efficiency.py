"""Consultas mais leves: mesmas respostas, menos dados lidos do banco.

Captura o SQL que o SQLAlchemy manda ao Postgres durante a requisicao."""

from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import event

from app.database import engine
from app.models import Event
from tests.helpers import run_payload


@contextmanager
def captured_sql():
    statements: list[str] = []

    def before(conn, cursor, statement, parameters, context, executemany):
        statements.append(statement)

    event.listen(engine, "before_cursor_execute", before)
    try:
        yield statements
    finally:
        event.remove(engine, "before_cursor_execute", before)


def _activity_selects(statements):
    return [s for s in statements if s.lstrip().upper().startswith("SELECT") and "FROM activities" in s]


def test_performance_summary_does_not_load_routes(client, make_user):
    # A rota (ate 4.500 pontos por corrida) nao e usada no calculo de
    # recordes e evolucao, mas era lida de todas as corridas.
    make_user("ana", "Ana")
    for _ in range(3):
        assert client.post("/activities", json=run_payload("ana")).status_code == 200
    with captured_sql() as sql:
        response = client.get("/activities/performance/me")
    assert response.status_code == 200
    assert len(response.json()["evolution"]["week"]) == 8
    selects = _activity_selects(sql)
    assert selects and all("activities.route" not in s for s in selects)


def test_training_summary_reads_only_distance_and_duration(client, make_user):
    make_user("ana", "Ana")
    client.post("/activities", json=run_payload("ana", km=5.0, seconds=1800))
    monday = date.today() - timedelta(days=date.today().weekday())
    with captured_sql() as sql:
        response = client.get(f"/training/summary?week={monday.isoformat()}")
    assert response.status_code == 200, response.text
    assert response.json()["recordedKm"] == 5.0 and response.json()["runCount"] == 1
    selects = _activity_selects(sql)
    assert selects
    for heavy in ("activities.route", "activities.performance_samples", "activities.heart_rate_samples"):
        assert all(heavy not in s for s in selects), heavy


def test_event_list_does_not_query_once_per_event(client, make_user, db):
    make_user("ana", "Ana")
    for i in range(5):
        db.add(Event(title=f"Prova {i}", date="24 SET", location="Parque", city="Campinas", category="10K",
                     event_timestamp=datetime.now(timezone.utc) + timedelta(days=i + 1)))
    db.commit()
    with captured_sql() as sql:
        response = client.get("/events")
    assert response.status_code == 200
    assert len(response.json()) == 5
    participant_queries = [s for s in sql if "FROM event_participants" in s]
    assert len(participant_queries) <= 1  # antes: uma consulta por evento (N+1)
