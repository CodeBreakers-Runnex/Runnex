import pytest

from app.gamification import calculate_run_coins, calculate_xp, get_level_from_xp


@pytest.mark.parametrize(
    ("distance", "seconds", "xp"),
    [
        (5.0, 1500, 500),  # pace exato de 5'00" - sem bonus
        (5.0, 1499, 600),  # abaixo de 5'00"/km - bonus de 20%
        (3.0, 1080, 300),
        (0.0, 0, 0),
    ],
)
def test_calculate_xp(distance, seconds, xp):
    assert calculate_xp(distance, seconds) == xp


@pytest.mark.parametrize(
    ("xp", "level"),
    [(0, "Iniciante"), (999, "Iniciante"), (1000, "Corredor"), (5000, "Avançado"), (15000, "Elite"), (50000, "Lenda")],
)
def test_level_thresholds(xp, level):
    assert get_level_from_xp(xp) == level


def test_run_coins_are_one_per_km():
    assert calculate_run_coins(3.0) == 3
    assert calculate_run_coins(0.4) == 0
