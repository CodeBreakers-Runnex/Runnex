import base64
import binascii
import re
from typing import Annotated

from pydantic import AfterValidator

# O app sempre envia fotos redimensionadas no navegador (resizeImageToDataUrl:
# JPEG 400px, qualidade 0.8), bem abaixo disso em base64. O teto existe para
# um cliente adulterado nao gravar blobs arbitrarios nas colunas de imagem.
MAX_IMAGE_DATA_URL_LENGTH = 300_000
MAX_IMAGE_HTTP_URL_LENGTH = 2048

_DATA_URL_PREFIX = re.compile(r"^data:image/(jpeg|png|webp);base64,")

_SIGNATURES = {
    "jpeg": lambda raw: raw.startswith(b"\xff\xd8\xff"),
    "png": lambda raw: raw.startswith(b"\x89PNG\r\n\x1a\n"),
    "webp": lambda raw: raw[:4] == b"RIFF" and raw[8:12] == b"WEBP",
}


def validate_image_url(value: str | None) -> str | None:
    """Aceita URL http(s) (ex.: foto do Google) ou data URL base64 de
    JPEG/PNG/WebP cujo conteudo bate com o tipo declarado. None/vazio
    passam sem alteracao."""
    if not value:
        return value

    if value.startswith(("https://", "http://")):
        if len(value) > MAX_IMAGE_HTTP_URL_LENGTH:
            raise ValueError("URL de imagem longa demais.")
        return value

    match = _DATA_URL_PREFIX.match(value)
    if not match:
        raise ValueError("A imagem deve ser uma URL http(s) ou um JPEG/PNG/WebP em base64.")
    if len(value) > MAX_IMAGE_DATA_URL_LENGTH:
        raise ValueError("Imagem grande demais. Envie uma foto menor.")

    try:
        raw = base64.b64decode(value[match.end():], validate=True)
    except binascii.Error:
        raise ValueError("Imagem em base64 invalida.") from None

    if not _SIGNATURES[match.group(1)](raw):
        raise ValueError("O conteudo da imagem nao corresponde ao formato declarado.")
    return value


ImageUrl = Annotated[str, AfterValidator(validate_image_url)]
OptionalImageUrl = Annotated[str | None, AfterValidator(validate_image_url)]
