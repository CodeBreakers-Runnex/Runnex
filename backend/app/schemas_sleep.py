from datetime import timedelta
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator, model_validator
from pydantic.alias_generators import to_camel

from app.time_utils import utcnow

SLEEP_CONSENT_VERSION = "sleep-v1-2026-10-08"
RETENTION_DAYS = 90


class SleepInputModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid", str_strip_whitespace=True)


class RecoveryPreferencesInput(SleepInputModel):
    goal_minutes: int | None = Field(default=None, ge=60, le=960)
    timezone: str = Field(default="America/Sao_Paulo", max_length=80)
    preferred_origin: str | None = Field(default=None, min_length=1, max_length=200)

    @field_validator("timezone")
    @classmethod
    def valid_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError) as exc:
            raise ValueError("Fuso horário inválido.") from exc
        return value


class SleepConsentInput(SleepInputModel):
    version: Literal["sleep-v1-2026-10-08"]
    accepted: Literal[True]
    timezone: str = "America/Sao_Paulo"

    _timezone = field_validator("timezone")(RecoveryPreferencesInput.valid_timezone.__func__)


class SleepSessionInput(SleepInputModel):
    start_time: AwareDatetime
    end_time: AwareDatetime
    sleep_seconds: int | None = Field(default=None, ge=0, le=36 * 3600)
    kind: Literal["main", "nap"] = "main"
    end_offset_minutes: int | None = Field(default=None, ge=-840, le=840)

    @model_validator(mode="after")
    def valid_interval(self) -> "SleepSessionInput":
        seconds = (self.end_time - self.start_time).total_seconds()
        if not 0 < seconds <= 36 * 3600:
            raise ValueError("O fim deve ser posterior ao início; o período máximo é de 36 horas.")
        if self.sleep_seconds is not None and self.sleep_seconds > seconds:
            raise ValueError("O tempo dormido não pode superar o período registrado.")
        now = utcnow()
        if self.end_time > now + timedelta(minutes=5):
            raise ValueError("Registre um sono já concluído.")
        if self.end_time < now - timedelta(days=RETENTION_DAYS):
            raise ValueError("O histórico aceita registros dos últimos 90 dias.")
        return self


class SleepImportRecord(SleepSessionInput):
    external_id: str = Field(min_length=1, max_length=200)
    origin: str = Field(min_length=1, max_length=200)
    origin_label: str | None = Field(default=None, max_length=120)
    source_modified_at: AwareDatetime


class SleepImportInput(SleepInputModel):
    sync_generation: str = Field(min_length=36, max_length=36)
    records: list[SleepImportRecord] = Field(default_factory=list, max_length=1000)
    deleted_ids: list[str] = Field(default_factory=list, max_length=1000)
    snapshot_start: AwareDatetime | None = None
    snapshot_end: AwareDatetime | None = None

    @field_validator("deleted_ids")
    @classmethod
    def valid_ids(cls, values: list[str]) -> list[str]:
        if any(not v.strip() or len(v) > 200 for v in values):
            raise ValueError("Identificador de exclusão inválido.")
        return values

    @model_validator(mode="after")
    def valid_snapshot(self) -> "SleepImportInput":
        if (self.snapshot_start is None) != (self.snapshot_end is None):
            raise ValueError("Informe os dois limites do snapshot.")
        if self.snapshot_start is not None and self.snapshot_end is not None:
            if not timedelta(0) < self.snapshot_end - self.snapshot_start <= timedelta(days=31):
                raise ValueError("Janela de sincronização inválida.")
            if any(not self.snapshot_start <= r.start_time < self.snapshot_end for r in self.records):
                raise ValueError("Registro fora da janela de sincronização.")
        return self


class SleepConnectionInput(SleepInputModel):
    enabled: bool


class SleepCheckInInput(SleepInputModel):
    quality: int | None = Field(default=None, ge=1, le=5)
    fatigue: int | None = Field(default=None, ge=1, le=5)

    @model_validator(mode="after")
    def has_answer(self) -> "SleepCheckInInput":
        if self.quality is None and self.fatigue is None:
            raise ValueError("Informe a qualidade do sono ou o cansaço.")
        return self
