def straight_route(km: float) -> list[dict]:
    """Rota reta de `km` quilometros - POST /activities exige rota coerente
    com a distancia (app/activity_rules.py). 1 grau de latitude ~ 111.195 km."""
    return [{"lat": -23.55, "lng": -46.63}, {"lat": -23.55 + km / 111.195, "lng": -46.63}]


def run_payload(uid: str, km: float = 5.0, seconds: int = 1800, **overrides) -> dict:
    payload = {
        "userId": uid,
        "userName": uid,
        "userAvatar": None,
        "distance": km,
        "time": "00:00",
        "durationSeconds": seconds,
        "pace": "6'00\"",
        "type": "RUNNING",
        "route": straight_route(km),
    }
    payload.update(overrides)
    return payload
