from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.validators import ImageUrl, OptionalImageUrl


class GroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    city: str = Field(default="Brasil", max_length=80)
    description: str = Field(default="", max_length=500)
    tag: str = Field(default="Run", max_length=40)


class GroupOut(BaseModel):
    id: str
    name: str
    city: str
    description: str
    tag: str
    photo_url: str | None = Field(serialization_alias="photoURL")
    created_by: str = Field(serialization_alias="createdBy")
    creator_name: str = Field(serialization_alias="creatorName")
    member_ids: list[str] = Field(serialization_alias="memberIds")
    members_count: int = Field(serialization_alias="membersCount")
    weekly_km: float = Field(serialization_alias="weeklyKm")
    weekly_km_week: str | None = Field(serialization_alias="weeklyKmWeek")
    created_at: datetime = Field(serialization_alias="createdAt")
    updated_at: datetime = Field(serialization_alias="updatedAt")

    @field_validator("id", mode="before")
    @classmethod
    def _stringify_id(cls, value: object) -> str:
        return str(value)


class UpdateGroupPhotoIn(BaseModel):
    photo_url: ImageUrl = Field(validation_alias="photoURL")


# Nota: authorName/authorPhoto/senderName/senderPhoto NAO vem mais do
# cliente (o Firestore antigo confiava nesses campos vindos do front, o que
# permitia qualquer um se passar por outro usuario). O backend sempre busca
# o nome/foto atuais do autor via join com users — ver _author_fields().


class GroupPostCreate(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    image_url: OptionalImageUrl = Field(default=None, validation_alias="imageURL")


class GroupPostOut(BaseModel):
    id: str
    author_id: str = Field(serialization_alias="authorId")
    author_name: str = Field(serialization_alias="authorName")
    author_photo: str | None = Field(serialization_alias="authorPhoto")
    text: str
    image_url: str | None = Field(serialization_alias="imageURL")
    likes: list[str]
    comments_count: int = Field(serialization_alias="commentsCount")
    created_at: datetime = Field(serialization_alias="createdAt")

    @field_validator("id", mode="before")
    @classmethod
    def _stringify_id(cls, value: object) -> str:
        return str(value)


class ToggleLikeIn(BaseModel):
    is_liked: bool = Field(validation_alias="isLiked")


class GroupCommentCreate(BaseModel):
    text: str = Field(min_length=1, max_length=1000)


class GroupCommentOut(BaseModel):
    id: str
    author_id: str = Field(serialization_alias="authorId")
    author_name: str = Field(serialization_alias="authorName")
    author_photo: str | None = Field(serialization_alias="authorPhoto")
    text: str
    created_at: datetime = Field(serialization_alias="createdAt")

    @field_validator("id", mode="before")
    @classmethod
    def _stringify_id(cls, value: object) -> str:
        return str(value)


class GroupMessageCreate(BaseModel):
    text: str = Field(min_length=1, max_length=1000)


class GroupMessageOut(BaseModel):
    id: str
    sender_id: str = Field(serialization_alias="senderId")
    sender_name: str = Field(serialization_alias="senderName")
    sender_photo: str | None = Field(serialization_alias="senderPhoto")
    text: str
    created_at: datetime = Field(serialization_alias="createdAt")

    @field_validator("id", mode="before")
    @classmethod
    def _stringify_id(cls, value: object) -> str:
        return str(value)
