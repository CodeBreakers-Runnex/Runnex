from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ShoeInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, allow_inf_nan=False, extra="forbid")

    name: str = Field(min_length=1, max_length=80)
    brand: str | None = Field(default=None, max_length=80)
    model: str | None = Field(default=None, max_length=80)
    purchase_date: date | None = Field(default=None, validation_alias="purchaseDate")
    initial_km: float = Field(default=0, validation_alias="initialKm", ge=0, le=1000000)
    limit_km: float = Field(default=600, validation_alias="limitKm", gt=0, le=100000)
    is_default: bool = Field(default=False, validation_alias="isDefault")
    manually_worn: bool = Field(default=False, validation_alias="manuallyWorn")
    retired: bool = False


class ShoeOut(BaseModel):
    id: str
    name: str
    brand: str | None
    model: str | None
    purchase_date: date | None = Field(serialization_alias="purchaseDate")
    initial_km: float = Field(serialization_alias="initialKm")
    limit_km: float = Field(serialization_alias="limitKm")
    is_default: bool = Field(serialization_alias="isDefault")
    manually_worn: bool = Field(serialization_alias="manuallyWorn")
    retired: bool
    total_km: float = Field(serialization_alias="totalKm")
    remaining_km: float = Field(serialization_alias="remainingKm")
    usage_percent: float = Field(serialization_alias="usagePercent")
    runs_count: int = Field(serialization_alias="runsCount")
    status: Literal["good", "attention", "worn", "retired"]

    @field_validator("id", mode="before")
    @classmethod
    def stringify_id(cls, value: object) -> str:
        return str(value)


class ActivityShoeInput(BaseModel):
    shoe_id: int | None = Field(validation_alias="shoeId", gt=0)
