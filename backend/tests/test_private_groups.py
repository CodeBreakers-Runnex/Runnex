"""Grupo privado: so entra quem tem o codigo gerado pelo servidor."""

import pytest


@pytest.fixture
def private_group(client, make_user, db):
    """Ana (VIP, que e quem pode criar grupo privado) cria um; termina logada como Ana."""
    from app.models import User

    make_user("ana", "Ana")
    db.get(User, "ana").is_vip = True
    db.commit()
    created = client.post("/groups", json={"name": "Grupo Secreto", "city": "SP", "private": True})
    assert created.status_code == 200, created.text
    return created.json()


def test_public_group_is_unchanged(client, make_user):
    make_user("ana", "Ana")
    group = client.post("/groups", json={"name": "Aberto"}).json()
    assert group["isPrivate"] is False
    assert "joinCode" not in group or group["joinCode"] is None


def test_create_private_returns_code_once(client, private_group):
    assert private_group["isPrivate"] is True
    code = private_group["joinCode"]
    assert isinstance(code, str) and len(code) >= 8
    # Nas leituras seguintes o codigo nao aparece (so o hash fica guardado).
    again = client.get(f"/groups/{private_group['id']}").json()
    assert "joinCode" not in again or again["joinCode"] is None
    listed = client.get("/groups").json()
    assert all("joinCode" not in g or g["joinCode"] is None for g in listed)


def test_join_private_requires_correct_code(client, private_group, make_user):
    group_id = private_group["id"]
    make_user("bruno", "Bruno")
    assert client.post(f"/groups/{group_id}/join").status_code == 403
    assert client.post(f"/groups/{group_id}/join", json={}).status_code == 403
    assert client.post(f"/groups/{group_id}/join", json={"code": "ERRADO123"}).status_code == 403
    assert client.get(f"/groups/{group_id}/posts").status_code == 403  # continua de fora

    joined = client.post(f"/groups/{group_id}/join", json={"code": private_group["joinCode"]})
    assert joined.status_code == 200
    assert "bruno" in joined.json()["memberIds"]
    assert client.get(f"/groups/{group_id}/posts").status_code == 200


def test_code_is_case_and_space_insensitive(client, private_group, make_user):
    make_user("bruno", "Bruno")
    typed = f"  {private_group['joinCode'].lower()} "
    assert client.post(f"/groups/{private_group['id']}/join", json={"code": typed}).status_code == 200


def test_member_can_rejoin_without_code(client, private_group, make_user, login):
    group_id = private_group["id"]
    make_user("bruno", "Bruno")
    client.post(f"/groups/{group_id}/join", json={"code": private_group["joinCode"]})
    again = client.post(f"/groups/{group_id}/join")  # dois toques, sem codigo
    assert again.status_code == 200


def test_leaving_requires_code_again(client, private_group, make_user):
    group_id = private_group["id"]
    make_user("bruno", "Bruno")
    client.post(f"/groups/{group_id}/join", json={"code": private_group["joinCode"]})
    client.post(f"/groups/{group_id}/leave")
    assert client.post(f"/groups/{group_id}/join").status_code == 403


def test_non_members_do_not_see_member_ids(client, private_group, make_user):
    group_id = private_group["id"]
    make_user("bruno", "Bruno")
    seen = client.get(f"/groups/{group_id}").json()
    assert seen["isPrivate"] is True
    assert seen["memberIds"] == []
    assert seen["membersCount"] == 1  # a contagem continua visivel
    listed = next(g for g in client.get("/groups").json() if g["id"] == group_id)
    assert listed["memberIds"] == []


def test_members_still_see_member_ids(client, private_group, login):
    login("ana")
    assert client.get(f"/groups/{private_group['id']}").json()["memberIds"] == ["ana"]


def test_wrong_codes_are_rate_limited(client, private_group, make_user):
    group_id = private_group["id"]
    make_user("bruno", "Bruno")
    statuses = [client.post(f"/groups/{group_id}/join", json={"code": f"TENTATIVA{i}"}).status_code for i in range(12)]
    assert statuses[:10] == [403] * 10
    assert 429 in statuses[10:]
    # Mesmo acertando, o limite vale: o bloqueio nao pode ser contornado.
    assert client.post(f"/groups/{group_id}/join", json={"code": private_group["joinCode"]}).status_code == 429


def test_public_join_is_not_affected_by_code_limit(client, make_user):
    make_user("ana", "Ana")
    group_id = client.post("/groups", json={"name": "Aberto"}).json()["id"]
    make_user("bruno", "Bruno")
    assert client.post(f"/groups/{group_id}/join").status_code == 200


def test_regenerate_code_invalidates_the_old_one(client, private_group, make_user, login):
    group_id = private_group["id"]
    old = private_group["joinCode"]
    login("ana")
    new = client.post(f"/groups/{group_id}/join-code")
    assert new.status_code == 200
    new_code = new.json()["joinCode"]
    assert new_code != old

    make_user("bruno", "Bruno")
    assert client.post(f"/groups/{group_id}/join", json={"code": old}).status_code == 403
    assert client.post(f"/groups/{group_id}/join", json={"code": new_code}).status_code == 200


def test_only_creator_regenerates_and_only_private(client, private_group, make_user):
    make_user("bruno", "Bruno")
    assert client.post(f"/groups/{private_group['id']}/join-code").status_code == 403

    make_user("ana", "Ana")
    open_group = client.post("/groups", json={"name": "Aberto"}).json()
    assert client.post(f"/groups/{open_group['id']}/join-code").status_code == 400


def test_code_is_not_stored_in_plain_text(client, private_group, db):
    from app.models import Group

    stored = db.get(Group, int(private_group["id"]))
    assert stored.join_code_hash
    assert private_group["joinCode"] not in stored.join_code_hash
