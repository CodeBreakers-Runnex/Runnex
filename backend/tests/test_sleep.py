from datetime import timedelta, timezone

import pytest

from app.models.sleep import RecoveryPreferences, SleepCheckIn, SleepImportExclusion, SleepSession
from app.schemas_sleep import SLEEP_CONSENT_VERSION
from app.time_utils import utcnow


def manual_payload(*, hours=7, days_ago=0, offset=0, **changes):
    end = utcnow().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days_ago)
    payload = {"startTime": (end - timedelta(hours=8)).isoformat(), "endTime": end.isoformat(), "sleepSeconds": int(hours * 3600) if hours is not None else None, "kind": "main", "endOffsetMinutes": offset}
    return {**payload, **changes}


def activate(client):
    response = client.post("/recovery/consent", json={"version": SLEEP_CONSENT_VERSION, "accepted": True, "timezone": "UTC"})
    assert response.status_code == 200, response.text
    return response.json()


def connect(client):
    activate(client)
    response = client.put("/recovery/connection", json={"enabled": True})
    assert response.status_code == 200, response.text
    return response.json()["syncGeneration"]


def imported(external_id="night-1", **changes):
    payload = {**manual_payload(), "externalId": external_id, "origin": "com.example.sleep", "originLabel": "Relógio de teste", "sourceModifiedAt": utcnow().isoformat()}
    return {**payload, **changes}


def send_batch(client, generation, records=None, **changes):
    return client.post("/recovery/import", json={"syncGeneration": generation, "records": records or [], "deletedIds": [], **changes})


def test_sleep_requires_consent_and_verified_email(client, make_user, login):
    make_user("ana")
    assert client.post("/recovery/sleep", json=manual_payload()).status_code == 403
    assert client.get("/recovery/overview").json()["settings"]["consented"] is False
    login("ana", email_verified=False)
    assert client.get("/recovery/overview").status_code == 403
    assert client.post("/recovery/consent", json={"version": SLEEP_CONSENT_VERSION, "accepted": True}).status_code == 403


def test_manual_sleep_edit_delete_and_missing_data(client, make_user):
    make_user("ana")
    activate(client)
    before = client.get("/recovery/overview").json()
    assert before["today"]["sleepMinutes"] is None
    assert len(before["history"]) == 7
    response = client.post("/recovery/sleep", json=manual_payload(hours=6.5))
    assert response.status_code == 201, response.text
    session_id = response.json()["id"]
    assert client.get("/recovery/overview").json()["today"]["sleepMinutes"] == 390
    assert client.put(f"/recovery/sleep/{session_id}", json=manual_payload(hours=7)).status_code == 200
    assert client.get("/recovery/overview").json()["today"]["sleepMinutes"] == 420
    assert client.delete(f"/recovery/sleep/{session_id}").status_code == 204
    assert client.get("/recovery/overview").json()["today"]["mainSession"] is None


def test_period_is_not_assumed_to_be_time_asleep(client, make_user):
    make_user("ana")
    activate(client)
    assert client.post("/recovery/sleep", json=manual_payload(hours=None)).status_code == 201
    result = client.get("/recovery/overview").json()["today"]
    assert result["sleepMinutes"] is None
    assert result["mainSession"]["periodSeconds"] == 8 * 3600
    assert result["status"] == "insufficient"


def test_zero_sleep_is_preserved_and_goals_and_fatigue_explain_signals(client, make_user):
    make_user("ana")
    activate(client)
    assert client.put("/recovery/preferences", json={"goalMinutes": 450, "timezone": "UTC"}).status_code == 200
    assert client.post("/recovery/sleep", json=manual_payload(hours=0)).status_code == 201
    today = utcnow().date().isoformat()
    assert client.put(f"/recovery/check-in/{today}", json={"quality": 2, "fatigue": 4}).status_code == 200
    result = client.get("/recovery/overview").json()["today"]
    assert result["sleepMinutes"] == 0
    assert result["signals"] == ["below_goal", "fatigue"]
    assert result["status"] == "attention"
    assert client.delete(f"/recovery/check-in/{today}").status_code == 204


def test_overnight_record_uses_offset_of_waking_time(client, make_user):
    make_user("ana")
    activate(client)
    result = client.post("/recovery/sleep", json=manual_payload(offset=-180)).json()
    assert result["wakeDate"] == (utcnow().date() - timedelta(days=1)).isoformat()


def test_import_replay_updates_but_never_overwrites_with_older_version(client, make_user, db):
    make_user("ana")
    generation = connect(client)
    original = imported()
    assert send_batch(client, generation, [original]).status_code == 200
    assert send_batch(client, generation, [original]).status_code == 200
    assert db.query(SleepSession).count() == 1
    newer = {**original, "sleepSeconds": 6 * 3600, "sourceModifiedAt": (utcnow() + timedelta(seconds=1)).isoformat()}
    assert send_batch(client, generation, [newer]).status_code == 200
    assert send_batch(client, generation, [original]).status_code == 200
    assert client.get("/recovery/overview").json()["today"]["sleepMinutes"] == 360


def test_deletion_from_source_removes_import_without_touching_manual(client, make_user, db):
    make_user("ana")
    generation = connect(client)
    send_batch(client, generation, [imported()])
    client.post("/recovery/sleep", json=manual_payload())
    response = send_batch(client, generation, deletedIds=["night-1"])
    assert response.status_code == 200
    assert db.query(SleepSession).count() == 1
    assert db.query(SleepSession).one().source == "manual"


def test_user_deletion_of_imported_record_survives_replay(client, make_user, db):
    make_user("ana")
    generation = connect(client)
    record = imported()
    send_batch(client, generation, [record])
    session_id = client.get("/recovery/overview").json()["sessions"][0]["id"]
    assert client.delete(f"/recovery/sleep/{session_id}").status_code == 204
    assert send_batch(client, generation, [record]).status_code == 200
    assert db.query(SleepSession).count() == 0
    assert db.query(SleepImportExclusion).count() == 1


def test_complete_snapshot_reconciles_only_the_read_window(client, make_user, db):
    make_user("ana")
    generation = connect(client)
    old = imported("old", **manual_payload(days_ago=50))
    send_batch(client, generation, [imported(), old])
    now = utcnow()
    response = send_batch(client, generation, snapshotStart=(now - timedelta(days=30)).isoformat(), snapshotEnd=now.isoformat())
    assert response.status_code == 200, response.text
    assert db.query(SleepSession).count() == 1
    assert db.query(SleepSession).one().external_id == "old"


def test_multiple_sources_and_manual_correction_do_not_double_count(client, make_user):
    make_user("ana")
    generation = connect(client)
    send_batch(client, generation, [imported("one"), imported("two", origin="com.other.sleep", sleepSeconds=6 * 3600)])
    assert client.get("/recovery/overview").json()["today"]["sleepMinutes"] == 360
    client.put("/recovery/preferences", json={"timezone": "UTC", "preferredOrigin": "com.example.sleep"})
    assert client.get("/recovery/overview").json()["today"]["sleepMinutes"] == 420
    client.post("/recovery/sleep", json=manual_payload(hours=5))
    client.post("/recovery/sleep", json=manual_payload(hours=1, kind="nap"))
    result = client.get("/recovery/overview").json()["today"]
    assert result["sleepMinutes"] == 300
    assert result["napCount"] == 1


def test_sleep_private_even_with_public_profile_and_no_owner_override(client, make_user, login):
    make_user("ana")
    activate(client)
    record = client.post("/recovery/sleep", json=manual_payload()).json()
    make_user("bia")
    activate(client)
    assert client.get("/recovery/overview").json()["sessions"] == []
    assert client.get("/recovery/export").json()["sleepSessions"] == []
    assert client.delete(f"/recovery/sleep/{record['id']}").status_code == 404
    assert client.put(f"/recovery/sleep/{record['id']}", json=manual_payload()).status_code == 404
    assert client.post("/recovery/sleep", json={**manual_payload(), "userId": "ana"}).status_code == 422
    assert "sleepSessions" not in client.get("/users/ana").json()
    login("ana")
    assert len(client.get("/recovery/export").json()["sleepSessions"]) == 1


def test_disconnect_and_erase_invalidate_inflight_imports(client, make_user, db):
    make_user("ana")
    generation = connect(client)
    send_batch(client, generation, [imported()])
    assert client.put("/recovery/connection", json={"enabled": False}).status_code == 200
    assert send_batch(client, generation, [imported()]).status_code == 409
    assert db.query(SleepSession).count() == 1
    assert client.delete("/recovery/data").status_code == 204
    assert send_batch(client, generation, [imported()]).status_code == 403
    activate(client)
    client.put("/recovery/connection", json={"enabled": True})
    assert send_batch(client, generation, [imported()]).status_code == 409
    assert db.query(SleepSession).count() == 0


def test_account_deletion_cascades_all_sleep_tables(client, make_user, db):
    make_user("ana")
    generation = connect(client)
    send_batch(client, generation, [imported()])
    client.put(f"/recovery/check-in/{utcnow().date()}", json={"fatigue": 2})
    assert client.delete("/users/ana").status_code == 204
    for model in (SleepSession, SleepCheckIn, RecoveryPreferences, SleepImportExclusion):
        assert db.query(model).count() == 0


def test_trend_requires_seven_valid_days_and_preserves_gaps(client, make_user):
    make_user("ana")
    activate(client)
    for day in range(6):
        client.post("/recovery/sleep", json=manual_payload(days_ago=day))
    result = client.get("/recovery/overview?days=30").json()
    assert len(result["history"]) == 30
    assert result["trend"]["averageMinutes"] is None
    assert result["trend"]["validDays"] == 6
    client.post("/recovery/sleep", json=manual_payload(days_ago=7))
    result = client.get("/recovery/overview?days=30").json()
    assert result["trend"]["averageMinutes"] == 420
    assert result["history"][6]["sleepMinutes"] is None


@pytest.mark.parametrize("changes", [{"sleepSeconds": 9 * 3600}, {"startTime": "2026-10-01T00:00:00"}, {"kind": "other"}, {"endOffsetMinutes": 1000}, {"source": "health_connect"}])
def test_invalid_sleep_payloads_are_rejected(client, make_user, changes):
    make_user("ana")
    activate(client)
    assert client.post("/recovery/sleep", json=manual_payload(**changes)).status_code == 422


def test_invalid_timezone_goal_and_empty_checkin_are_rejected(client, make_user):
    make_user("ana")
    activate(client)
    assert client.put("/recovery/preferences", json={"timezone": "Mars/Olympus"}).status_code == 422
    assert client.put("/recovery/preferences", json={"goalMinutes": 0}).status_code == 422
    assert client.put(f"/recovery/check-in/{utcnow().date()}", json={}).status_code == 422


def test_old_health_records_are_purged_on_access(client, make_user, db):
    make_user("ana")
    activate(client)
    end = utcnow() - timedelta(days=92)
    db.add(SleepSession(user_id="ana", source="manual", origin="runnex", start_time=end - timedelta(hours=8), end_time=end, wake_date=end.date(), sleep_seconds=7 * 3600, kind="main"))
    db.add(SleepCheckIn(user_id="ana", day=end.date(), quality=3))
    db.commit()
    assert client.get("/recovery/export").status_code == 200
    assert db.query(SleepSession).count() == 0
    assert db.query(SleepCheckIn).count() == 0
