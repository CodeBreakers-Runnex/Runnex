"""Catalogo do pet no servidor - espelha PET_SPECIES e PET_ACCESSORIES de
src/lib/pet.ts (tests/test_parity.py falha se os dois divergirem).

Bug real encontrado ao escrever os testes: POST /pet/purchase debitava o
preco enviado pelo cliente (price >= 0), entao {"price": 0} comprava
qualquer item de graca - inclusive acessorios de conquista e ids
inventados. O preco agora vem daqui.
"""

PET_SPECIES = frozenset({"guepardo", "lebre", "cavalo", "falcao", "galgo", "tartaruga"})

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
    "store-bandana": ("cabeca", 40),
    "store-faixa": ("cabeca", 30),
    "store-gorro": ("cabeca", 60),
    "store-chapeu-sol": ("cabeca", 70),
    "store-capacete": ("cabeca", 90),
    "store-fone": ("cabeca", 120),
    "store-chapeu-cowboy": ("cabeca", 140),
    "store-tiara-flores": ("cabeca", 150),
    "store-chapeu-festa": ("cabeca", 160),
    "store-chapeu-mago": ("cabeca", 280),
    "store-aureola": ("cabeca", 320),
    "store-capacete-astronauta": ("cabeca", 350),
    "store-chifres-neon": ("cabeca", 380),
    "store-coroa-diamante": ("cabeca", 800),
    "store-coroa-louros": ("cabeca", 1000),
    "store-apito": ("pescoco", 40),
    "store-gravata": ("pescoco", 60),
    "store-numero-peito": ("pescoco", 70),
    "store-colar-perolas": ("pescoco", 90),
    "store-cronometro": ("pescoco", 120),
    "store-sino": ("pescoco", 130),
    "store-colar-trevo": ("pescoco", 150),
    "store-medalha-bronze": ("pescoco", 180),
    "store-medalha-prata": ("pescoco", 300),
    "store-colar-raio": ("pescoco", 340),
    "store-amuleto-lua": ("pescoco", 360),
    "store-medalha-ouro": ("pescoco", 700),
    "store-capa-heroi": ("pescoco", 900),
    "store-parque": ("fundo", 60),
    "store-praia": ("fundo", 80),
    "store-pista": ("fundo", 90),
    "store-chuva": ("fundo", 70),
    "store-trilha": ("fundo", 120),
    "store-deserto": ("fundo", 140),
    "store-neve": ("fundo", 160),
    "store-cerejeiras": ("fundo", 180),
    "store-vulcao": ("fundo", 320),
    "store-aurora": ("fundo", 380),
    "store-fogos": ("fundo", 400),
    "store-oceano": ("fundo", 350),
    "store-espaco": ("fundo", 900),
    "store-podio": ("fundo", 1200),
}


def accessory_slot(accessory_id: str) -> str | None:
    if accessory_id in ACHIEVEMENT_ACCESSORIES:
        return ACHIEVEMENT_ACCESSORIES[accessory_id]
    if accessory_id in STORE_ACCESSORIES:
        return STORE_ACCESSORIES[accessory_id][0]
    return None
