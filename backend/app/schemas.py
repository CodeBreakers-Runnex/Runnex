from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.activity_rules import check_run_is_plausible
from app.validators import OptionalImageUrl


class RoutePoint(BaseModel):
    lat: float
    lng: float


class UserProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    uid: str
    display_name: str = Field(serialization_alias="displayName")
    photo_url: str | None = Field(serialization_alias="photoURL")
    total_xp: int = Field(serialization_alias="totalXP")
    level: str
    monthly_km: float = Field(serialization_alias="monthlyKm")
    bio: str | None
    location: str | None
    private_profile: bool = Field(serialization_alias="privateProfile")
    weekly_goal_km: float | None = Field(serialization_alias="weeklyGoalKm")
    onboarded: bool
    # Versao dos termos aceita (src/content/legalContent.ts LEGAL_VERSION).
    # O app pede novo aceite quando difere da versao atual.
    terms_version: str | None = Field(serialization_alias="termsVersion")
    pet_species: str | None = Field(serialization_alias="petSpecies")
    pet_name: str | None = Field(serialization_alias="petName")
    pet_coins: int = Field(serialization_alias="petCoins")
    pet_unlocked_accessory_ids: list[str] = Field(serialization_alias="petUnlockedAccessoryIds")
    pet_equipped_cabeca: str | None = Field(serialization_alias="petEquippedCabeca")
    pet_equipped_pescoco: str | None = Field(serialization_alias="petEquippedPescoco")
    pet_equipped_fundo: str | None = Field(serialization_alias="petEquippedFundo")


class UserProfileCreate(BaseModel):
    display_name: str | None = Field(default=None, validation_alias="displayName")
    photo_url: OptionalImageUrl = Field(default=None, validation_alias="photoURL")
    terms_version: str | None = Field(default=None, validation_alias="termsVersion")
    bio: str | None = Field(default=None, max_length=150)
    location: str | None = Field(default=None, max_length=120)
    onboarded: bool | None = Field(default=None)
    weekly_goal_km: float | None = Field(default=None, validation_alias="weeklyGoalKm", ge=0, le=500)
    private_profile: bool | None = Field(default=None, validation_alias="privateProfile")


class ActivityCreate(BaseModel):
    """Espelha validActivityCreate de firestore.rules."""

    user_id: str = Field(validation_alias="userId")
    user_name: str = Field(validation_alias="userName", min_length=1, max_length=80)
    user_avatar: OptionalImageUrl = Field(default=None, validation_alias="userAvatar")
    distance: float = Field(gt=0, le=500)
    time: str
    duration_seconds: int = Field(validation_alias="durationSeconds", gt=0, le=24 * 3600)
    pace: str
    calories: int | None = Field(default=None, ge=0)
    type: str
    route: list[RoutePoint] | None = Field(default=None, max_length=5000)

    @model_validator(mode="after")
    def _check_plausible(self) -> "ActivityCreate":
        check_run_is_plausible(self.distance, self.duration_seconds, self.route)
        return self


class ActivityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str = Field(serialization_alias="userId")
    user_name: str = Field(serialization_alias="userName")
    user_avatar: str | None = Field(serialization_alias="userAvatar")

    @field_validator("id", mode="before")
    @classmethod
    def _stringify_id(cls, value: object) -> str:
        return str(value)

    distance: float
    time: str
    duration_seconds: int = Field(serialization_alias="durationSeconds")
    pace: str
    calories: int | None
    type: str
    likes: list[str]
    route: list[dict] | None
    xp_gained: int | None = Field(serialization_alias="xpGained")
    created_at: datetime = Field(serialization_alias="timestamp")


class SaveActivityResult(BaseModel):
    id: str
    xp_update_failed: bool = Field(serialization_alias="xpUpdateFailed")

    @field_validator("id", mode="before")
    @classmethod
    def _stringify_id(cls, value: object) -> str:
        return str(value)


class ToggleLikeIn(BaseModel):
    is_liked: bool = Field(validation_alias="isLiked")
