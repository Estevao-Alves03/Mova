import re
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, StringConstraints, field_validator, model_validator

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=100)]

_PHONE = re.compile(r"^[0-9()+\-\s.]{8,20}$")
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _blank_to_none(value: str | None) -> str | None:
    value = value.strip() if isinstance(value, str) else value
    return value or None


class _UnitFields(BaseModel):
    address: str | None = None
    phone: str | None = None
    email: str | None = None

    @field_validator("address", "phone", "email", mode="before")
    @classmethod
    def blank_is_none(cls, value: str | None) -> str | None:
        return _blank_to_none(value)

    @field_validator("address")
    @classmethod
    def address_length(cls, value: str | None) -> str | None:
        if value and len(value) > 200:
            raise ValueError("O endereço deve ter no máximo 200 caracteres.")
        return value

    @field_validator("phone")
    @classmethod
    def phone_format(cls, value: str | None) -> str | None:
        if value and not _PHONE.match(value):
            raise ValueError("Telefone inválido.")
        return value

    @field_validator("email")
    @classmethod
    def email_format(cls, value: str | None) -> str | None:
        if value and (len(value) > 254 or not _EMAIL.match(value)):
            raise ValueError("E-mail inválido.")
        return value.lower() if value else value


class UnitCreate(_UnitFields):
    model_config = ConfigDict(extra="forbid")

    name: Name


class UnitUpdate(_UnitFields):
    model_config = ConfigDict(extra="forbid")

    name: Name | None = None
    active: bool | None = None

    @model_validator(mode="after")
    def not_empty(self) -> "UnitUpdate":
        if not self.model_fields_set:
            raise ValueError("Informe ao menos um campo para alterar.")
        for field in ("name", "active"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError("Valores nulos não são aceitos.")
        return self


class RoomCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Name


class RoomUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Name | None = None
    active: bool | None = None

    @model_validator(mode="after")
    def not_empty(self) -> "RoomUpdate":
        if not self.model_fields_set:
            raise ValueError("Informe ao menos um campo para alterar.")
        if any(getattr(self, field) is None for field in self.model_fields_set):
            raise ValueError("Valores nulos não são aceitos.")
        return self


class RoomOut(BaseModel):
    id: UUID
    name: str
    active: bool


class MemberLink(BaseModel):
    """Nutricionista vinculado à unidade."""

    id: UUID
    full_name: str
    active: bool


class MemberLinkCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    membership_id: UUID


class UnitOut(BaseModel):
    id: UUID
    name: str
    address: str | None
    phone: str | None
    email: str | None
    active: bool
    rooms: list[RoomOut]
    members: list[MemberLink]
