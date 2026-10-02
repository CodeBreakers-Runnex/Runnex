import pytest

from app.activity_rules import check_run_is_plausible, route_length_km
from app.schemas import RoutePoint
from tests.helpers import straight_route


def route(km: float) -> list[RoutePoint]:
    return [RoutePoint(**point) for point in straight_route(km)]


def test_route_length_matches_haversine():
    assert route_length_km(route(5)) == pytest.approx(5, abs=0.001)


def test_accepts_realistic_run():
    check_run_is_plausible(5.0, 1500, route(5))


def test_accepts_exactly_30_kmh():
    check_run_is_plausible(5.0, 600, route(5))


@pytest.mark.parametrize(
    ("distance", "seconds"),
    [(5.2, 600), (500, 60)],
)
def test_rejects_speed_above_30_kmh(distance, seconds):
    with pytest.raises(ValueError, match="Velocidade media"):
        check_run_is_plausible(distance, seconds, route(distance))


@pytest.mark.parametrize("points", [None, [], straight_route(5)[:1]])
def test_rejects_run_without_route(points):
    parsed = [RoutePoint(**p) for p in points] if points else points
    with pytest.raises(ValueError, match="sem rota GPS"):
        check_run_is_plausible(5.0, 1500, parsed)


def test_rejects_distance_longer_than_route():
    with pytest.raises(ValueError, match="nao corresponde a rota"):
        check_run_is_plausible(5.0, 1500, route(1))


def test_tolerance_covers_route_decimation():
    # 30% + 200 m de folga: 2.77 km de rota aceitam ate ~3.8 km declarados
    check_run_is_plausible(3.8, 1500, route(2.77))
    with pytest.raises(ValueError):
        check_run_is_plausible(3.9, 1500, route(2.77))
