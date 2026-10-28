import json

import pytest

from tests.helpers import run_payload


@pytest.fixture
def scenario(client, make_user, login):
    """Ana tem corrida, tênis, grupo, post, comentário, mensagem e curtidas
    no conteúdo do Bruno. Termina logada como Ana."""
    make_user("bruno", "Bruno")
    bruno_run = client.post("/activities", json=run_payload("bruno")).json()["id"]
    group = client.post("/groups", json={"name": "Pista", "city": "SP"}).json()["id"]
    bruno_post = client.post(f"/groups/{group}/posts", json={"text": "Post do Bruno"}).json()["id"]

    make_user("ana", "Ana", bio="Corro de manhã")
    client.post("/activities", json=run_payload("ana", km=7))
    client.post("/shoes", json={"name": "Tênis da Ana", "limitKm": 600})
    client.post(f"/groups/{group}/join")
    client.post(f"/activities/{bruno_run}/like", json={"isLiked": False})
    client.post(f"/groups/{group}/posts/{bruno_post}/like", json={"isLiked": False})
    client.post(f"/groups/{group}/posts/{bruno_post}/comments", json={"text": "Boa!"})
    client.post(f"/groups/{group}/messages", json={"text": "Oi"})
    return {"bruno_run": bruno_run, "bruno_post": bruno_post, "group": group}


def test_export_has_all_own_data_and_nothing_from_others(client, scenario):
    response = client.get("/users/me/export")
    assert response.status_code == 200
    data = response.json()
    tables = data["tables"]

    assert data["uid"] == "ana"
    assert tables["users"][0]["bio"] == "Corro de manhã"
    assert [run["distance"] for run in tables["activities"]] == [7]
    assert tables["activities"][0]["route"]
    assert [shoe["name"] for shoe in tables["shoes"]] == ["Tênis da Ana"]
    assert [member["group_id"] for member in tables["group_members"]] == [scenario["group"]]
    assert [comment["text"] for comment in tables["comments"]] == ["Boa!"]
    assert [message["text"] for message in tables["messages"]] == ["Oi"]
    assert data["likes"]["activities"] == [int(scenario["bruno_run"])]
    assert data["likes"]["posts"] == [int(scenario["bruno_post"])]

    dump = json.dumps(data)
    assert "Post do Bruno" not in dump
    assert all(row.get("user_id", "ana") == "ana" for rows in tables.values() for row in rows)


def test_export_is_only_for_the_logged_user(client, scenario, login):
    login("bruno")
    data = client.get("/users/me/export").json()
    assert data["uid"] == "bruno"
    assert [run["user_id"] for run in data["tables"]["activities"]] == ["bruno"]
    assert data["likes"]["activities"] == []


def test_export_for_user_without_profile_is_empty(client, login):
    login("novo")
    data = client.get("/users/me/export").json()
    assert data["tables"]["users"] == []
    assert data["tables"]["activities"] == []
