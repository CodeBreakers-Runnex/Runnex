"""Plano VIP sem pagamento: so existe o modo de teste do servidor."""

import pytest

from app.config import settings


@pytest.fixture
def vip_on(monkeypatch):
    monkeypatch.setattr(settings, "vip_mock_activation", True)


def test_info_reports_flag(client, login):
    login("ana")
    assert client.get("/vip").json() == {"mockActivation": False}


def test_new_users_are_not_vip(client, make_user):
    profile = make_user("ana", "Ana")
    assert profile["isVip"] is False


def test_activation_is_off_by_default(client, make_user):
    make_user("ana", "Ana")
    assert client.post("/users/ana/vip/mock-activate").status_code == 403
    assert client.get("/users/ana").json()["isVip"] is False


def test_activate_and_deactivate(client, make_user, vip_on):
    make_user("ana", "Ana")
    assert client.get("/vip").json() == {"mockActivation": True}
    on = client.post("/users/ana/vip/mock-activate")
    assert on.status_code == 200 and on.json() == {"isVip": True}
    assert client.get("/users/ana").json()["isVip"] is True
    off = client.post("/users/ana/vip/mock-deactivate")
    assert off.json() == {"isVip": False}
    assert client.get("/users/ana").json()["isVip"] is False


def test_activation_is_idempotent(client, make_user, vip_on):
    make_user("ana", "Ana")
    assert client.post("/users/ana/vip/mock-activate").json() == {"isVip": True}
    assert client.post("/users/ana/vip/mock-activate").json() == {"isVip": True}


def test_only_own_account(client, make_user, login, vip_on):
    make_user("bruno", "Bruno")
    make_user("ana", "Ana")
    assert client.post("/users/bruno/vip/mock-activate").status_code == 403
    login("bruno")
    assert client.get("/users/bruno").json()["isVip"] is False


def test_requires_verified_email(client, make_user, login, vip_on):
    make_user("ana", "Ana")
    login("ana", email_verified=False)
    assert client.post("/users/ana/vip/mock-activate").status_code == 403


def test_other_users_see_the_vip_flag(client, make_user, login, vip_on):
    make_user("ana", "Ana")
    client.post("/users/ana/vip/mock-activate")
    make_user("bruno", "Bruno")
    assert client.get("/users/ana").json()["isVip"] is True


def test_profile_update_cannot_grant_vip(client, make_user):
    make_user("ana", "Ana")
    response = client.put("/users/ana", json={"displayName": "Ana", "isVip": True})
    assert response.status_code == 200
    assert response.json()["isVip"] is False


def test_private_group_requires_vip(client, make_user, vip_on):
    make_user("ana", "Ana")
    refused = client.post("/groups", json={"name": "Secreto", "private": True})
    assert refused.status_code == 403
    assert "VIP" in refused.json()["detail"]

    client.post("/users/ana/vip/mock-activate")
    assert client.post("/groups", json={"name": "Secreto", "private": True}).status_code == 200


def test_public_group_does_not_need_vip(client, make_user):
    make_user("ana", "Ana")
    assert client.post("/groups", json={"name": "Aberto"}).status_code == 200


def test_losing_vip_keeps_existing_private_group(client, make_user, vip_on):
    """Desativar o VIP nao desfaz o que ja foi criado."""
    make_user("ana", "Ana")
    client.post("/users/ana/vip/mock-activate")
    group = client.post("/groups", json={"name": "Secreto", "private": True}).json()
    client.post("/users/ana/vip/mock-deactivate")
    assert client.get(f"/groups/{group['id']}").json()["isPrivate"] is True
