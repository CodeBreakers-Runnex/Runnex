"""Verificação do ID token do Firebase Auth sem o Admin SDK.

Valida a assinatura RS256 do token direto contra as chaves públicas do
Google (JWKS), que giram periodicamente — por isso o cache com TTL em vez
de buscar uma vez só no start do processo.
"""

import time

import requests
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt
from jose.exceptions import JOSEError

from app.config import settings

GOOGLE_JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
GOOGLE_ISSUER = f"https://securetoken.google.com/{settings.firebase_project_id}"
JWKS_CACHE_TTL_SECONDS = 3600
# Kid desconhecido (o Google girou as chaves) busca de novo, mas no maximo
# uma vez por este intervalo: um token com kid inventado nao vira um
# martelo de requisicoes para o Google.
JWKS_REFRESH_MIN_INTERVAL_SECONDS = 60

_jwks_cache: dict = {"keys": None, "fetched_at": 0.0}

bearer_scheme = HTTPBearer()


def _fetch_jwks() -> dict | None:
    """Chaves atuais do Google, ou None se a busca falhar."""
    try:
        response = requests.get(GOOGLE_JWKS_URL, timeout=5)
        response.raise_for_status()
        body = response.json()
        return {jwk["kid"]: jwk for jwk in body.get("keys", [])}
    except (requests.RequestException, ValueError, KeyError, TypeError):
        return None


def _get_jwks(kid: str | None = None) -> dict:
    """O endpoint retorna um JWK Set de verdade: {"keys": [{"kid": ..., ...}]}.
    (Bug corrigido: antes o codigo assumia {kid: chave} direto no topo, que
    nunca bate com o formato real — toda verificacao falhava com
    "Unable to parse an RSA_JWK from key: None".)

    Busca de novo quando o cache vence ou quando aparece um kid que o cache
    nao tem. Se a busca falhar, continua com as chaves que ja tinha: antes
    um soluco de rede do Google virava 500 em toda rota autenticada."""
    now = time.time()
    keys = _jwks_cache["keys"]
    age = now - _jwks_cache["fetched_at"]
    expired = keys is None or age > JWKS_CACHE_TTL_SECONDS
    unknown_kid = keys is not None and kid is not None and kid not in keys and age > JWKS_REFRESH_MIN_INTERVAL_SECONDS
    if expired or unknown_kid:
        fresh = _fetch_jwks()
        if fresh is not None:
            _jwks_cache["keys"] = fresh
            _jwks_cache["fetched_at"] = now
        elif keys is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Nao foi possivel validar o login agora. Tente de novo em instantes.",
            )
    return _jwks_cache["keys"]


class FirebaseUser:
    def __init__(self, uid: str, email: str | None, email_verified: bool):
        self.uid = uid
        self.email = email
        self.email_verified = email_verified


def decode_firebase_token(token: str) -> FirebaseUser:
    """Nucleo da verificacao, sem depender do HTTPBearer — reaproveitado pelo
    WebSocket, que nao consegue mandar header Authorization no handshake do
    navegador (o token chega via query param nesse caso)."""
    invalid = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token do Firebase invalido ou expirado.",
    )
    try:
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")
        key = _get_jwks(kid).get(kid)
        if key is None:
            raise invalid
        payload = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            audience=settings.firebase_project_id,
            issuer=GOOGLE_ISSUER,
        )
    # JOSEError cobre JWTError e JWKError: antes um kid desconhecido lancava
    # JWKError, que escapava e virava 500 em vez de 401.
    except JOSEError as exc:
        raise invalid from exc

    if not payload.get("sub"):
        raise invalid

    return FirebaseUser(
        uid=payload["sub"],
        email=payload.get("email"),
        email_verified=payload.get("email_verified", False),
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> FirebaseUser:
    return decode_firebase_token(credentials.credentials)


def require_verified_email(user: FirebaseUser = Depends(get_current_user)) -> FirebaseUser:
    """Fase 1.5: bloqueia endpoints sensiveis para quem nao confirmou o email.

    Login social (Google) ja vem com email_verified=True, entao nao afeta esse fluxo.
    """
    if not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Confirme seu email antes de continuar.",
        )
    return user
