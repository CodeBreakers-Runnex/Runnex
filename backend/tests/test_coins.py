import pytest

from app.config import settings
from app.services.coin_purchases import credit_purchase, refund_purchase


@pytest.fixture
def mock_on(monkeypatch):
    monkeypatch.setattr(settings, "coin_mock_purchases", True)


def setup_user(client, login, uid="ana"):
    login(uid)
    assert client.post(f"/users/{uid}/pet/choose", json={"species": "lebre", "name": "Pe"}).status_code == 200


def test_packs_list_comes_from_server_catalog(client):
    body = client.get("/coins/packs").json()
    assert {p["id"]: p["coins"] for p in body["packs"]}["rx_coins_1000"] == 1100
    assert body["mockPurchases"] is False


def test_mock_purchase_is_off_by_default(client, login):
    setup_user(client, login)
    assert client.post("/users/ana/coins/mock-purchase", json={"packId": "rx_coins_300"}).status_code == 403


def test_mock_purchase_credits_pack(client, login, mock_on):
    setup_user(client, login)
    response = client.post("/users/ana/coins/mock-purchase", json={"packId": "rx_coins_300"})
    assert response.status_code == 200
    assert response.json() == {"petCoins": 300, "credited": 300}
    history = client.get("/users/ana/coins/purchases").json()
    assert [h["packId"] for h in history] == ["rx_coins_300"]


def test_rejects_unknown_pack_and_other_user(client, login, mock_on):
    setup_user(client, login)
    assert client.post("/users/ana/coins/mock-purchase", json={"packId": "rx_coins_999999"}).status_code == 400
    assert client.post("/users/bia/coins/mock-purchase", json={"packId": "rx_coins_300"}).status_code == 403
    assert client.get("/users/bia/coins/purchases").status_code == 403


def test_same_transaction_never_credits_twice(client, login, db):
    setup_user(client, login)
    credit_purchase(db, "ana", "rx_coins_300", "google_play", "GPA.1")
    credit_purchase(db, "ana", "rx_coins_300", "google_play", "GPA.1")  # reenvio do aviso
    db.expire_all()
    assert client.get("/users/ana").json()["petCoins"] == 300


def test_refund_removes_coins_even_below_zero(client, login, db, mock_on):
    setup_user(client, login)
    credit_purchase(db, "ana", "rx_coins_300", "google_play", "GPA.2")
    # gasta antes do reembolso
    assert client.post("/users/ana/pet/purchase", json={"accessoryId": "store-cartola"}).status_code == 200
    refund_purchase(db, "google_play", "GPA.2")
    refund_purchase(db, "google_play", "GPA.2")  # estorno repetido nao desconta de novo
    db.expire_all()
    assert client.get("/users/ana").json()["petCoins"] == 300 - 80 - 300
    # com saldo negativo nao compra nada
    assert client.post("/users/ana/pet/purchase", json={"accessoryId": "store-laco"}).status_code == 400
