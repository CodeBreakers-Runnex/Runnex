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


class PerformancePoint(BaseModel):
    segment_id: int = Field(default=0, validation_alias="segmentId", ge=0)
    elapsed_seconds: float = Field(validation_alias="elapsedSeconds", ge=0, le=86400, allow_inf_nan=False)
    distance_km: float = Field(validation_alias="distanceKm", ge=0, le=500, allow_inf_nan=False)


class HeartRatePoint(BaseModel):
    segment_id: int = Field(default=0, validation_alias="segmentId", ge=0)
    elapsed_seconds: float = Field(validation_alias="elapsedSeconds", ge=0, le=86400, allow_inf_nan=False)
    bpm: int = Field(ge=25, le=250)


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

    performance_samples: list[PerformancePoint] | None = Field(default=None, validation_alias="performanceSamples", max_length=5000)
    heart_rate_samples: list[HeartRatePoint] | None = Field(default=None, validation_alias="heartRateSamples", max_length=90000)
    heart_rate_max_bpm: int | None = Field(default=None, validation_alias="heartRateMaxBpm", ge=100, le=250)
    is_simulated: bool = Field(default=False, validation_alias="isSimulated")

    @model_validator(mode="after")
    def _check_plausible(self) -> "ActivityCreate":
        check_run_is_plausible(self.distance, self.duration_seconds, self.route)
        previous_time, previous_distance, previous_segment = -1.0, -1.0, -1
        for point in self.performance_samples or []:
            if point.elapsed_seconds <= previous_time or point.distance_km < previous_distance or point.segment_id < previous_segment:
                raise ValueError("Os pontos de performance devem avançar no tempo, sem regressão de distância ou segmento.")
            if point.elapsed_seconds > self.duration_seconds or point.distance_km > self.distance + .02:
                raise ValueError("Pontos de performance fora dos limites da corrida.")
            previous_time, previous_distance = point.elapsed_seconds, point.distance_km
            previous_segment = point.segment_id
        previous_time, previous_segment = -1.0, -1
        for point in self.heart_rate_samples or []:
            if point.elapsed_seconds <= previous_time or point.elapsed_seconds > self.duration_seconds or point.segment_id < previous_segment:
                raise ValueError("As amostras cardíacas devem ter tempos crescentes dentro da corrida.")
            previous_time = point.elapsed_seconds
            previous_segment = point.segment_id
        if self.heart_rate_samples and self.heart_rate_max_bpm is None:
            raise ValueError("Informe a FC máxima de referência para calcular as zonas.")
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
