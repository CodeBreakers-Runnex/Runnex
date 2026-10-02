import pytest
from starlette.websockets import WebSocketDisconnect

from app.auth import FirebaseUser
from tests.helpers import run_payload


@pytest.fixture
def group(client, make_user, login):
    """Ana cria o grupo e Bruno entra; termina logado como Ana."""
    make_user("bruno", "Bruno")
    make_user("ana", "Ana")
    created = client.post("/groups", json={"name": "Corrida de Sabado", "city": "SP", "tag": "Iniciante"}).json()
    login("bruno")
    assert client.post(f"/groups/{created['id']}/join").status_code == 200
    login("ana")
    return created["id"]


def test_create_group(client, make_user):
    make_user("ana", "Ana")
    group = client.post("/groups", json={"name": "Treino", "city": "SP"}).json()
    assert group["createdBy"] == "ana"
    assert group["creatorName"] == "Ana"
    assert group["memberIds"] == ["ana"] and group["membersCount"] == 1


def test_join_and_leave(client, group, login):
    assert client.get(f"/groups/{group}").json()["membersCount"] == 2
    login("bruno")
    left = client.post(f"/groups/{group}/leave").json()
    assert left["memberIds"] == ["ana"]
    assert client.get("/groups/joined/bruno").json() == []


def test_post_like_and_comment(client, group, login):
    login("bruno")
    post = client.post(f"/groups/{group}/posts", json={"text": "Bora treinar!", "authorName": "Falso"}).json()
    assert post["authorName"] == "Bruno"  # nome vem do banco, nunca do cliente

    login("ana")
    assert client.post(f"/groups/{group}/posts/{post['id']}/like", json={"isLiked": False}).json()["likes"] == ["ana"]
    comment = client.post(f"/groups/{group}/posts/{post['id']}/comments", json={"text": "Partiu!"}).json()
    assert comment["authorName"] == "Ana"
    assert client.get(f"/groups/{group}/posts").json()[0]["commentsCount"] == 1


def test_chat_messages(client, group):
    message = client.post(f"/groups/{group}/messages", json={"text": "Chegando em 10min"}).json()
    assert message["senderName"] == "Ana"
    assert [m["text"] for m in client.get(f"/groups/{group}/messages").json()] == ["Chegando em 10min"]


def test_non_members_cannot_read_or_write(client, group, make_user):
    make_user("intruso")
    assert client.get(f"/groups/{group}/posts").status_code == 403
    assert client.get(f"/groups/{group}/messages").status_code == 403
    assert client.post(f"/groups/{group}/posts", json={"text": "spam"}).status_code == 403
    assert client.post(f"/groups/{group}/messages", json={"text": "spam"}).status_code == 403


def test_only_creator_changes_photo(client, group, login):
    login("bruno")
    assert client.put(f"/groups/{group}/photo", json={"photoURL": "https://x/foto.png"}).status_code == 403
    login("ana")
    response = client.put(f"/groups/{group}/photo", json={"photoURL": "https://x/foto.png"})
    assert response.json()["photoURL"] == "https://x/foto.png"


def test_member_run_adds_weekly_km(client, group):
    assert client.post("/activities", json=run_payload("ana", km=7.5, seconds=2400)).status_code == 200
    detail = client.get(f"/groups/{group}").json()
    assert detail["weeklyKm"] == 7.5
    assert detail["weeklyKmWeek"] is not None


def fake_token(monkeypatch, uid: str | None):
    from fastapi import HTTPException

    from app.routers import groups as groups_router

    def decode(token: str) -> FirebaseUser:
        if uid is None:
            raise HTTPException(status_code=401)
        return FirebaseUser(uid=uid, email=None, email_verified=True)

    monkeypatch.setattr(groups_router, "decode_firebase_token", decode)


def test_websocket_rejects_invalid_token_and_non_members(client, group, monkeypatch):
    fake_token(monkeypatch, None)
    with pytest.raises(WebSocketDisconnect) as exc, client.websocket_connect(f"/groups/{group}/ws?token=x") as ws:
        ws.receive_text()
    assert exc.value.code == 4401

    fake_token(monkeypatch, "intruso")
    with pytest.raises(WebSocketDisconnect) as exc, client.websocket_connect(f"/groups/{group}/ws?token=x") as ws:
        ws.receive_text()
    assert exc.value.code == 4403


def test_websocket_pushes_new_messages_to_members(client, group, monkeypatch):
    fake_token(monkeypatch, "bruno")
    with client.websocket_connect(f"/groups/{group}/ws?token=x") as ws:
        client.post(f"/groups/{group}/messages", json={"text": "Oi"})
        assert ws.receive_json() == {"type": "message_created"}
