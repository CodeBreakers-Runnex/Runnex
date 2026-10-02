from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints


class ChatMessageIn(BaseModel):
    message: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)]
    # Minutos a frente de UTC no aparelho (Brasilia = -180). Define o "hoje"
    # da janela de 7 dias da meta semanal e as datas exibidas, igual o app
    # faz no fuso local. Sem ele, UTC.
    utc_offset_minutes: int = Field(default=0, validation_alias="utcOffsetMinutes", ge=-720, le=840)


class ChatMessageOut(BaseModel):
    reply: str
