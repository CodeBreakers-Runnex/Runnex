"""Port 1:1 de src/lib/gamification.ts e KM_PER_RUNCOIN de src/lib/pet.ts.

Mantido em paridade manual com o TS até esses dois arquivos deixarem de
existir no frontend (o cálculo de XP/nível precisa dar o mesmo resultado
dos dois lados enquanto ambos coexistirem).
"""

KM_PER_RUNCOIN = 1

LEVELS = [
    {"name": "Iniciante", "min_xp": 0},
    {"name": "Corredor", "min_xp": 1000},
    {"name": "Avançado", "min_xp": 5000},
    {"name": "Elite", "min_xp": 15000},
    {"name": "Lenda", "min_xp": 50000},
]


def calculate_xp(distance: float, duration_seconds: float) -> int:
    xp = round(distance * 100)
    if distance > 0:
        pace_seconds_per_km = duration_seconds / distance
        if pace_seconds_per_km < 300:
            xp = round(xp * 1.2)
    return xp


def get_level_from_xp(total_xp: int) -> str:
    for level in reversed(LEVELS):
        if total_xp >= level["min_xp"]:
            return level["name"]
    return LEVELS[0]["name"]


def calculate_run_coins(distance_km: float) -> int:
    return max(0, round(distance_km * KM_PER_RUNCOIN))
