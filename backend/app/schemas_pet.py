from pydantic import BaseModel, Field


class ChoosePetIn(BaseModel):
    species: str
    name: str = Field(min_length=1, max_length=40)


class EquipPetAccessoryIn(BaseModel):
    slot: str  # cabeca | pescoco | fundo
    accessory_id: str | None = Field(default=None, validation_alias="accessoryId")


class PurchasePetAccessoryIn(BaseModel):
    accessory_id: str = Field(validation_alias="accessoryId")
    # Ignorado: o preco vem de app/pet_catalog.py. Aceito so para APKs
    # antigos, que ainda enviam o campo, continuarem funcionando.
    price: int | None = None
