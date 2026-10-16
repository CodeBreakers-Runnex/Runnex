from datetime import datetime, timedelta, timezone

from tests.helpers import run_payload


def imported_run(external_id="hc-1", km=5.0, minutes=30, source="com.example.watch"):
    # Termina 10 min atras: cai na semana atual, onde o estorno de km do grupo atua.
    start = datetime.now(timezone.utc) - timedelta(minutes=minutes + 10)
    return {
        "external_id": external_id,
        "source": source,
        "started_at": start.isoformat(),
        "ended_at": (start + timedelta(minutes=minutes)).isoformat(),
        "distance_meters": km * 1000,
    }


def import_runs(client, *runs):
    response = client.post("/health-imports", json={"runs": list(runs)})
    assert response.status_code == 200, response.text
    return response.json()


def run_ids(client, uid):
    return [a["id"] for a in client.get(f"/activities/user/{uid}").json()]


def test_import_creates_run_without_xp(client, make_user):
    make_user("ana")
    assert import_runs(client, imported_run()) == {"created": 1, "duplicates": 0}
    assert len(run_ids(client, "ana")) == 1
    assert client.get("/users/ana").json()["totalXP"] == 0


def test_same_session_is_imported_once(client, make_user):
    make_user("ana")
    import_runs(client, imported_run("hc-1"))
    assert import_runs(client, imported_run("hc-1")) == {"created": 0, "duplicates": 1}
    assert len(run_ids(client, "ana")) == 1


def test_deleting_another_run_does_not_grant_xp_to_imports(client, make_user):
    # Recalcular os totais tratava o XP 0 da importacao como "nao informado"
    # e devolvia o XP cheio das corridas importadas.
    make_user("ana")
    import_runs(client, imported_run("hc-1"), imported_run("hc-2", km=8.0, minutes=48))
    first = client.post("/activities", json=run_payload("ana", km=5.0, seconds=1800)).json()["id"]
    client.post("/activities", json=run_payload("ana", km=3.0, seconds=1080))

    assert client.delete(f"/activities/{first}").status_code == 200
    assert client.get("/users/ana").json()["totalXP"] == 300  # so a corrida de 3 km


def _group_weekly_km(client, group_id) -> float:
    return client.get(f"/groups/{group_id}").json()["weeklyKm"]


def test_deleting_imported_run_keeps_coins_and_group_km(client, make_user):
    # Importacao nao credita RunCoins nem km de grupo, entao apagar nao estorna.
    make_user("ana")
    client.post("/users/ana/pet/choose", json={"species": "guepardo", "name": "Flash"})
    group_id = client.post("/groups", json={"name": "Treino", "city": "SP"}).json()["id"]
    client.post("/activities", json=run_payload("ana", km=5.0, seconds=1800))
    coins = client.get("/users/ana").json()["petCoins"]
    km = _group_weekly_km(client, group_id)
    assert coins > 0 and km > 0

    import_runs(client, imported_run())
    assert client.get("/users/ana").json()["petCoins"] == coins
    imported = next(a["id"] for a in client.get("/activities/user/ana").json() if not a.get("route"))

    assert client.delete(f"/activities/{imported}").status_code == 200
    assert client.get("/users/ana").json()["petCoins"] == coins
    assert _group_weekly_km(client, group_id) == km


def test_tiny_distance_is_rejected_not_500(client, make_user):
    make_user("ana")
    response = client.post("/health-imports", json={"runs": [imported_run(km=0.0004)]})
    assert response.status_code == 422
    response = client.post("/health-imports", json={"runs": [imported_run(km=0.05)]})
    assert response.status_code == 422


def test_imports_are_isolated_per_user(client, make_user, login):
    make_user("ana")
    import_runs(client, imported_run("hc-1"))
    make_user("bruno")
    # Mesmo id externo em outra conta e outra corrida, nao duplicata.
    assert import_runs(client, imported_run("hc-1")) == {"created": 1, "duplicates": 0}
    assert len(run_ids(client, "bruno")) == 1
    imported_by_ana = run_ids(client, "ana")[0]
    assert client.delete(f"/activities/{imported_by_ana}").status_code == 404
