def test_put_creates_profile_and_updates_fields(client, make_user):
    profile = make_user("ana", "Ana", bio="Corro de manha", weeklyGoalKm=20)
    assert profile["displayName"] == "Ana"
    assert profile["bio"] == "Corro de manha"
    assert profile["weeklyGoalKm"] == 20
    assert profile["totalXP"] == 0 and profile["level"] == "Iniciante"


def test_cannot_edit_someone_else(client, make_user, login):
    make_user("ana")
    login("bruno")
    response = client.put("/users/ana", json={"displayName": "Hackeado"})
    assert response.status_code == 403


def test_profile_ignores_xp_sent_by_client(client, make_user):
    make_user("ana")
    response = client.put("/users/ana", json={"totalXP": 99999, "level": "Lenda"})
    assert response.json()["totalXP"] == 0


def test_private_profile_is_hidden_from_others(client, make_user, login):
    make_user("ana", privateProfile=True)
    make_user("bruno")

    assert client.get("/users/ana").status_code == 403
    assert client.get("/activities/user/ana").status_code == 403
    assert [u["uid"] for u in client.get("/users/ranking/global").json()] == ["bruno"]

    login("ana")
    assert client.get("/users/ana").status_code == 200


def test_rejects_invalid_photo(client, make_user):
    make_user("ana")
    response = client.put("/users/ana", json={"photoURL": "javascript:alert(1)"})
    assert response.status_code == 422


def test_terms_acceptance_is_recorded_and_returned(client, make_user):
    profile = make_user("ana")
    assert profile["termsVersion"] is None  # ex.: conta Google que nunca aceitou

    updated = client.put("/users/ana", json={"termsVersion": "2026-10-01"}).json()
    assert updated["termsVersion"] == "2026-10-01"
    assert client.get("/users/ana").json()["termsVersion"] == "2026-10-01"
