"""Login no backend quando as chaves do Google (JWKS) falham ou giram.

Antes: um erro de rede ao buscar as chaves virava 500 em TODA rota
autenticada, e o cache valido era jogado fora; uma chave nova do Google
(kid desconhecido) so era aceita depois de 1 h de cache."""

import time

import pytest
import requests
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException
from jose import jwk, jwt

from app import auth
from app.config import settings


def _keypair(kid: str):
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = private.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()).decode()
    public_pem = private.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo).decode()
    return private_pem, {**jwk.construct(public_pem, "RS256").to_dict(), "kid": kid}


def _token(private_pem: str, kid: str, **overrides) -> str:
    now = int(time.time())
    claims = {"iss": auth.GOOGLE_ISSUER, "aud": settings.firebase_project_id, "sub": "ana", "email_verified": True, "iat": now, "exp": now + 3600, **overrides}
    return jwt.encode(claims, private_pem, algorithm="RS256", headers={"kid": kid})


class FakeResponse:
    def __init__(self, keys):
        self._keys = keys

    def raise_for_status(self):
        pass

    def json(self):
        return {"keys": self._keys}


@pytest.fixture(autouse=True)
def empty_cache(monkeypatch):
    monkeypatch.setattr(auth, "_jwks_cache", {"keys": None, "fetched_at": 0.0})


def test_network_error_keeps_using_cached_keys(monkeypatch):
    private, public = _keypair("k1")
    monkeypatch.setattr(auth.requests, "get", lambda *a, **k: FakeResponse([public]))
    assert auth.decode_firebase_token(_token(private, "k1")).uid == "ana"

    # Cache vencido e o Google fora do ar: continua com as chaves que tinha.
    auth._jwks_cache["fetched_at"] = 0.0

    def offline(*a, **k):
        raise requests.ConnectionError("sem rede")

    monkeypatch.setattr(auth.requests, "get", offline)
    assert auth.decode_firebase_token(_token(private, "k1")).uid == "ana"


def test_network_error_without_any_keys_is_503_not_500(monkeypatch):
    private, _ = _keypair("k1")

    def offline(*a, **k):
        raise requests.ConnectionError("sem rede")

    monkeypatch.setattr(auth.requests, "get", offline)
    with pytest.raises(HTTPException) as exc:
        auth.decode_firebase_token(_token(private, "k1"))
    assert exc.value.status_code == 503


def test_unknown_kid_fetches_keys_again(monkeypatch):
    # O Google gira as chaves: um token assinado com a chave nova precisa
    # passar sem esperar o cache de 1 h vencer.
    old_private, old_public = _keypair("antiga")
    new_private, new_public = _keypair("nova")
    served = [[old_public]]
    monkeypatch.setattr(auth.requests, "get", lambda *a, **k: FakeResponse(served[0]))
    assert auth.decode_firebase_token(_token(old_private, "antiga")).uid == "ana"

    served[0] = [old_public, new_public]
    # Passou mais de um minuto desde a ultima busca (menos que isso, um kid
    # desconhecido nao dispara nova busca - ver o teste seguinte).
    auth._jwks_cache["fetched_at"] -= auth.JWKS_REFRESH_MIN_INTERVAL_SECONDS + 1
    assert auth.decode_firebase_token(_token(new_private, "nova")).uid == "ana"


def test_unknown_kid_does_not_hammer_google(monkeypatch):
    private, public = _keypair("k1")
    calls = []

    def get(*a, **k):
        calls.append(1)
        return FakeResponse([public])

    monkeypatch.setattr(auth.requests, "get", get)
    auth.decode_firebase_token(_token(private, "k1"))
    for _ in range(5):
        with pytest.raises(HTTPException):
            auth.decode_firebase_token(_token(private, "inventada"))
    assert len(calls) <= 2  # a primeira busca + no maximo uma por kid desconhecido no intervalo


def test_token_without_subject_is_401(monkeypatch):
    private, public = _keypair("k1")
    monkeypatch.setattr(auth.requests, "get", lambda *a, **k: FakeResponse([public]))
    token = _token(private, "k1")
    claims = jwt.get_unverified_claims(token)
    claims.pop("sub")
    without_sub = jwt.encode(claims, private, algorithm="RS256", headers={"kid": "k1"})
    with pytest.raises(HTTPException) as exc:
        auth.decode_firebase_token(without_sub)
    assert exc.value.status_code == 401
