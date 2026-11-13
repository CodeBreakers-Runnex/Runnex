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


def test_websocket_pushes_posts_likes_and_comments(client, group, monkeypatch):
    fake_token(monkeypatch, "bruno")
    with client.websocket_connect(f"/groups/{group}/ws?token=x") as ws:
        post = client.post(f"/groups/{group}/posts", json={"text": "Bora correr"}).json()
        assert ws.receive_json() == {"type": "post_created"}

        client.post(f"/groups/{group}/posts/{post['id']}/like", json={"isLiked": False})
        assert ws.receive_json() == {"type": "post_like", "postId": str(post["id"])}

        client.post(f"/groups/{group}/posts/{post['id']}/comments", json={"text": "Partiu"})
        assert ws.receive_json() == {"type": "comment_created", "postId": str(post["id"])}


def test_group_write_routes_do_not_block_the_event_loop():
    # Rotas async def que usam o banco sincrono travam o loop de eventos:
    # enquanto o banco responde, nenhum outro usuario e atendido (chat,
    # feed, WebSocket). Como def comum, o FastAPI as roda numa thread.
    import inspect

    from app.routers import groups as groups_router

    for handler in (
        groups_router.create_group_post,
        groups_router.toggle_group_post_like,
        groups_router.add_group_post_comment,
        groups_router.send_group_message,
    ):
        assert not inspect.iscoroutinefunction(handler), handler.__name__


def test_cannot_list_comments_of_another_groups_post(client, group, make_user, login):
    # Regressao P2-02: a rota checava membro do grupo da URL, mas buscava
    # comentarios so pelo post_id - membro do grupo A lia posts do grupo B.
    post = client.post(f"/groups/{group}/posts", json={"text": "So para o grupo"}).json()
    client.post(f"/groups/{group}/posts/{post['id']}/comments", json={"text": "Segredo"})

    make_user("carla", "Carla")
    other_group = client.post("/groups", json={"name": "Outro", "city": "RJ"}).json()["id"]
    response = client.get(f"/groups/{other_group}/posts/{post['id']}/comments")
    assert response.status_code == 404

    login("ana")
    assert [c["text"] for c in client.get(f"/groups/{group}/posts/{post['id']}/comments").json()] == ["Segredo"]


def test_joined_groups_only_for_self(client, group, login):
    # P3-01: listar grupos de outro uid expunha onde perfis privados estao.
    assert client.get("/groups/joined/ana").json() == [str(group)]
    assert client.get("/groups/joined/bruno").status_code == 403


def test_unverified_email_cannot_write_in_groups(client, group, login):
    # P3-02: conta nao verificada podia postar/conversar chamando a API direto.
    login("ana", email_verified=False)
    assert client.post("/groups", json={"name": "Spam", "city": "SP"}).status_code == 403
    assert client.post(f"/groups/{group}/posts", json={"text": "spam"}).status_code == 403
    assert client.post(f"/groups/{group}/messages", json={"text": "spam"}).status_code == 403

    login("ana")
    post_id = client.post(f"/groups/{group}/posts", json={"text": "ok"}).json()["id"]
    login("ana", email_verified=False)
    assert client.post(f"/groups/{group}/posts/{post_id}/comments", json={"text": "spam"}).status_code == 403
    # Leitura continua liberada
    assert client.get(f"/groups/{group}/posts").status_code == 200


# Imagem minima valida: JPEG comeca com FF D8 FF (app/validators.py confere).
TINY_JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ=="


def test_post_with_only_an_image(client, group):
    # A tela permite publicar so com foto ("Escreva algo ou adicione uma
    # imagem"), mas o backend exigia texto: a publicacao sempre falhava.
    response = client.post(f"/groups/{group}/posts", json={"text": "", "imageURL": TINY_JPEG})
    assert response.status_code == 200, response.text
    assert response.json()["text"] == "" and response.json()["imageURL"] == TINY_JPEG


def test_post_needs_text_or_image(client, group):
    assert client.post(f"/groups/{group}/posts", json={"text": ""}).status_code == 422
    # So espacos virava uma publicacao vazia (o texto e gravado sem espacos).
    assert client.post(f"/groups/{group}/posts", json={"text": "   "}).status_code == 422
    assert client.get(f"/groups/{group}/posts").json() == []


def test_unverified_email_cannot_join_or_leave(client, group, make_user, login):
    make_user("carla")
    login("carla", email_verified=False)
    assert client.post(f"/groups/{group}/join").status_code == 403
    login("bruno", email_verified=False)
    assert client.post(f"/groups/{group}/leave").status_code == 403
    login("ana")
    assert client.get(f"/groups/{group}").json()["membersCount"] == 2
