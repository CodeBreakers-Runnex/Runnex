import pytest
from concurrent.futures import ThreadPoolExecutor
from time import monotonic, sleep

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Activity
from app.routers.shoes import lock_owner

from tests.helpers import run_payload


def shoe_payload(**overrides):
    return {"name": "Treino diário", "brand": "Marca", "model": "Modelo", "purchaseDate": "2026-01-01", "initialKm": 0, "limitKm": 600, "isDefault": False, "manuallyWorn": False, "retired": False, **overrides}


def create(client, **overrides):
    response = client.post("/shoes", json=shoe_payload(**overrides))
    assert response.status_code == 201, response.text
    return response.json()


def test_saving_activity_can_commit_while_default_shoe_owner_is_locked(client, make_user, db, request):
    if request.config.pluginmanager.hasplugin("runnex_pg_compat"):
        pytest.skip("Este teste exige transações PostgreSQL concorrentes; o runtime WASM usa uma única sessão.")
    make_user("ana")
    shoe = create(client)
    with Session(db.get_bind()) as owner, ThreadPoolExecutor(max_workers=1) as pool:
        lock_owner(owner, "ana")
        future = pool.submit(client.post, "/activities", json=run_payload("ana", shoeId=shoe["id"]))
        inserted = False
        try:
            deadline = monotonic() + 3
            while monotonic() < deadline:
                if owner.scalar(select(func.count(Activity.id))) == 1:
                    inserted = True
                    break
                sleep(0.05)
        finally:
            owner.rollback()
        response = future.result(timeout=5)
    assert inserted, "O lock do tênis padrão impediu a gravação da corrida pela FK de usuário."
    assert response.status_code == 200, response.text


def test_shoes_require_authentication(client):
    assert client.get("/shoes").status_code == 403


def test_first_shoe_creates_profile_and_requires_verified_email(client, login):
    login("google-user", email_verified=False)
    assert client.post("/shoes", json=shoe_payload()).status_code == 403
    login("google-user")
    shoe = create(client, name="  Meu treino  ", isDefault=True)
    assert shoe["name"] == "Meu treino"
    assert shoe["totalKm"] == 0
    assert shoe["status"] == "good"
    assert client.get("/users/google-user").status_code == 200


@pytest.mark.parametrize("overrides", [{"name": "   "}, {"limitKm": 0}, {"initialKm": -1}, {"limitKm": "NaN"}, {"initialKm": "Infinity"}, {"brand": "x" * 81}])
def test_invalid_shoe_data_is_rejected(client, login, overrides):
    login("ana")
    assert client.post("/shoes", json=shoe_payload(**overrides)).status_code == 422


@pytest.mark.parametrize(("km", "status"), [(479.99, "good"), (480, "attention"), (599.99, "attention"), (600, "worn"), (650, "worn")])
def test_wear_thresholds_and_remaining_distance(client, login, km, status):
    login("ana")
    shoe = create(client, initialKm=km)
    assert shoe["status"] == status
    assert shoe["remainingKm"] == round(max(0, 600 - km), 2)
    assert shoe["usagePercent"] == round(km / 600 * 100, 2)


def test_manual_wear_and_retirement_preserve_history(client, make_user):
    make_user("ana")
    shoe = create(client, manuallyWorn=True, isDefault=True)
    assert shoe["status"] == "worn"
    run_id = client.post("/activities", json=run_payload("ana", shoeId=shoe["id"])).json()["id"]
    retired = client.put(f'/shoes/{shoe["id"]}', json=shoe_payload(retired=True, isDefault=True)).json()
    assert retired["status"] == "retired"
    assert retired["isDefault"] is False
    assert retired["totalKm"] == 5
    assert retired["runsCount"] == 1
    assert client.get("/activities/user/ana").json()[0]["shoeId"] == shoe["id"]
    assert client.post("/activities", json=run_payload("ana", shoeId=shoe["id"])).status_code == 422
    assert client.put(f"/activities/{run_id}/shoe", json={"shoeId": shoe["id"]}).status_code == 200
    reactivated = client.put(f'/shoes/{shoe["id"]}', json=shoe_payload()).json()
    assert reactivated["status"] == "good"
    assert reactivated["totalKm"] == 5


def test_only_one_default_per_user_and_no_automatic_historical_assignment(client, make_user):
    make_user("ana")
    first = create(client, isDefault=True)
    second = create(client, isDefault=True)
    shoes = client.get("/shoes").json()
    assert [s["id"] for s in shoes if s["isDefault"]] == [second["id"]]
    assert client.put(f'/shoes/{first["id"]}', json=shoe_payload(isDefault=True)).status_code == 200
    assert [s["id"] for s in client.get("/shoes").json() if s["isDefault"]] == [first["id"]]
    assert client.post("/activities", json=run_payload("ana")).status_code == 200
    assert client.get("/activities/user/ana").json()[0]["shoeId"] is None


def test_saved_runs_add_only_to_selected_shoe_and_deletion_recomputes(client, make_user):
    make_user("ana")
    first = create(client, initialKm=475)
    second = create(client)
    run_id = client.post("/activities", json=run_payload("ana", shoeId=first["id"])).json()["id"]
    usage = {s["id"]: s for s in client.get("/shoes").json()}
    assert usage[first["id"]]["totalKm"] == 480
    assert usage[first["id"]]["status"] == "attention"
    assert usage[first["id"]]["runsCount"] == 1
    assert usage[second["id"]]["totalKm"] == 0
    assert client.delete(f"/activities/{run_id}").status_code == 200
    usage = {s["id"]: s for s in client.get("/shoes").json()}
    assert usage[first["id"]]["totalKm"] == 475
    assert usage[first["id"]]["status"] == "good"


def test_reassignment_is_idempotent_and_keeps_xp(client, make_user):
    make_user("ana")
    first, second = create(client), create(client)
    run_id = client.post("/activities", json=run_payload("ana", shoeId=first["id"])).json()["id"]
    before = client.get("/users/ana").json()["totalXP"]
    for _ in range(2):
        assert client.put(f"/activities/{run_id}/shoe", json={"shoeId": second["id"]}).status_code == 200
    usage = {s["id"]: s for s in client.get("/shoes").json()}
    assert usage[first["id"]]["totalKm"] == 0
    assert usage[second["id"]]["totalKm"] == 5
    assert usage[second["id"]]["runsCount"] == 1
    assert client.get("/users/ana").json()["totalXP"] == before
    assert client.put(f"/activities/{run_id}/shoe", json={"shoeId": None}).status_code == 200
    assert all(s["totalKm"] == 0 for s in client.get("/shoes").json())


def test_shoes_and_assignments_are_private(client, make_user, login):
    make_user("ana")
    shoe = create(client)
    run_id = client.post("/activities", json=run_payload("ana", shoeId=shoe["id"])).json()["id"]
    make_user("bruno")
    other = create(client)
    assert len(client.get("/shoes").json()) == 1
    assert client.put(f'/shoes/{shoe["id"]}', json=shoe_payload()).status_code == 404
    assert client.post("/activities", json=run_payload("bruno", shoeId=shoe["id"])).status_code == 404
    assert client.put(f"/activities/{run_id}/shoe", json={"shoeId": other["id"]}).status_code == 404
    login("ana")
    assert client.put(f"/activities/{run_id}/shoe", json={"shoeId": other["id"]}).status_code == 404


def test_deleting_all_runs_keeps_initial_km_and_account_deletion_cascades(client, make_user, db):
    from app.models import Shoe

    make_user("ana")
    shoe = create(client, initialKm=100)
    client.post("/activities", json=run_payload("ana", shoeId=shoe["id"]))
    assert client.delete("/activities/user/ana/all").status_code == 200
    assert client.get("/shoes").json()[0]["totalKm"] == 100
    client.post("/activities", json=run_payload("ana", shoeId=shoe["id"]))
    assert client.delete("/users/ana").status_code == 204
    assert db.query(Shoe).count() == 0
