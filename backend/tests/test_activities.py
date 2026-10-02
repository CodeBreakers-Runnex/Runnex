from tests.helpers import run_payload


def test_save_run_grants_xp_km_and_coins(client, make_user):
    make_user("ana")
    client.post("/users/ana/pet/choose", json={"species": "guepardo", "name": "Flash"})

    response = client.post("/activities", json=run_payload("ana", km=5.0, seconds=1499))
    assert response.status_code == 200, response.text
    assert response.json()["xpUpdateFailed"] is False

    profile = client.get("/users/ana").json()
    assert profile["totalXP"] == 600  # 500 + 20% de bonus (pace < 5'00")
    assert profile["monthlyKm"] == 5.0
    assert profile["petCoins"] == 5


def test_first_run_creates_profile_for_google_accounts(client, login):
    login("google-user")
    assert client.post("/activities", json=run_payload("google-user")).status_code == 200
    assert client.get("/users/google-user").status_code == 200


def test_cannot_save_run_for_someone_else(client, login):
    login("ana")
    assert client.post("/activities", json=run_payload("bruno")).status_code == 403


def test_implausible_run_returns_readable_422(client, login):
    login("ana")
    response = client.post("/activities", json=run_payload("ana", km=500, seconds=60))
    assert response.status_code == 422
    assert "Velocidade media" in response.json()["detail"][0]["msg"]


def test_daily_duration_cap(client, login):
    login("ana")
    assert client.post("/activities", json=run_payload("ana", km=200, seconds=40000)).status_code == 200
    assert client.post("/activities", json=run_payload("ana", km=200, seconds=40000)).status_code == 200
    response = client.post("/activities", json=run_payload("ana", km=20, seconds=7000))
    assert response.status_code == 422
    assert "24h" in response.json()["detail"]


def test_like_toggle(client, make_user, login):
    make_user("ana")
    run_id = client.post("/activities", json=run_payload("ana")).json()["id"]

    login("bruno")
    assert client.post(f"/activities/{run_id}/like", json={"isLiked": False}).json()["likes"] == ["bruno"]
    assert client.post(f"/activities/{run_id}/like", json={"isLiked": True}).json()["likes"] == []


def test_delete_run_recomputes_totals(client, make_user):
    make_user("ana")
    first = client.post("/activities", json=run_payload("ana", km=5.0, seconds=1800)).json()["id"]
    client.post("/activities", json=run_payload("ana", km=3.0, seconds=1080))

    assert client.delete(f"/activities/{first}").status_code == 200
    profile = client.get("/users/ana").json()
    assert profile["totalXP"] == 300
    assert profile["monthlyKm"] == 3.0


def test_cannot_delete_someone_elses_run(client, make_user, login):
    make_user("ana")
    run_id = client.post("/activities", json=run_payload("ana")).json()["id"]
    login("bruno")
    assert client.delete(f"/activities/{run_id}").status_code == 404


def test_delete_all_runs_resets_profile(client, make_user):
    make_user("ana")
    client.post("/activities", json=run_payload("ana"))
    assert client.delete("/activities/user/ana/all").json() == {"deleted_count": 1}
    assert client.get("/users/ana").json()["totalXP"] == 0


def test_feed_is_newest_first_and_paginates(client, login):
    login("ana")
    ids = [client.post("/activities", json=run_payload("ana", km=1.0, seconds=600)).json()["id"] for _ in range(3)]

    page = client.get("/activities/feed?limit=2").json()
    assert [a["id"] for a in page] == [ids[2], ids[1]]
    older = client.get(f"/activities/feed?limit=2&before_id={ids[1]}").json()
    assert [a["id"] for a in older] == [ids[0]]


def test_write_endpoints_are_rate_limited(client, login):
    login("ana")
    for _ in range(10):
        assert client.post("/activities", json=run_payload("ana", km=1.0, seconds=600)).status_code == 200
    response = client.post("/activities", json=run_payload("ana", km=1.0, seconds=600))
    assert response.status_code == 429
    assert "Retry-After" in response.headers
