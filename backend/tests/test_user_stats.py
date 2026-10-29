from datetime import datetime, timezone

from app.user_stats import compute_user_stats, current_streak

# Quarta-feira, 28/10/2026, 15h em UTC (12h em Brasilia, UTC-3).
NOW = datetime(2026, 10, 28, 15, tzinfo=timezone.utc)
BRT = -180


def at(day: int, hour: int, minute: int = 0) -> datetime:
    return datetime(2026, 10, day, hour, minute, tzinfo=timezone.utc)


def test_totals_and_single_run_flags():
    rows = [(5.0, 1800, 300, at(27, 12)), (10.5, 3500, None, at(20, 12)), (3.0, 3600, 200, at(10, 12))]
    stats = compute_user_stats(rows, NOW, BRT)
    assert stats["runsCount"] == 3
    assert stats["totalKm"] == 18.5
    assert stats["totalSeconds"] == 8900
    assert stats["totalCalories"] == 500
    assert stats["hasHourLongRun"] is True
    assert stats["hasSub10kRun"] is True


def test_no_runs_returns_zeros():
    stats = compute_user_stats([], NOW, BRT)
    assert stats["runsCount"] == 0
    assert stats["currentStreak"] == 0
    assert [day["km"] for day in stats["weeklyData"]] == [0] * 7
    assert stats["weeklyData"][-1]["day"] == "QUA"


def test_week_and_hours_use_the_user_timezone():
    # 01h UTC do dia 28 = 22h do dia 27 em Brasilia: conta no dia 27 e como noite.
    rows = [(4.0, 1500, None, at(28, 1)), (2.0, 700, None, at(28, 9, 30))]  # 06h30 BRT: amanhecer
    stats = compute_user_stats(rows, NOW, BRT)
    labels = [day["day"] for day in stats["weeklyData"]]
    assert labels == ["QUI", "SEX", "SÁB", "DOM", "SEG", "TER", "QUA"]
    assert stats["weeklyData"][-2]["km"] == 4.0
    assert stats["weeklyData"][-1]["km"] == 2.0
    assert stats["weeklyTotalKm"] == 6.0
    assert stats["nightRunsCount"] == 1
    assert stats["dawnRunsCount"] == 1


def test_runs_older_than_a_week_stay_out_of_the_chart():
    stats = compute_user_stats([(8.0, 2400, None, at(21, 12))], NOW, BRT)
    assert stats["weeklyTotalKm"] == 0
    assert stats["totalKm"] == 8.0


def test_streak_counts_from_today_or_yesterday():
    today = NOW.date()
    yesterday = today.replace(day=27)
    assert current_streak({today, yesterday, today.replace(day=26)}, today) == 3
    assert current_streak({yesterday, today.replace(day=26)}, today) == 2
    assert current_streak({today.replace(day=26)}, today) == 0


def test_stats_endpoint_is_self_only(client, make_user, login):
    from tests.helpers import run_payload

    make_user("bruno")
    assert client.post("/activities", json=run_payload("bruno", km=20, seconds=7000)).status_code == 200

    make_user("ana")
    assert client.post("/activities", json=run_payload("ana", km=12, seconds=3500)).status_code == 200
    last = client.post("/activities", json=run_payload("ana", km=5, seconds=1800)).json()["id"]

    response = client.get(f"/activities/stats/me?utc_offset_minutes={BRT}")
    assert response.status_code == 200
    stats = response.json()
    assert stats["runsCount"] == 2
    assert stats["totalKm"] == 17
    assert stats["totalSeconds"] == 5300
    assert stats["hasSub10kRun"] is True
    assert stats["lastActivity"]["id"] == last
    assert stats["bestActivity"]["distance"] == 12
    assert stats["bestActivity"]["userId"] == "ana"
    assert "route" in stats["bestActivity"] and "heartRateSamples" not in stats["bestActivity"]
    assert stats["currentStreak"] == 1

    assert client.get("/activities/stats/me?utc_offset_minutes=2000").status_code == 422
