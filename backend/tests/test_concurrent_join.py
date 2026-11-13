"""Entrar em grupo/evento com dois toques rapidos (duas requisicoes ao mesmo
tempo). As duas passavam pela checagem "ja e membro?" antes de qualquer uma
gravar, e a segunda batia na constraint unica: 500 em vez de resposta
normal.

O teste reproduz isso sem depender de sorte: outra sessao grava a mesma
participacao sem commit, a requisicao passa pela checagem (nao enxerga a
linha) e fica bloqueada no indice unico; so entao a outra sessao confirma.
"""

import threading
import time
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import text

from app.database import SessionLocal, engine
from app.models import Event, EventParticipant, GroupMember


def _wait_until_blocked_on_lock(timeout: float = 10.0) -> None:
    deadline = time.monotonic() + timeout
    with engine.connect() as connection:
        while time.monotonic() < deadline:
            waiting = connection.execute(
                text("SELECT count(*) FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND datname = current_database()")
            ).scalar()
            if waiting:
                return
            # pg_stat_activity fica congelado dentro da mesma transacao:
            # encerrar a cada volta para enxergar o estado novo.
            connection.rollback()
            time.sleep(0.02)
    raise AssertionError("a requisicao nunca ficou esperando o indice unico")


def _race(client, path: str, rival_row) -> dict:
    """Grava rival_row numa sessao separada, dispara path e so confirma a
    sessao rival quando a requisicao estiver bloqueada esperando por ela."""
    rival = SessionLocal()
    rival.add(rival_row)
    rival.flush()

    outcome: dict = {}

    def request():
        try:
            outcome["response"] = client.post(path)
        except Exception as exc:  # TestClient repassa a excecao do servidor
            outcome["error"] = exc

    worker = threading.Thread(target=request)
    worker.start()
    try:
        _wait_until_blocked_on_lock()
    finally:
        rival.commit()
        rival.close()
    worker.join(timeout=10)
    assert not worker.is_alive()
    return outcome


@pytest.fixture
def event_id(db):
    event = Event(
        title="Corrida de Teste", date="24 SET", location="Parque", city="Sao Paulo", category="10K",
        event_timestamp=datetime.now(timezone.utc) + timedelta(days=10),
    )
    db.add(event)
    db.commit()
    return event.id


def test_simultaneous_join_group_does_not_500(client, make_user):
    make_user("bruno", "Bruno")
    make_user("ana", "Ana")
    group_id = int(client.post("/groups", json={"name": "Treino", "city": "SP"}).json()["id"])
    make_user("bruno", "Bruno")

    outcome = _race(client, f"/groups/{group_id}/join", GroupMember(group_id=group_id, user_id="bruno"))

    assert "error" not in outcome, repr(outcome.get("error"))
    assert outcome["response"].status_code == 200, outcome["response"].text
    assert sorted(outcome["response"].json()["memberIds"]) == ["ana", "bruno"]


def test_simultaneous_join_event_does_not_500(client, make_user, event_id):
    make_user("ana", "Ana")

    outcome = _race(client, f"/events/{event_id}/join", EventParticipant(event_id=event_id, user_id="ana"))

    assert "error" not in outcome, repr(outcome.get("error"))
    assert outcome["response"].status_code == 200, outcome["response"].text
    assert outcome["response"].json()["participantsCount"] == 1
