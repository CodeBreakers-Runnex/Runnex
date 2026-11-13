"""Limites de entrada que faltavam: texto que aparece no feed, ranking e
grupos de todo mundo, e coordenadas da rota. O app nunca envia nada perto
desses limites; eles barram um POST feito a mao."""

import pytest

from tests.helpers import run_payload


def test_display_name_is_trimmed(client, make_user):
    make_user("ana", "Ana")
    response = client.put("/users/ana", json={"displayName": "  Ana Souza  "})
    assert response.status_code == 200
    assert response.json()["displayName"] == "Ana Souza"


@pytest.mark.parametrize("name", ["", "   ", "x" * 81])
def test_display_name_must_be_1_to_80_chars(client, make_user, name):
    make_user("ana", "Ana")
    assert client.put("/users/ana", json={"displayName": name}).status_code == 422
    assert client.get("/users/ana").json()["displayName"] == "Ana"


def test_display_name_can_be_omitted_or_null(client, make_user):
    # auth.ts e TermsGate mandam displayName: null quando o Google nao tem nome.
    make_user("ana", "Ana")
    assert client.put("/users/ana", json={"displayName": None, "bio": "corro"}).status_code == 200
    assert client.get("/users/ana").json()["displayName"] == "Ana"


def test_terms_version_has_a_limit(client, make_user):
    make_user("ana", "Ana")
    assert client.put("/users/ana", json={"termsVersion": "v" * 41}).status_code == 422


@pytest.mark.parametrize("field, value", [
    ("time", "1" * 33),
    ("pace", "5" * 33),
    ("type", "RUNNING" * 10),
    ("calories", 50_001),
])
def test_run_text_fields_and_calories_have_limits(client, login, field, value):
    login("ana")
    assert client.post("/activities", json=run_payload("ana", **{field: value})).status_code == 422


@pytest.mark.parametrize("point", [{"lat": 91, "lng": 0}, {"lat": 0, "lng": 181}, {"lat": -91, "lng": 0}])
def test_route_points_must_be_on_the_globe(client, login, point):
    login("ana")
    route = [{"lat": -23.55, "lng": -46.63}, point]
    assert client.post("/activities", json=run_payload("ana", route=route)).status_code == 422


def test_real_app_payload_still_saves(client, login):
    # Formatos que o app envia (RunTracking.tsx): "mm:ss" (passa de 99 min),
    # pace m'ss" e type RUNNING; e uma corrida importada tem "12m 5s".
    login("ana")
    payload = run_payload("ana", km=5.0, seconds=1800, time="125:30", pace="25'06\"", type="RUNNING", calories=300)
    assert client.post("/activities", json=payload).status_code == 200
