from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest

from app.models import Activity, PlannedWorkout
from tests.helpers import run_payload


def payload(**updates):
    return {"title": "Leve 5 km", "category": "easy", "plannedDate": date.today().isoformat(), "timezone": "America/Sao_Paulo", "targetDistanceKm": 5, **updates}


def create(client, **updates):
    response = client.post("/training/workouts", json=payload(**updates))
    assert response.status_code == 201, response.text
    return response.json()


def test_crud_and_reschedule_preserve_original_and_revision(client, make_user):
    make_user("ana")
    workout = create(client, title="  Teste  ", notes="privado")
    assert workout["title"] == "Teste" and workout["scheduledAt"] is None
    next_day = (date.today() + timedelta(days=1)).isoformat()
    updated = client.patch(f"/training/workouts/{workout['id']}", json={**payload(title="Novo", plannedDate=next_day), "revision": 1})
    assert updated.status_code == 200
    assert updated.json()["originalDate"] == workout["plannedDate"]
    assert updated.json()["revision"] == 2
    assert client.patch(f"/training/workouts/{workout['id']}", json={**payload(), "revision": 1}).status_code == 409
    assert client.delete(f"/training/workouts/{workout['id']}?revision=1").status_code == 409
    assert client.delete(f"/training/workouts/{workout['id']}?revision=2").status_code == 204


def test_google_account_calendar_creates_backend_profile(client, login):
    login("google")
    create(client)
    assert client.get("/users/google").status_code == 200


def test_calendar_is_private_even_for_public_accounts(client, make_user, login):
    make_user("ana")
    w = create(client, notes="Observação privada")
    make_user("bruno")
    today = date.today().isoformat()
    assert client.get(f"/training/workouts?from={today}&to={today}").json()["items"] == []
    assert client.get(f"/training/workouts/{w['id']}").status_code == 404
    assert client.patch(f"/training/workouts/{w['id']}", json={**payload(), "revision": 1}).status_code == 404
    assert client.put(f"/training/workouts/{w['id']}/status", json={"status": "completed", "revision": 1}).status_code == 404
    assert client.delete(f"/training/workouts/{w['id']}?revision=1").status_code == 404
    login("ana")
    assert client.post("/training/workouts", json=payload(userId="bruno")).status_code == 422


def test_verified_email_required(client, login):
    login("ana", email_verified=False)
    assert client.post("/training/workouts", json=payload()).status_code == 403
    assert client.get("/training/next").status_code == 403


@pytest.mark.parametrize("changes", [
    {"title": "  "}, {"category": "invalid"}, {"targetDistanceKm": 0},
    {"targetDistanceKm": "NaN"}, {"targetDurationMinutes": 1441},
    {"category": "rest"}, {"timezone": "Invalid/Zone"},
    {"plannedDate": "1900-01-01"}, {"plannedTime": "09:01:30"},
    {"plannedDate": "2026-03-08", "plannedTime": "02:30", "timezone": "America/New_York"},
    {"plannedDate": "2026-11-01", "plannedTime": "01:30", "timezone": "America/New_York"},
])
def test_invalid_inputs_are_rejected(client, make_user, changes):
    make_user("ana")
    assert client.post("/training/workouts", json=payload(**changes)).status_code == 422


def test_local_clock_and_all_day_schedule(client, make_user):
    make_user("ana")
    w = create(client, plannedDate="2026-10-08", plannedTime="07:30")
    instant = datetime.fromisoformat(w["scheduledAt"].replace("Z", "+00:00"))
    assert instant == datetime(2026, 10, 8, 10, 30, tzinfo=timezone.utc)
    assert w["plannedDate"] == "2026-10-08" and w["plannedTime"] == "07:30:00"
    all_day = create(client, plannedDate="2026-01-01", targetDistanceKm=None)
    assert all_day["scheduledAt"] is None and all_day["overdue"] is True
    assert all_day["status"] == "planned"


def test_manual_completion_and_rest_never_grant_run_metrics(client, make_user):
    make_user("ana")
    w = create(client)
    complete = client.put(f"/training/workouts/{w['id']}/status", json={"status": "completed", "revision": 1}).json()
    assert complete["completionSource"] == "manual" and complete["activity"] is None
    assert client.get("/activities/user/ana").json() == []
    assert client.get("/users/ana").json()["totalXP"] == 0
    assert client.patch(f"/training/workouts/{w['id']}", json={**payload(), "revision": 2}).status_code == 409
    rest = create(client, category="rest", targetDistanceKm=None)
    assert client.put(f"/training/workouts/{rest['id']}/status", json={"status": "completed", "revision": 1}).status_code == 200


def test_link_is_idempotent_unique_and_preserves_actual_distance(client, make_user):
    make_user("ana")
    run = client.post("/activities", json=run_payload("ana", km=4.7, seconds=1500)).json()["id"]
    w = create(client)
    link = {"activityId": run, "revision": 1}
    first = client.put(f"/training/workouts/{w['id']}/activity", json=link)
    assert first.status_code == 200 and first.json()["activity"]["distance"] == 4.7
    assert first.json()["targetDistanceKm"] == 5
    again = client.put(f"/training/workouts/{w['id']}/activity", json=link)
    assert again.status_code == 200 and again.json()["revision"] == 2
    other = create(client)
    assert client.put(f"/training/workouts/{other['id']}/activity", json=link).status_code == 409
    assert len(client.get("/activities/user/ana").json()) == 1
    assert client.get("/users/ana").json()["totalXP"] == 470


def test_link_cannot_use_foreign_activity_or_rest(client, make_user):
    make_user("ana")
    own_run = client.post("/activities", json=run_payload("ana")).json()["id"]
    rest = create(client, category="rest", targetDistanceKm=None)
    assert client.put(f"/training/workouts/{rest['id']}/activity", json={"activityId": own_run, "revision": 1}).status_code == 409
    make_user("bruno")
    w = create(client)
    assert client.put(f"/training/workouts/{w['id']}/activity", json={"activityId": own_run, "revision": 1}).status_code == 404


@pytest.mark.parametrize("bulk", [False, True])
def test_deleting_activity_reopens_calendar_and_keeps_goal(client, make_user, bulk):
    make_user("ana")
    run = client.post("/activities", json=run_payload("ana")).json()["id"]
    w = create(client)
    client.put(f"/training/workouts/{w['id']}/activity", json={"activityId": run, "revision": 1})
    path = "/activities/user/ana/all" if bulk else f"/activities/{run}"
    assert client.delete(path).status_code == 200
    fresh = client.get(f"/training/workouts/{w['id']}").json()
    assert fresh["status"] == "planned" and fresh["completedActivityId"] is None
    assert fresh["evidenceRemoved"] is True and fresh["targetDistanceKm"] == 5
    assert fresh["revision"] == 3


def test_deleting_plan_preserves_run_and_public_schema(client, make_user):
    make_user("ana")
    run = client.post("/activities", json=run_payload("ana")).json()["id"]
    w = create(client, notes="segredo", plannedDate="2026-12-01")
    client.put(f"/training/workouts/{w['id']}/activity", json={"activityId": run, "revision": 1})
    feed = client.get("/activities/feed").json()
    assert "plannedDate" not in feed[0] and "segredo" not in str(feed)
    assert client.delete(f"/training/workouts/{w['id']}?revision=2").status_code == 204
    assert len(client.get("/activities/user/ana").json()) == 1


def test_weekly_summary_separates_planning_author_report_and_actual_runs(client, make_user, db):
    make_user("ana")
    w = create(client, plannedDate="2026-09-28")
    client.put(f"/training/workouts/{w['id']}/status", json={"status": "completed", "revision": 1})
    create(client, plannedDate="2026-09-29", category="rest", targetDistanceKm=None)
    cancelled = create(client, plannedDate="2026-09-30", targetDistanceKm=20)
    client.put(f"/training/workouts/{cancelled['id']}/status", json={"status": "cancelled", "revision": 1})
    create(client, plannedDate="2026-10-01", targetDistanceKm=3)
    run_id = client.post("/activities", json=run_payload("ana", km=4, seconds=1200)).json()["id"]
    activity = db.get(Activity, int(run_id))
    activity.created_at = datetime(2026, 9, 29, 12, tzinfo=timezone.utc)
    db.commit()
    summary = client.get("/training/summary?week=2026-09-28&zone=America/Sao_Paulo").json()
    assert summary["plannedCount"] == 2 and summary["completedCount"] == 1
    assert summary["manualCount"] == 1 and summary["restCount"] == 1
    assert summary["targetKm"] == 8 and summary["recordedKm"] == 4
    assert summary["completionRate"] == 50


def test_bounded_pagination_and_account_cascade(client, make_user, db):
    make_user("ana")
    for _ in range(3):
        create(client)
    today = date.today().isoformat()
    page = client.get(f"/training/workouts?from={today}&to={today}&limit=2").json()
    assert len(page["items"]) == 2 and page["nextOffset"] == 2 and page["total"] == 3
    second = client.get(f"/training/workouts?from={today}&to={today}&limit=2&offset=2").json()
    assert len(second["items"]) == 1 and second["nextOffset"] is None
    assert client.get("/training/workouts?from=2026-01-01&to=2026-12-31").status_code == 422
    assert client.get("/training/summary?week=2026-10-08").status_code == 422
    assert client.get("/training/summary?week=2026-10-05&zone=Invalid/Zone").status_code == 422
    assert client.delete("/users/ana").status_code == 204
    assert db.query(PlannedWorkout).count() == 0


def test_next_workout_excludes_completed_cancelled_and_past(client, make_user):
    make_user("ana")
    create(client, plannedDate="2026-01-01")
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    done = create(client, plannedDate=tomorrow)
    client.put(f"/training/workouts/{done['id']}/status", json={"status": "completed", "revision": 1})
    upcoming = create(client, title="Próximo", plannedDate=tomorrow)
    assert client.get("/training/next").json()["id"] == upcoming["id"]


def test_next_workout_orders_different_timezones_by_actual_instant(client, make_user):
    make_user("ana")
    now = datetime.now(timezone.utc)
    close = (now + timedelta(minutes=30)).astimezone(ZoneInfo("Pacific/Kiritimati"))
    far = (now + timedelta(hours=2)).astimezone(ZoneInfo("America/Los_Angeles"))
    expected = create(client, title="Mais próximo", plannedDate=close.date().isoformat(), plannedTime=close.strftime("%H:%M"), timezone="Pacific/Kiritimati")
    create(client, title="Mais distante", plannedDate=far.date().isoformat(), plannedTime=far.strftime("%H:%M"), timezone="America/Los_Angeles")
    assert client.get("/training/next").json()["id"] == expected["id"]
