import pytest

from app.listing import MAX_PAGE_SIZE
from tests.helpers import run_payload


@pytest.fixture
def private_runner(client, make_user):
    """Ana (privada) salva uma corrida; termina logado como Bruno (publico)."""
    make_user("ana", privateProfile=True)
    assert client.post("/activities", json=run_payload("ana")).status_code == 200
    make_user("bruno")
    assert client.post("/activities", json=run_payload("bruno")).status_code == 200


def test_private_runs_are_hidden_from_global_feed(client, private_runner):
    # Regressao: a corrida da conta privada aparecia no feed de todos, com a rota GPS
    assert [a["userId"] for a in client.get("/activities/feed").json()] == ["bruno"]


def test_private_user_still_sees_own_runs_in_feed(client, private_runner, login):
    login("ana")
    assert {a["userId"] for a in client.get("/activities/feed").json()} == {"ana", "bruno"}


def test_private_runs_are_hidden_from_group_feed(client, private_runner):
    runs = client.get("/activities/by-users?user_ids=ana,bruno").json()
    assert [a["userId"] for a in runs] == ["bruno"]


def test_private_profile_is_hidden_from_by_ids(client, private_runner, login):
    assert [u["uid"] for u in client.get("/users/by-ids?ids=ana,bruno").json()] == ["bruno"]
    login("ana")
    assert {u["uid"] for u in client.get("/users/by-ids?ids=ana,bruno").json()} == {"ana", "bruno"}


def test_listing_limit_is_capped(client, login, db):
    from app.models import Activity, User

    login("ana")
    client.put("/users/ana", json={"displayName": "Ana"})
    db.add_all(
        Activity(user_id="ana", user_name="Ana", distance=1.0, time="06:00", duration_seconds=360,
                 pace="6'00\"", type="RUNNING", likes=[])
        for _ in range(MAX_PAGE_SIZE + 5)
    )
    db.commit()
    assert db.get(User, "ana") is not None

    assert len(client.get("/activities/feed?limit=1000000").json()) == MAX_PAGE_SIZE
    assert len(client.get("/activities/by-users?user_ids=ana&limit=1000000").json()) == MAX_PAGE_SIZE
    # O proprio usuario continua podendo buscar tudo (estatisticas do app)
    assert len(client.get("/activities/user/ana?limit=100000").json()) == MAX_PAGE_SIZE + 5

    login("bruno")
    assert len(client.get("/activities/user/ana?limit=100000").json()) == MAX_PAGE_SIZE
