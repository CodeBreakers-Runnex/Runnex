from datetime import datetime, timedelta, timezone

import pytest
from pydantic import ValidationError

from app.routers.health_imports import ImportedRun, ImportBatch


def make_run(**changes):
    start = datetime.now(timezone.utc) - timedelta(hours=2)
    values = dict(
        external_id="hc-123",
        source="com.example.watch",
        started_at=start,
        ended_at=start + timedelta(minutes=30),
        distance_meters=5000,
    )
    values.update(changes)
    return values


def test_valid_running_session():
    run = ImportedRun(**make_run())
    assert run.distance_meters == 5000


def test_reject_impossible_speed():
    with pytest.raises(ValidationError):
        ImportedRun(**make_run(distance_meters=100000))


def test_reject_timezone_naive_dates():
    with pytest.raises(ValidationError):
        ImportedRun(**make_run(started_at=datetime.now()))


def test_reject_empty_source():
    with pytest.raises(ValidationError):
        ImportedRun(**make_run(source=""))


def test_batch_limit():
    run = ImportedRun(**make_run())
    with pytest.raises(ValidationError):
        ImportBatch(runs=[run] * 101)
