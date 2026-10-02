"""O backend repete constantes do frontend (catalogo do pet, niveis de XP).
Estes testes leem os arquivos .ts e falham se os dois lados divergirem -
antes a paridade era so um comentario pedindo para lembrar."""

import re
from pathlib import Path

from app.gamification import LEVELS
from app.pet_catalog import ACHIEVEMENT_ACCESSORIES, PET_SPECIES, STORE_ACCESSORIES

SRC = Path(__file__).resolve().parents[2] / "src"


def test_pet_species_match_frontend():
    source = (SRC / "lib" / "pet.ts").read_text(encoding="utf-8")
    block = source[source.index("PET_SPECIES:"):source.index("];", source.index("PET_SPECIES:"))]
    assert set(re.findall(r'id: "([^"]+)"', block)) == PET_SPECIES


def test_pet_accessories_match_frontend():
    source = (SRC / "lib" / "pet.ts").read_text(encoding="utf-8")
    items = re.findall(r'\{ id: "([^"]+)",[^}]*slot: "([^"]+)",[^}]*source: "(achievement|store)"(?:[^}]*price: (\d+))?', source)
    achievement = {item_id: slot for item_id, slot, kind, _ in items if kind == "achievement"}
    store = {item_id: (slot, int(price)) for item_id, slot, kind, price in items if kind == "store"}

    assert achievement == ACHIEVEMENT_ACCESSORIES
    assert store == STORE_ACCESSORIES


def test_levels_match_frontend():
    source = (SRC / "lib" / "gamification.ts").read_text(encoding="utf-8")
    levels = [(name, int(xp)) for name, xp in re.findall(r'name: "([^"]+)",\s*minXP: (\d+)', source)]
    assert levels == [(level["name"], level["min_xp"]) for level in LEVELS]
