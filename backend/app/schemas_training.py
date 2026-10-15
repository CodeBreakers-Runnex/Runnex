from datetime import date, datetime, time, timezone
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from pydantic.alias_generators import to_camel

Category = Literal["easy", "interval", "long", "tempo", "walk", "other", "rest"]
Status = Literal["planned", "completed", "skipped", "cancelled"]


def valid_zone(value: str) -> str:
    try:
        ZoneInfo(value)
    except (ZoneInfoNotFoundError, ValueError):
        raise ValueError("Fuso horário inválido.")
    return value


def scheduled_instant(day: date, clock: time | None, zone: str) -> datetime | None:
    if clock is None:
        return None
    naive = datetime.combine(day, clock)
    local = naive.replace(tzinfo=ZoneInfo(zone))
    utc = local.astimezone(timezone.utc)
    if utc.astimezone(ZoneInfo(zone)).replace(tzinfo=None) != naive:
        raise ValueError("Esse horário não existe no fuso escolhido. Escolha outro horário.")
    if local.utcoffset() != local.replace(fold=1).utcoffset():
        raise ValueError("Esse horário é ambíguo no fuso escolhido. Escolha outro horário.")
    return utc


class TrainingSchema(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True, extra="forbid", allow_inf_nan=False)


class WorkoutInput(TrainingSchema):
    title: str = Field(min_length=1, max_length=80)
    category: Category
    notes: str | None = Field(default=None, max_length=1000)
    planned_date: date
    planned_time: time | None = None
    timezone: str = Field(default="America/Sao_Paulo", max_length=80)
    target_distance_km: float | None = Field(default=None, gt=0, le=500)
    target_duration_minutes: int | None = Field(default=None, gt=0, le=1440)

    @field_validator("title", "notes", mode="before")
    @classmethod
    def trim_text(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("timezone")
    @classmethod
    def check_zone(cls, value):
        return valid_zone(value)

    @model_validator(mode="after")
    def validate_schedule(self):
        if not 2000 <= self.planned_date.year <= 2100:
            raise ValueError("Informe uma data entre 2000 e 2100.")
        if self.planned_time and (self.planned_time.tzinfo is not None or self.planned_time.second or self.planned_time.microsecond):
            raise ValueError("Informe um horário local com precisão de minutos.")
        if self.category == "rest" and (self.target_distance_km is not None or self.target_duration_minutes is not None):
            raise ValueError("Descanso não possui meta de corrida.")
        scheduled_instant(self.planned_date, self.planned_time, self.timezone)
        return self


class WorkoutUpdate(WorkoutInput):
    revision: int = Field(ge=1)


class StatusInput(TrainingSchema):
    status: Status
    revision: int = Field(ge=1)


class ActivityLinkInput(TrainingSchema):
    activity_id: int = Field(gt=0)
    revision: int = Field(ge=1)


class ActivityEvidence(TrainingSchema):
    id: int
    distance: float
    duration_seconds: int
    pace: str
    recorded_at: datetime


class WorkoutOut(TrainingSchema):
    id: int
    title: str
    category: Category
    notes: str | None
    planned_date: date
    planned_time: time | None
    timezone: str
    scheduled_at: datetime | None
    original_date: date
    target_distance_km: float | None
    target_duration_minutes: int | None
    status: Status
    completion_source: str | None
    completed_at: datetime | None
    completed_activity_id: int | None
    evidence_removed: bool
    revision: int
    overdue: bool
    activity: ActivityEvidence | None


class WorkoutPage(TrainingSchema):
    items: list[WorkoutOut]
    next_offset: int | None
    total: int
