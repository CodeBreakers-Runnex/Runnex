"""Regras de plausibilidade de uma corrida enviada pelo app.

O app ja descarta trechos de GPS acima de 30 km/h (anti-cheat em
RunTracking.tsx), mas isso roda no cliente - um POST /activities feito na
mao podia declarar 500 km em 1 minuto e ganhar 50.000 XP. Estas regras
repetem os limites no servidor. Nao tornam fraude impossivel (um cliente
adulterado ainda pode fabricar uma rota coerente), mas limitam o ganho
de XP ao que uma corrida real conseguiria.
"""

import math
from typing import Protocol

MAX_SPEED_KMH = 30.0
MAX_DURATION_PER_DAY_SECONDS = 24 * 3600

# A distancia do app e a soma dos segmentos da rota, entao os dois deveriam
# bater. A folga cobre a decimacao de rotas longas (MAX_ROUTE_POINTS no
# frontend), que corta cantos e encurta um pouco o tracado salvo.
ROUTE_TOLERANCE_FACTOR = 1.3
ROUTE_TOLERANCE_KM = 0.2

_EARTH_RADIUS_KM = 6371.0


class _Point(Protocol):
    lat: float
    lng: float


def _haversine_km(a: _Point, b: _Point) -> float:
    lat1, lat2 = math.radians(a.lat), math.radians(b.lat)
    d_lat = lat2 - lat1
    d_lng = math.radians(b.lng - a.lng)
    h = math.sin(d_lat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(d_lng / 2) ** 2
    return 2 * _EARTH_RADIUS_KM * math.asin(math.sqrt(h))


def route_length_km(route: list[_Point]) -> float:
    return sum(_haversine_km(a, b) for a, b in zip(route, route[1:]))


def check_run_is_plausible(distance_km: float, duration_seconds: int, route: list[_Point] | None) -> None:
    """Levanta ValueError com a mensagem para o usuario se a corrida nao
    for plausivel."""
    speed_kmh = distance_km / (duration_seconds / 3600)
    if speed_kmh > MAX_SPEED_KMH:
        raise ValueError(
            f"Velocidade media de {speed_kmh:.0f} km/h esta acima do limite de "
            f"{MAX_SPEED_KMH:.0f} km/h para corrida."
        )

    if not route or len(route) < 2:
        raise ValueError("Corrida sem rota GPS nao pode ser salva.")

    max_distance = route_length_km(route) * ROUTE_TOLERANCE_FACTOR + ROUTE_TOLERANCE_KM
    if distance_km > max_distance:
        raise ValueError("A distancia informada nao corresponde a rota GPS registrada.")
