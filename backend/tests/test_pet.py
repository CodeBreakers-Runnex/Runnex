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


def test_concurrent_purchases_do_not_spend_same_coins(client, login):
    # Regressao P3-03: duas compras simultaneas liam o mesmo saldo e as duas
    # passavam. Simula a outra compra numa sessao separada que segura a linha
    # do usuario enquanto a segunda compra roda em outra thread.
    import threading

    from fastapi import HTTPException

    from app.auth import FirebaseUser
    from app.database import SessionLocal
    from app.models import User
    from app.routers.pet import purchase_pet_accessory
    from app.schemas_pet import PurchasePetAccessoryIn

    login("ana")
    client.post("/users/ana/pet/choose", json={"species": "lebre", "name": "Pe"})
    give_coins(client, "ana", 50)

    first = SessionLocal()
    user = first.get(User, "ana", with_for_update=True)
    user.pet_coins -= 40  # primeira compra (store-laco) ainda nao commitada

    result: dict = {}

    def second_purchase():
        session = SessionLocal()
        try:
            purchase_pet_accessory(
                "ana",
                PurchasePetAccessoryIn(accessoryId="store-cachecol"),
                db=session,
                current_user=FirebaseUser(uid="ana", email="ana@veloxy.test", email_verified=True),
            )
            result["status"] = 200
        except HTTPException as exc:
            result["status"] = exc.status_code
        finally:
            session.close()

    thread = threading.Thread(target=second_purchase)
    thread.start()
    thread.join(timeout=0.5)
    first.commit()
    first.close()
    thread.join(timeout=10)

    assert result["status"] == 400  # sobraram 10 RunCoins, cachecol custa 50
    assert client.get("/users/ana").json()["petCoins"] == 10


def test_unverified_email_cannot_change_pet(client, login):
    login("ana", email_verified=False)
    assert client.post("/users/ana/pet/choose", json={"species": "lebre", "name": "Pe"}).status_code == 403
    assert client.post("/users/ana/pet/purchase", json={"accessoryId": "store-laco"}).status_code == 403
    assert client.put("/users/ana/pet/equip", json={"slot": "cabeca", "accessoryId": None}).status_code == 403
