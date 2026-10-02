import pytest
from fastapi import HTTPException

from app import rate_limit as rate_limit_module
from app.auth import FirebaseUser


@pytest.fixture(autouse=True)
def fake_clock(monkeypatch):
    rate_limit_module._hits.clear()
    clock = {"now": 1000.0}
    monkeypatch.setattr(rate_limit_module.time, "monotonic", lambda: clock["now"])
    yield clock
    rate_limit_module._hits.clear()


def user(uid: str) -> FirebaseUser:
    return FirebaseUser(uid=uid, email=None, email_verified=True)


def test_blocks_after_limit_with_retry_after(fake_clock):
    check = rate_limit_module.rate_limit("test", 3, 60)
    for _ in range(3):
        check(user("ana"))

    with pytest.raises(HTTPException) as exc:
        check(user("ana"))
    assert exc.value.status_code == 429
    assert exc.value.headers == {"Retry-After": "60"}


def test_counts_per_user_and_per_bucket():
    likes = rate_limit_module.rate_limit("likes", 1, 60)
    posts = rate_limit_module.rate_limit("posts", 1, 60)
    likes(user("ana"))
    likes(user("bruno"))
    posts(user("ana"))
    with pytest.raises(HTTPException):
        likes(user("ana"))


def test_window_expires(fake_clock):
    check = rate_limit_module.rate_limit("test", 1, 60)
    check(user("ana"))
    fake_clock["now"] += 60
    check(user("ana"))
