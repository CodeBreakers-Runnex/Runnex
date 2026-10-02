from datetime import datetime, timezone


def utcnow() -> datetime:
    """datetime.utcnow() é naive (sem tzinfo) — quando gravado numa coluna
    timestamptz, o Postgres assume que representa o fuso horario da SESSAO
    (nao necessariamente UTC), deslocando o horario gravado se o servidor
    nao estiver configurado em UTC. Bug real encontrado em teste manual:
    funcionava no ambiente de dev (Postgres em UTC) e quebrava no Windows
    do usuario (Postgres no fuso local), fazendo corridas ficarem fora do
    dia/semana certos no calculo de "km da semana". datetime.now(timezone.utc)
    carrega o fuso explicitamente, entao o valor gravado é sempre correto
    independente da timezone do servidor Postgres.
    """
    return datetime.now(timezone.utc)
