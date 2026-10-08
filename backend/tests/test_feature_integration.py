"""Uma atividade real atualiza tênis, agenda e resumo de recuperação juntos."""

from datetime import timedelta

import pytest

from app.models import Activity, PlannedWorkout, Shoe
from app.models.sleep import RecoveryPreferences, SleepSession
from app.time_utils import utcnow
from tests.helpers import run_payload
from tests.test_shoes import create as create_shoe
from tests.test_sleep import activate, manual_payload
from tests.test_training import create as create_workout


def body(response, status=200):
    assert response.status_code == status, response.text
    return response.json()


@pytest.fixture
def combined_records(client, make_user):
    make_user("ana")
    shoe = create_shoe(client, initialKm=95, isDefault=True)
    activate(client)
    sleep = body(client.post("/recovery/sleep", json=manual_payload(hours=6.5)), 201)
    workout = create_workout(client, timezone="UTC", plannedDate=utcnow().date().isoformat(), targetDistanceKm=7)
    run = body(client.post("/activities", json=run_payload("ana", shoeId=shoe["id"])))
    linked = body(client.put(f"/training/workouts/{workout['id']}/activity", json={"activityId": run["id"], "revision": workout["revision"]}))
    return {"shoe": shoe, "sleep": sleep, "workout": linked, "run": run}


def weekly_summary(client):
    today = utcnow().date()
    week = today - timedelta(days=today.weekday())
    return body(client.get("/training/summary", params={"week": week.isoformat(), "zone": "UTC"}))


def test_reassigning_shoe_preserves_calendar_and_counts_one_real_run(client, combined_records):
    records = combined_records
    shoe = body(client.get("/shoes"))[0]
    assert (shoe["totalKm"], shoe["runsCount"]) == (100, 1)
    summary = weekly_summary(client)
    assert (summary["recordedKm"], summary["runCount"], summary["targetKm"]) == (5, 1, 7)
    recovery = body(client.get("/recovery/overview"))
    assert recovery["today"]["sleepMinutes"] == 390
    assert (recovery["training"]["currentKm"], recovery["training"]["currentMinutes"]) == (5, 30)

    other = create_shoe(client, initialKm=10)
    xp = body(client.get("/users/ana"))["totalXP"]
    for _ in range(2):
        body(client.put(f"/activities/{records['run']['id']}/shoe", json={"shoeId": other["id"]}))
    usage = {s["id"]: s for s in body(client.get("/shoes"))}
    assert usage[records["shoe"]["id"]]["totalKm"] == 95
    assert (usage[other["id"]]["totalKm"], usage[other["id"]]["runsCount"]) == (15, 1)
    workout = body(client.get(f"/training/workouts/{records['workout']['id']}"))
    assert workout["completedActivityId"] == int(records["run"]["id"])
    assert workout["revision"] == records["workout"]["revision"]
    assert workout["activity"]["distance"] == 5
    assert body(client.get("/users/ana"))["totalXP"] == xp
    assert weekly_summary(client)["recordedKm"] == 5
    assert body(client.get("/recovery/overview"))["training"]["currentKm"] == 5


@pytest.mark.parametrize("bulk", [False, True])
def test_deletion_updates_all_run_summaries_without_erasing_sleep(client, combined_records, bulk):
    records = combined_records
    path = "/activities/user/ana/all" if bulk else f"/activities/{records['run']['id']}"
    assert client.delete(path).status_code == 200
    shoe = body(client.get("/shoes"))[0]
    assert (shoe["totalKm"], shoe["runsCount"]) == (95, 0)
    workout = body(client.get(f"/training/workouts/{records['workout']['id']}"))
    assert workout["status"] == "planned"
    assert workout["completedActivityId"] is None
    assert workout["evidenceRemoved"] is True
    assert workout["targetDistanceKm"] == 7
    summary = weekly_summary(client)
    assert (summary["recordedKm"], summary["runCount"], summary["completedCount"]) == (0, 0, 0)
    recovery = body(client.get("/recovery/overview"))
    assert recovery["training"]["currentKm"] == 0
    assert recovery["today"]["sleepMinutes"] == 390
    assert [s["id"] for s in recovery["sessions"]] == [records["sleep"]["id"]]


def test_account_deletion_cascades_all_modules_and_preserves_other_account(client, combined_records, make_user, login, db):
    make_user("bia")
    shoe = create_shoe(client, initialKm=20)
    activate(client)
    sleep = body(client.post("/recovery/sleep", json=manual_payload(hours=7)), 201)
    workout = create_workout(client, timezone="UTC")
    login("ana")
    assert client.delete("/users/ana").status_code == 204
    for model in (Activity, Shoe, PlannedWorkout, SleepSession, RecoveryPreferences):
        assert db.query(model).filter_by(user_id="ana").count() == 0
    login("bia")
    assert [s["id"] for s in body(client.get("/shoes"))] == [shoe["id"]]
    assert body(client.get(f"/training/workouts/{workout['id']}"))["status"] == "planned"
    recovery = body(client.get("/recovery/overview"))
    assert [s["id"] for s in recovery["sessions"]] == [sleep["id"]]
    assert recovery["today"]["sleepMinutes"] == 420
