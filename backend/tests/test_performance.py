from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from app.performance import best_segment, heart_summary, performance_summary


def points(*pairs):
    return [{"distanceKm": d, "elapsedSeconds": t} for d, t in pairs]


def activity(**overrides):
    return SimpleNamespace(**(dict(id=1, distance=6, duration_seconds=1800, created_at=datetime(2026, 10, 8, 12, tzinfo=timezone.utc), is_simulated=False, performance_samples=points((0, 0), (3, 900), (6, 1800)), heart_rate_samples=None, heart_rate_max_bpm=None) | overrides))


def test_record_uses_fastest_segment_not_average_run_pace():
    # First 5km: 1800s. Last 5km: 1200s. Whole-run projection would be 1500s.
    assert best_segment(points((0, 0), (5, 1800), (10, 3000)), 5) == 1200


def test_record_interpolates_at_both_edges():
    assert best_segment(points((0, 0), (2, 1000), (4, 1200)), 1) == 100


def test_short_run_is_not_projected_as_marathon():
    assert best_segment(points((0, 0), (5, 1800)), 42.195) is None
    assert best_segment([], 1) is None


def test_hr_boundaries_and_gaps():
    samples = [{"elapsedSeconds": i * 5, "bpm": bpm} for i, bpm in enumerate([100, 120, 140, 160, 180, 200])]
    summary = heart_summary(samples, 200)
    assert [z["seconds"] for z in summary["zones"]] == [5, 5, 5, 5, 5]
    assert summary["averageBpm"] == 140 and summary["maxBpm"] == 200
    assert heart_summary([{"elapsedSeconds": 0, "bpm": 100}, {"elapsedSeconds": 20, "bpm": 200}], 200)["coveredSeconds"] == 0
    assert heart_summary([], 200) is None


def test_hr_below_zone_and_above_reference_are_not_lost():
    summary = heart_summary([{"elapsedSeconds": t, "bpm": b} for t, b in [(0, 90), (5, 220), (10, 180)]], 200)
    assert summary["belowZoneSeconds"] == 5
    assert summary["zones"][4]["seconds"] == 5


def test_legacy_runs_count_in_evolution_but_not_segment_records():
    result = performance_summary([activity(performance_samples=None)], datetime(2026, 10, 8, 12, tzinfo=timezone.utc))
    assert all(r["best"] is None for r in result["records"])
    assert result["evolution"]["week"][-1]["km"] == 6
    assert result["heartRate"] is None


def test_simulation_does_not_create_records_or_evolution():
    result = performance_summary([activity(is_simulated=True)], datetime(2026, 10, 8, tzinfo=timezone.utc))
    assert all(r["best"] is None for r in result["records"])
    assert result["evolution"]["month"][-1]["runs"] == 0


def test_evolution_uses_weighted_pace_and_timezone():
    now = datetime(2026, 10, 8, 12, tzinfo=timezone.utc)
    rows = [activity(distance=1, duration_seconds=600), activity(id=2, distance=9, duration_seconds=2700)]
    result = performance_summary(rows, now, -180)
    assert result["evolution"]["week"][-1]["paceSecondsPerKm"] == 330
    assert len(result["evolution"]["month"]) == 8
    january = performance_summary([], datetime(2026, 1, 2, tzinfo=timezone.utc), -180)
    assert january["evolution"]["month"][-2]["start"] == "2025-12-01"


def test_validation_rejects_non_monotonic_or_out_of_run_samples():
    from app.schemas import ActivityCreate
    from tests.helpers import run_payload
    for samples in (points((0, 0), (1, 100), (.5, 200)), points((0, 0), (1, 1801)), points((0, 0), (6, 1800))):
        with pytest.raises(ValueError):
            ActivityCreate.model_validate(run_payload("ana", performanceSamples=samples))
    with pytest.raises(ValueError):
        ActivityCreate.model_validate(run_payload("ana", heartRateSamples=[{"elapsedSeconds": 10, "bpm": 150}]))


def test_performance_endpoint_is_self_only_and_samples_persist(client, make_user, login):
    from tests.helpers import run_payload
    make_user("ana")
    payload = run_payload("ana", performanceSamples=points((0, 0), (5, 1800)), heartRateMaxBpm=200,
                          heartRateSamples=[{"elapsedSeconds": 10, "bpm": 120}, {"elapsedSeconds": 15, "bpm": 140}])
    assert client.post("/activities", json=payload).status_code == 200
    summary = client.get("/activities/performance/me").json()
    assert summary["records"][1]["best"]["durationSeconds"] == 1800
    assert summary["heartRate"]["averageBpm"] == 120
    make_user("bruno")
    assert all(r["best"] is None for r in client.get("/activities/performance/me").json()["records"])
    assert client.get("/activities/performance/me?utc_offset_minutes=2000").status_code == 422


def test_record_does_not_join_paused_segments():
    samples = points((0, 0), (.6, 180), (.6, 181), (1.2, 360))
    for point in samples[2:]:
        point['segmentId'] = 1
    assert best_segment(samples, 1) is None


def test_record_starts_after_stationary_interval():
    assert best_segment(points((0, 0), (1, 600), (1, 900), (2, 1200)), 1) == 300


def test_hr_does_not_bridge_short_disconnect_or_pause():
    samples = [{'elapsedSeconds': 0, 'bpm': 100, 'segmentId': 0},
               {'elapsedSeconds': 5, 'bpm': 180, 'segmentId': 1},
               {'elapsedSeconds': 10, 'bpm': 180, 'segmentId': 1}]
    result = heart_summary(samples, 200)
    assert result['coveredSeconds'] == 5
    assert result['averageBpm'] == 180


@pytest.mark.parametrize('target', [1, 5, 10, 21.0975, 42.195])
def test_all_record_distances_with_fractional_start(target):
    # Cancellation at non-zero start distances must not index past the array.
    assert best_segment(points((.3, 100), (.3 + target, 100 + target * 300)), target) == pytest.approx(target * 300)


def test_schema_accepts_stationary_points_and_rejects_segment_regression():
    from app.schemas import ActivityCreate
    from tests.helpers import run_payload
    samples = points((0, 0), (1, 600), (1, 900), (2, 1200))
    assert len(ActivityCreate.model_validate(run_payload('ana', performanceSamples=samples)).performance_samples) == 4
    samples[1]['segmentId'] = 2
    samples[2]['segmentId'] = 1
    with pytest.raises(ValueError):
        ActivityCreate.model_validate(run_payload('ana', performanceSamples=samples))


@pytest.mark.parametrize('extra', [
    {'performanceSamples': points((0, 0), (float('nan'), 10))},
    {'performanceSamples': points((0, 0), (1, float('inf')))},
    {'heartRateSamples': [{'elapsedSeconds': 0, 'bpm': 251}], 'heartRateMaxBpm': 200},
    {'heartRateSamples': [{'elapsedSeconds': 0, 'bpm': 120}, {'elapsedSeconds': 0, 'bpm': 130}], 'heartRateMaxBpm': 200},
    {'heartRateSamples': [{'elapsedSeconds': 1801, 'bpm': 120}], 'heartRateMaxBpm': 200},
    {'heartRateSamples': [{'elapsedSeconds': 0, 'bpm': 120, 'segmentId': 2}, {'elapsedSeconds': 1, 'bpm': 130, 'segmentId': 1}], 'heartRateMaxBpm': 200},
])
def test_schema_rejects_invalid_sensor_data(extra):
    from app.schemas import ActivityCreate
    from tests.helpers import run_payload
    with pytest.raises(ValueError):
        ActivityCreate.model_validate(run_payload('ana', **extra))


def test_timezone_moves_sunday_utc_run_into_previous_local_week():
    now = datetime(2026, 10, 5, 12, tzinfo=timezone.utc)
    result = performance_summary([activity(created_at=datetime(2026, 10, 5, 1, tzinfo=timezone.utc))], now, -180)
    assert result['evolution']['week'][-1]['runs'] == 0
    assert result['evolution']['week'][-2]['runs'] == 1


def test_segment_api_endpoint_persists_breaks_and_delete_removes_record(client, make_user):
    from tests.helpers import run_payload
    make_user('ana')
    samples = points((0, 0), (.6, 180), (.6, 181), (1.2, 360))
    for p in samples[2:]:
        p['segmentId'] = 1
    payload = run_payload('ana', performanceSamples=samples, heartRateMaxBpm=200,
                          heartRateSamples=[{'elapsedSeconds': 0, 'bpm': 100, 'segmentId': 0},
                                             {'elapsedSeconds': 5, 'bpm': 180, 'segmentId': 1},
                                             {'elapsedSeconds': 10, 'bpm': 180, 'segmentId': 1}])
    response = client.post('/activities', json=payload)
    assert response.status_code == 200
    summary = client.get('/activities/performance/me').json()
    assert summary['records'][0]['best'] is None
    assert summary['heartRate']['coveredSeconds'] == 5
    feed = client.get('/activities/feed').json()
    assert 'heartRateSamples' not in feed[0] and 'performanceSamples' not in feed[0]
    assert client.delete('/activities/' + response.json()['id']).status_code == 200
    assert client.get('/activities/performance/me').json()['heartRate'] is None
