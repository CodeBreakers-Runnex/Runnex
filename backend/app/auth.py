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
from jose.exceptions import JWTError

from app.config import settings

GOOGLE_JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
GOOGLE_ISSUER = f"https://securetoken.google.com/{settings.firebase_project_id}"
JWKS_CACHE_TTL_SECONDS = 3600

_jwks_cache: dict = {"keys": None, "fetched_at": 0.0}

bearer_scheme = HTTPBearer()


def _get_jwks() -> dict:
    """O endpoint retorna um JWK Set de verdade: {"keys": [{"kid": ..., ...}]}.
    (Bug corrigido: antes o codigo assumia {kid: chave} direto no topo, que
    nunca bate com o formato real — toda verificacao falhava com
    "Unable to parse an RSA_JWK from key: None".)"""
    now = time.time()
    if _jwks_cache["keys"] is None or now - _jwks_cache["fetched_at"] > JWKS_CACHE_TTL_SECONDS:
        response = requests.get(GOOGLE_JWKS_URL, timeout=5)
        response.raise_for_status()
        body = response.json()
        _jwks_cache["keys"] = {jwk["kid"]: jwk for jwk in body.get("keys", [])}
        _jwks_cache["fetched_at"] = now
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
    try:
        header = jwt.get_unverified_header(token)
        jwks = _get_jwks()
        key = jwks.get(header.get("kid")) if isinstance(jwks, dict) else None

        payload = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            audience=settings.firebase_project_id,
            issuer=GOOGLE_ISSUER,
        )
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token do Firebase invalido ou expirado.",
        ) from exc

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
