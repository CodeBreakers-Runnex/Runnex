def test_request_without_token_is_rejected(client):
    assert client.get("/users/ana").status_code == 403


def test_invalid_token_is_rejected(client):
    response = client.get("/users/ana", headers={"Authorization": "Bearer nao-e-um-jwt"})
    assert response.status_code == 401


def test_unverified_email_cannot_save_runs(client, login):
    from tests.helpers import run_payload

    login("ana", email_verified=False)
    response = client.post("/activities", json=run_payload("ana"))
    assert response.status_code == 403
    assert "Confirme seu email" in response.json()["detail"]


def test_static_routes_are_not_captured_by_user_id(client, make_user):
    make_user("ana")
    assert client.get("/users/by-ids?ids=ana").json()[0]["uid"] == "ana"
    assert client.get("/users/ranking/global").status_code == 200
    assert client.get("/activities/by-users?user_ids=ana").status_code == 200


def _preflight(client, origin: str):
    return client.options(
        "/users/ana",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        },
    )


def test_cors_allows_web_and_native_apps(client):
    # Regressao: o app Android (Capacitor, origem https://localhost) recebia 400
    # no preflight e nao conseguia chamar nenhuma rota autenticada.
    for origin in ("https://veloxy-run.web.app", "https://localhost", "capacitor://localhost"):
        response = _preflight(client, origin)
        assert response.status_code == 200, origin
        assert response.headers["access-control-allow-origin"] == origin


def test_cors_rejects_unknown_origins(client):
    assert _preflight(client, "https://site-malicioso.example").status_code == 400
