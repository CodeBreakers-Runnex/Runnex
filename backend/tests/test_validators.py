import base64

import pytest

from app.validators import MAX_IMAGE_DATA_URL_LENGTH, validate_image_url

JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 32
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
WEBP = b"RIFF\x00\x00\x00\x00WEBP" + b"\x00" * 32


def data_url(kind: str, raw: bytes) -> str:
    return f"data:image/{kind};base64,{base64.b64encode(raw).decode()}"


@pytest.mark.parametrize("value", [None, ""])
def test_empty_values_pass_through(value):
    assert validate_image_url(value) == value


def test_accepts_http_urls():
    url = "https://lh3.googleusercontent.com/a/foto.jpg"
    assert validate_image_url(url) == url


@pytest.mark.parametrize(("kind", "raw"), [("jpeg", JPEG), ("png", PNG), ("webp", WEBP)])
def test_accepts_supported_images(kind, raw):
    value = data_url(kind, raw)
    assert validate_image_url(value) == value


@pytest.mark.parametrize(
    ("value", "message"),
    [
        ("https://x/" + "a" * 2048, "longa demais"),
        ("javascript:alert(1)", "URL http"),
        ("data:image/svg+xml;base64,PHN2Zz4=", "URL http"),
        (data_url("png", JPEG), "nao corresponde"),
        (data_url("jpeg", b"<html><script>alert(1)</script></html>"), "nao corresponde"),
        ("data:image/jpeg;base64,@@@not-base64@@@", "base64 invalida"),
        ("data:image/jpeg;base64," + "A" * MAX_IMAGE_DATA_URL_LENGTH, "grande demais"),
    ],
)
def test_rejects_invalid_images(value, message):
    with pytest.raises(ValueError, match=message):
        validate_image_url(value)
