from datetime import datetime, timedelta, timezone

from tests.helpers import run_payload


def test_same_client_id_does_not_duplicate_the_run(client, make_user):
    make_user("ana")
    payload = run_payload("ana", clientId="corrida-offline-0001")

    first = client.post("/activities", json=payload)
    second = client.post("/activities", json=payload)

    assert first.status_code == 200 and second.status_code == 200
    assert first.json()["id"] == second.json()["id"]
    assert len(client.get("/activities/user/ana").json()) == 1
    assert client.get("/users/ana").json()["monthlyKm"] == 5.0


def test_client_id_is_per_user(client, make_user):
    make_user("bruno")
    assert client.post("/activities", json=run_payload("bruno", clientId="mesmo-id-0001")).status_code == 200
    make_user("ana")
    assert client.post("/activities", json=run_payload("ana", clientId="mesmo-id-0001")).status_code == 200
    assert len(client.get("/activities/user/ana").json()) == 1


def test_offline_run_keeps_the_time_it_finished(client, make_user):
    make_user("ana")
    finished = datetime.now(timezone.utc) - timedelta(hours=5)
    response = client.post("/activities", json=run_payload("ana", clientId="corrida-offline-0002", finishedAt=finished.isoformat()))
    assert response.status_code == 200
    saved = client.get("/activities/user/ana").json()[0]
    assert abs(datetime.fromisoformat(saved["timestamp"]) - finished) < timedelta(seconds=1)


def test_implausible_finished_at_falls_back_to_now(client, make_user):
    make_user("ana")
    now = datetime.now(timezone.utc)
    for finished in (now + timedelta(days=1), now - timedelta(days=60)):
        assert client.post("/activities", json=run_payload("ana", finishedAt=finished.isoformat())).status_code == 200
    for run in client.get("/activities/user/ana").json():
        assert abs(datetime.fromisoformat(run["timestamp"]) - now) < timedelta(minutes=1)


def test_invalid_client_id_is_rejected(client, make_user):
    make_user("ana")
    assert client.post("/activities", json=run_payload("ana", clientId="x")).status_code == 422
    assert client.post("/activities", json=run_payload("ana", clientId="tem espaço e acento")).status_code == 422
