"""Verificacao real do token (app/auth.py), sem trocar get_current_user.

Os outros testes substituem a autenticacao por um usuario falso; este assina
um token RS256 de verdade, como o Firebase faz, para garantir que a troca de
versao do python-jose nao quebra o login de ninguem."""

import time

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException
from jose import jwk, jwt

from app import auth
from app.config import settings


@pytest.fixture
def signing_key(monkeypatch):
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = private.private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()
    ).decode()
    public_pem = private.public_key().public_bytes(
        serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo
    ).decode()
    public_jwk = {**jwk.construct(public_pem, "RS256").to_dict(), "kid": "chave-1"}
    monkeypatch.setattr(auth, "_get_jwks", lambda: {"chave-1": public_jwk})
    return private_pem


def _token(private_pem: str, **overrides) -> str:
    now = int(time.time())
    claims = {
        "iss": auth.GOOGLE_ISSUER,
        "aud": settings.firebase_project_id,
        "sub": "ana",
        "email": "ana@exemplo.com",
        "email_verified": True,
        "iat": now,
        "exp": now + 3600,
        **overrides,
    }
    return jwt.encode(claims, private_pem, algorithm="RS256", headers={"kid": "chave-1"})


def test_valid_firebase_token_is_accepted(signing_key):
    user = auth.decode_firebase_token(_token(signing_key))
    assert (user.uid, user.email, user.email_verified) == ("ana", "ana@exemplo.com", True)


@pytest.mark.parametrize("overrides", [
    {"exp": int(time.time()) - 10},          # expirado
    {"aud": "outro-projeto"},                # token de outro projeto Firebase
    {"iss": "https://securetoken.google.com/outro"},
])
def test_invalid_claims_are_rejected(signing_key, overrides):
    with pytest.raises(HTTPException) as exc:
        auth.decode_firebase_token(_token(signing_key, **overrides))
    assert exc.value.status_code == 401


def test_token_signed_with_another_key_is_rejected(signing_key):
    other = rsa.generate_private_key(public_exponent=65537, key_size=2048).private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()
    ).decode()
    with pytest.raises(HTTPException):
        auth.decode_firebase_token(_token(other))
