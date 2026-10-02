import pytest

from tests.helpers import run_payload


@pytest.fixture
def scenario(client, make_user, login):
    """Ana cria um grupo compartilhado com Bruno e um so dela, e interage
    com o conteudo do Bruno. Termina logado como Ana."""
    make_user("bruno", "Bruno")
    make_user("ana", "Ana")
    shared = client.post("/groups", json={"name": "Compartilhado", "city": "SP"}).json()["id"]
    solo = client.post("/groups", json={"name": "So da Ana", "city": "SP"}).json()["id"]
    client.post("/activities", json=run_payload("ana"))

    login("bruno")
    client.post(f"/groups/{shared}/join")
    bruno_run = client.post("/activities", json=run_payload("bruno")).json()["id"]
    bruno_post = client.post(f"/groups/{shared}/posts", json={"text": "Post do Bruno"}).json()["id"]

    login("ana")
    client.post(f"/activities/{bruno_run}/like", json={"isLiked": False})
    client.post(f"/groups/{shared}/posts/{bruno_post}/like", json={"isLiked": False})
    client.post(f"/groups/{shared}/posts/{bruno_post}/comments", json={"text": "Boa!"})
    client.post(f"/groups/{shared}/messages", json={"text": "Oi"})
    return {"shared": shared, "solo": solo, "bruno_post": bruno_post}


def test_cannot_delete_someone_else(client, scenario, login):
    login("bruno")
    assert client.delete("/users/ana").status_code == 403


def test_delete_account_removes_own_data(client, scenario, login):
    assert client.delete("/users/ana").status_code == 204

    login("bruno")
    assert client.get("/users/ana").status_code == 404
    assert client.get("/activities/user/ana").json() == []
    assert client.get(f"/groups/{scenario['solo']}").status_code == 404


def test_shared_group_goes_to_oldest_member(client, scenario, login):
    client.delete("/users/ana")
    login("bruno")

    group = client.get(f"/groups/{scenario['shared']}").json()
    assert group["createdBy"] == "bruno" and group["memberIds"] == ["bruno"]
    assert client.get(f"/groups/{scenario['shared']}/messages").json() == []

    posts = client.get(f"/groups/{scenario['shared']}/posts").json()
    assert [p["id"] for p in posts] == [scenario["bruno_post"]]
    assert posts[0]["likes"] == [] and posts[0]["commentsCount"] == 0


def test_likes_are_removed_from_other_runs(client, scenario, login):
    client.delete("/users/ana")
    login("bruno")
    assert client.get("/activities/user/bruno").json()[0]["likes"] == []
