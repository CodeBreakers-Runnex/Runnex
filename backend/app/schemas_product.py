from pydantic import BaseModel, ConfigDict, Field, field_validator


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    category: str
    price: float
    original_price: float | None = Field(serialization_alias="originalPrice")
    rating: float
    reviews: int
    tag: str | None
    gradient: str
    accent: str
    emoji: str
    external_url: str | None = Field(serialization_alias="externalUrl")

    @field_validator("id", mode="before")
    @classmethod
    def _stringify_id(cls, value: object) -> str:
        return str(value)
