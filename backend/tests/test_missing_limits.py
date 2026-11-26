"""Rate limit nas rotas que nao tinham e documentacao da API fechada."""

from datetime import date

from tests.helpers import run_payload


def _workout(**updates):
    return {"title": "Leve", "category": "easy", "plannedDate": date.today().isoformat(), "timezone": "America/Sao_Paulo", **updates}


def test_creating_workouts_is_rate_limited(client, make_user):
    make_user("ana", "Ana")
    statuses = [client.post("/training/workouts", json=_workout()).status_code for _ in range(31)]
    assert statuses[:30] == [201] * 30
    assert statuses[30] == 429


def test_performance_summary_is_rate_limited(client, make_user):
    # Le todas as corridas do usuario com as amostras: e a rota mais pesada.
    make_user("ana", "Ana")
    statuses = [client.get("/activities/performance/me").status_code for _ in range(31)]
    assert statuses[:30] == [200] * 30
    assert statuses[30] == 429


def test_api_docs_are_closed_by_default(client):
    assert client.get("/docs").status_code == 404
    assert client.get("/openapi.json").status_code == 404
    assert client.get("/health").json() == {"status": "ok"}
