"""Catalogo do pet no servidor - espelha PET_SPECIES e PET_ACCESSORIES de
src/lib/pet.ts (tests/test_parity.py falha se os dois divergirem).

Bug real encontrado ao escrever os testes: POST /pet/purchase debitava o
preco enviado pelo cliente (price >= 0), entao {"price": 0} comprava
qualquer item de graca - inclusive acessorios de conquista e ids
inventados. O preco agora vem daqui.
"""

PET_SPECIES = frozenset({"guepardo", "lebre", "cavalo", "falcao", "galgo"})

# id -> slot. Desbloqueados por conquista, calculada no app a partir das
# corridas (lib/achievements.ts) - o servidor ainda nao recalcula conquistas,
# entao so valida que o id existe e combina com o slot.
ACHIEVEMENT_ACCESSORIES = {
    "acc-primeira-corrida": "pescoco",
    "acc-5k": "cabeca",
    "acc-25km": "fundo",
    "acc-streak3": "pescoco",
    "acc-250km": "fundo",
    "acc-1hora": "cabeca",
    "acc-sub10k": "cabeca",
    "acc-100treinos": "pescoco",
    "acc-metabatida": "fundo",
    "acc-amanheceres": "fundo",
    "acc-noites": "fundo",
    "acc-1ano": "cabeca",
}

# id -> (slot, preco em RunCoin)
STORE_ACCESSORIES = {
    "store-cartola": ("cabeca", 80),
    "store-oculos": ("cabeca", 60),
    "store-cachecol": ("pescoco", 50),
    "store-laco": ("pescoco", 40),
    "store-skyline": ("fundo", 100),
    "store-arcoiris": ("fundo", 70),
}


def accessory_slot(accessory_id: str) -> str | None:
    if accessory_id in ACHIEVEMENT_ACCESSORIES:
        return ACHIEVEMENT_ACCESSORIES[accessory_id]
    if accessory_id in STORE_ACCESSORIES:
        return STORE_ACCESSORIES[accessory_id][0]
    return None
