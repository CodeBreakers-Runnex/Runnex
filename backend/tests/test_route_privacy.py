from app.route_privacy import trim_route_edges

KM_PER_DEGREE = 111.195


def straight(km: float, points: int) -> list[dict]:
    """Rota reta para o norte com `points` pontos igualmente espaçados."""
    return [{"lat": -23.55 + km * i / (points - 1) / KM_PER_DEGREE, "lng": -46.63} for i in range(points)]


def test_hides_first_and_last_200_m():
    route = straight(1.0, 13)  # um ponto a cada ~83 m, nenhum exatamente em 200 m
    trimmed = trim_route_edges(route)
    assert trimmed == route[3:10]  # sobra de ~250 m a ~750 m


def test_short_route_disappears():
    assert trim_route_edges(straight(0.35, 8)) == []


def test_empty_route_stays_empty():
    assert trim_route_edges(None) is None
    assert trim_route_edges([]) == []


def test_round_trip_hides_both_ends_at_home():
    # Vai 1 km e volta: início e fim estão na mesma casa, os dois somem.
    out = straight(1.0, 13)
    route = out + list(reversed(out))[1:]
    trimmed = trim_route_edges(route)
    assert trimmed[0] == route[3] and trimmed[-1] == route[-4]
    assert route[0] not in trimmed


def _run(client, uid: str, km: float = 1.0, points: int = 13):
    from tests.helpers import run_payload

    response = client.post("/activities", json=run_payload(uid, km=km, seconds=600, route=straight(km, points)))
    assert response.status_code == 200, response.text


def test_owner_sees_full_route_others_see_trimmed(client, make_user, login):
    make_user("bruno")
    make_user("ana")
    _run(client, "ana")

    own = client.get("/activities/user/ana").json()[0]["route"]
    assert len(own) == 13

    login("bruno")
    for path in ("/activities/user/ana", "/activities/feed", "/activities/by-users?user_ids=ana"):
        seen = client.get(path).json()[0]["route"]
        assert len(seen) == 7, path
        assert seen[0] != own[0] and seen[-1] != own[-1]

    # O corte é só na resposta: a rota guardada continua inteira.
    login("ana")
    assert len(client.get("/activities/feed").json()[0]["route"]) == 13
