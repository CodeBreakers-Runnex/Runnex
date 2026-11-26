"""Nome e foto que aparecem na corrida (feed, grupo) vem do perfil no
servidor, nao do que o app manda. Antes um POST /activities feito a mao
publicava uma corrida no feed com o nome e a foto de outra pessoa - a mesma
falha que ja tinha sido corrigida nos posts de grupo."""

from tests.helpers import run_payload

GOOGLE_PHOTO = "https://lh3.googleusercontent.com/a/ana"
CUSTOM_PHOTO = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ=="


def _feed_item(client):
    return client.get("/activities/feed").json()[0]


def test_name_comes_from_profile_not_from_request(client, make_user):
    make_user("ana", "Ana Souza")
    response = client.post("/activities", json=run_payload("ana", userName="Pele", userAvatar="https://exemplo.com/outra.jpg"))
    assert response.status_code == 200, response.text
    item = _feed_item(client)
    assert item["userName"] == "Ana Souza"


def test_profile_http_photo_wins_over_request(client, make_user):
    make_user("ana", "Ana", photoURL=GOOGLE_PHOTO)
    client.post("/activities", json=run_payload("ana", userAvatar="https://exemplo.com/outra.jpg"))
    assert _feed_item(client)["userAvatar"] == GOOGLE_PHOTO


def test_base64_profile_photo_is_not_copied_into_every_run(client, make_user):
    # Foto escolhida no app fica em base64 no perfil (ate 300 kB). Copiar para
    # cada corrida pesaria o feed; mantem a foto que o app mandou, como antes.
    make_user("ana", "Ana", photoURL=CUSTOM_PHOTO)
    client.post("/activities", json=run_payload("ana", userAvatar=GOOGLE_PHOTO))
    assert _feed_item(client)["userAvatar"] == GOOGLE_PHOTO


def test_first_run_of_google_account_uses_request_name(client, login):
    # Sem perfil ainda: o perfil nasce desta corrida, com o nome enviado.
    login("google")
    client.post("/activities", json=run_payload("google", userName="Bia"))
    assert _feed_item(client)["userName"] == "Bia"


def test_placeholder_profile_name_uses_request_name(client, login):
    # Perfil criado por pet/tenis/treinador antes do nome ser salvo fica como
    # "Corredor"; nesse caso vale o nome da conta enviado pelo app.
    login("bia")
    client.post("/users/bia/pet/choose", json={"species": "lebre", "name": "Pipoca"})
    client.post("/activities", json=run_payload("bia", userName="Bia Lima"))
    assert _feed_item(client)["userName"] == "Bia Lima"
