"""Rate limit por usuario autenticado, em memoria.

Chaveado pelo uid do Firebase, nao por IP: atras do proxy do Render todas as
requisicoes chegariam com o IP do proxy, e todo endpoint limitado aqui ja exige
login. O estado vive no processo - suficiente enquanto o backend roda numa
unica instancia; com mais de uma, trocar o dicionario por Redis.
"""

import math
import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import Depends, HTTPException, status

from app.auth import FirebaseUser, get_current_user

_hits: dict[tuple[str, str], deque[float]] = defaultdict(deque)
_lock = Lock()


def rate_limit(bucket: str, max_calls: int, window_seconds: int):
    def dependency(current_user: FirebaseUser = Depends(get_current_user)) -> None:
        now = time.monotonic()
        key = (bucket, current_user.uid)
        with _lock:
            hits = _hits[key]
            while hits and now - hits[0] >= window_seconds:
                hits.popleft()
            if len(hits) >= max_calls:
                retry_after = max(1, math.ceil(window_seconds - (now - hits[0])))
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Muitas acoes em pouco tempo. Aguarde um instante e tente novamente.",
                    headers={"Retry-After": str(retry_after)},
                )
            hits.append(now)

    return dependency


def is_blocked(bucket: str, uid: str, max_failures: int, window_seconds: int) -> bool:
    """So conta falhas (ex.: codigo de grupo errado). Consultar antes de
    verificar, para que quem esta bloqueado nao consiga nem acertar."""
    now = time.monotonic()
    with _lock:
        hits = _hits[(bucket, uid)]
        while hits and now - hits[0] >= window_seconds:
            hits.popleft()
        return len(hits) >= max_failures


def record_failure(bucket: str, uid: str) -> None:
    with _lock:
        _hits[(bucket, uid)].append(time.monotonic())
