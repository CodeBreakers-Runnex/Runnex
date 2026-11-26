"""Codigo de entrada de grupo privado.

O codigo e gerado pelo servidor (nao escolhido pelo criador: senha escolhida
vira palavra fraca e compartilhada). So o hash fica no banco; o texto puro e
mostrado ao criador uma unica vez, ao criar ou regenerar.
"""

import hashlib
import hmac
import secrets

# Sem 0/O e 1/I/L, que se confundem quando o codigo e ditado ou digitado.
_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 10
_ITERATIONS = 100_000


def generate_code() -> str:
    return "".join(secrets.choice(_ALPHABET) for _ in range(CODE_LENGTH))


def normalize_code(raw: str) -> str:
    """Quem digita usa minuscula, espaco e hifen; nada disso muda o codigo."""
    return "".join(raw.split()).replace("-", "").upper()


def hash_code(code: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", normalize_code(code).encode(), salt, _ITERATIONS)
    return f"pbkdf2${_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_code(code: str, stored: str | None) -> bool:
    if not stored:
        return False
    try:
        _, iterations, salt_hex, digest_hex = stored.split("$")
        expected = bytes.fromhex(digest_hex)
        digest = hashlib.pbkdf2_hmac("sha256", normalize_code(code).encode(), bytes.fromhex(salt_hex), int(iterations))
    except ValueError:
        return False
    return hmac.compare_digest(digest, expected)
