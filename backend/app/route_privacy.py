"""Privacidade da rota: quem ve a corrida de outra pessoa nao recebe os
primeiros nem os ultimos 200 m, onde costumam estar a casa ou o trabalho.
O dono continua recebendo a rota inteira.
"""

import math

HIDDEN_EDGE_KM = 0.2
_EARTH_RADIUS_KM = 6371.0


def _distance_km(a: dict, b: dict) -> float:
    lat1, lat2 = math.radians(a["lat"]), math.radians(b["lat"])
    d_lat = lat2 - lat1
    d_lng = math.radians(b["lng"] - a["lng"])
    h = math.sin(d_lat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(d_lng / 2) ** 2
    return 2 * _EARTH_RADIUS_KM * math.asin(math.sqrt(h))


def trim_route_edges(route: list[dict] | None, edge_km: float = HIDDEN_EDGE_KM) -> list[dict] | None:
    """Tira da rota os pontos a menos de `edge_km` do inicio ou do fim
    (medido pelo caminho percorrido). Rota curta demais some inteira."""
    if not route:
        return route
    traveled = [0.0]
    for previous, current in zip(route, route[1:]):
        traveled.append(traveled[-1] + _distance_km(previous, current))
    total = traveled[-1]
    kept = [point for point, at in zip(route, traveled) if at >= edge_km and total - at >= edge_km]
    return kept if len(kept) >= 2 else []
