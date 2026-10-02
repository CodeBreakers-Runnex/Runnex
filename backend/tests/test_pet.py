from tests.helpers import run_payload


def give_coins(client, uid: str, km: float) -> None:
    # 1 RunCoin por km; 5 km em 30 min passa nas regras de plausibilidade
    while km > 0:
        step = min(km, 5.0)
        assert client.post("/activities", json=run_payload(uid, km=step, seconds=1800)).status_code == 200
        km -= step


def test_choose_pet_only_once(client, login):
    login("ana")
    response = client.post("/users/ana/pet/choose", json={"species": "guepardo", "name": " Flash "})
    assert response.status_code == 200
    assert response.json()["petName"] == "Flash"
    assert client.post("/users/ana/pet/choose", json={"species": "lebre", "name": "Outro"}).status_code == 409


def test_rejects_unknown_species(client, login):
    login("ana")
    assert client.post("/users/ana/pet/choose", json={"species": "dragao", "name": "X"}).status_code == 400


def test_purchase_uses_server_price(client, login):
    login("ana")
    client.post("/users/ana/pet/choose", json={"species": "lebre", "name": "Pe"})
    give_coins(client, "ana", 45)

    # Regressao: antes o backend debitava o "price" enviado pelo app
    response = client.post("/users/ana/pet/purchase", json={"accessoryId": "store-laco", "price": 0})
    assert response.status_code == 200, response.text
    assert response.json()["petCoins"] == 5  # 45 - 40 do catalogo
    assert "store-laco" in response.json()["petUnlockedAccessoryIds"]


def test_purchase_again_does_not_charge_twice(client, login):
    login("ana")
    client.post("/users/ana/pet/choose", json={"species": "lebre", "name": "Pe"})
    give_coins(client, "ana", 45)
    client.post("/users/ana/pet/purchase", json={"accessoryId": "store-laco"})
    assert client.post("/users/ana/pet/purchase", json={"accessoryId": "store-laco"}).json()["petCoins"] == 5


def test_purchase_rejections(client, login):
    login("ana")
    client.post("/users/ana/pet/choose", json={"species": "lebre", "name": "Pe"})
    give_coins(client, "ana", 5)

    insufficient = client.post("/users/ana/pet/purchase", json={"accessoryId": "store-cartola"})
    assert insufficient.status_code == 400 and "insuficientes" in insufficient.json()["detail"]
    for not_for_sale in ("acc-1ano", "item-inventado"):
        response = client.post("/users/ana/pet/purchase", json={"accessoryId": not_for_sale})
        assert response.status_code == 400 and "venda" in response.json()["detail"]


def test_equip_rules(client, login):
    login("ana")
    client.post("/users/ana/pet/choose", json={"species": "lebre", "name": "Pe"})

    ok = client.put("/users/ana/pet/equip", json={"slot": "cabeca", "accessoryId": "acc-5k"})
    assert ok.status_code == 200 and ok.json()["petEquippedCabeca"] == "acc-5k"
    unequip = client.put("/users/ana/pet/equip", json={"slot": "cabeca", "accessoryId": None})
    assert unequip.json()["petEquippedCabeca"] is None

    assert client.put("/users/ana/pet/equip", json={"slot": "fundo", "accessoryId": "acc-5k"}).status_code == 400
    assert client.put("/users/ana/pet/equip", json={"slot": "asa", "accessoryId": None}).status_code == 400
    assert client.put("/users/ana/pet/equip", json={"slot": "cabeca", "accessoryId": "store-cartola"}).status_code == 403


def test_cannot_touch_someone_elses_pet(client, login):
    login("bruno")
    assert client.post("/users/ana/pet/choose", json={"species": "lebre", "name": "X"}).status_code == 403
    assert client.post("/users/ana/pet/purchase", json={"accessoryId": "store-laco"}).status_code == 403
