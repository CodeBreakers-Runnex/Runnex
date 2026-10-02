from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class RunningEventOut(BaseModel):
    id: str
    title: str
    date: str
    location: str
    city: str
    state: str | None
    country: str | None
    lat: float | None
    lng: float | None
    participants_count: int = Field(serialization_alias="participantsCount")
    participants_ids: list[str] = Field(serialization_alias="participantsIds")
    category: str
    distance_options: list[str] | None = Field(serialization_alias="distanceOptions")
    image: str | None
    price: str
    official_url: str | None = Field(serialization_alias="officialUrl")
    source: str | None
    source_url: str | None = Field(serialization_alias="sourceUrl")
    source_type: str | None = Field(serialization_alias="sourceType")
    verified: bool
    status: str
    last_synced_at: datetime | None = Field(serialization_alias="lastSyncedAt")
    distance_km: float | None = Field(serialization_alias="distanceKm")
    event_timestamp: datetime = Field(serialization_alias="timestamp")

    @field_validator("id", mode="before")
    @classmethod
    def _stringify_id(cls, value: object) -> str:
        return str(value)
