import re
from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, StringConstraints, field_validator, model_validator

from app.modules.auth.models import UserRole

# O paciente não faz parte da equipe.
TeamRole = Literal[UserRole.admin, UserRole.nutritionist, UserRole.receptionist]
FullName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)]

_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class MemberOut(BaseModel):
    id: UUID
    full_name: str
    email: str
    role: UserRole
    crn: str | None
    active: bool
    # inactive: desativado; invited: ainda não fez o primeiro acesso; active: já acessou.
    status: Literal["active", "invited", "inactive"]
    last_sign_in_at: datetime | None
    is_you: bool


class MemberCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    full_name: FullName
    email: str
    role: TeamRole

    @field_validator("email")
    @classmethod
    def valid_email(cls, value: str) -> str:
        value = value.strip().lower()
        if len(value) > 254 or not _EMAIL.match(value):
            raise ValueError("E-mail inválido.")
        return value


class MemberCreated(BaseModel):
    member: MemberOut
    # Mostrada uma única vez: nada a guarda em texto (só o hash no Supabase Auth).
    temporary_password: str


class MemberUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    full_name: FullName | None = None
    role: TeamRole | None = None
    active: bool | None = None

    @model_validator(mode="after")
    def not_empty(self) -> "MemberUpdate":
        if not self.model_fields_set:
            raise ValueError("Informe ao menos um campo para alterar.")
        for field in self.model_fields_set:
            if getattr(self, field) is None:
                raise ValueError("Valores nulos não são aceitos.")
        return self
