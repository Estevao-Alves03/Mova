import re
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.modules.auth.models import UserRole
from app.modules.settings.constants import CRN_STATE_OPTIONS, MAX_BIO_LENGTH

_CRN_PATTERN = re.compile(r"^CRN-\d{1,2} \d{3,6}$")


class AccountSummaryOut(BaseModel):
    active_patients: int
    new_patients_this_month: int
    total_appointments: int


class ProfileOut(BaseModel):
    id: UUID
    full_name: str
    email: str | None
    role: UserRole
    phone: str | None
    crn: str | None
    crn_state: str | None
    specialty: str | None
    bio: str | None
    avatar_url: str | None
    member_since: datetime
    active: bool
    has_professional_fields: bool
    crn_state_options: list[str]
    account_summary: AccountSummaryOut | None


def _blank_to_none(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value or None


class ProfileUpdate(BaseModel):
    """PATCH parcial: só os campos enviados mudam. Campos desconhecidos são rejeitados
    (ex.: role, clinic_id, user_id, active nunca podem ser alterados por aqui)."""

    model_config = ConfigDict(extra="forbid")

    full_name: str | None = Field(default=None)
    phone: str | None = Field(default=None)
    crn: str | None = Field(default=None)
    crn_state: str | None = Field(default=None)
    bio: str | None = Field(default=None)

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: str | None) -> str:
        if value is None:
            raise ValueError("Informe o nome completo.")
        value = " ".join(value.split())
        if not 2 <= len(value) <= 120:
            raise ValueError("O nome deve ter entre 2 e 120 caracteres.")
        return value

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str | None) -> str | None:
        value = _blank_to_none(value)
        if value is None:
            return None
        digits = re.sub(r"\D", "", value)
        if len(digits) not in (10, 11) or digits[0] == "0":
            raise ValueError("Telefone inválido. Use DDD + número.")
        if len(digits) == 11:
            if digits[2] != "9":
                raise ValueError("Celular inválido: o número deve começar com 9.")
            return f"({digits[:2]}) {digits[2:7]}-{digits[7:]}"
        return f"({digits[:2]}) {digits[2:6]}-{digits[6:]}"

    @field_validator("crn")
    @classmethod
    def validate_crn(cls, value: str | None) -> str | None:
        value = _blank_to_none(value)
        if value is None:
            return None
        value = " ".join(value.upper().split())
        if not _CRN_PATTERN.match(value):
            raise ValueError("CRN inválido. Use o formato CRN-3 48291.")
        return value

    @field_validator("crn_state")
    @classmethod
    def validate_crn_state(cls, value: str | None) -> str | None:
        value = _blank_to_none(value)
        if value is None:
            return None
        if value not in CRN_STATE_OPTIONS:
            raise ValueError("Estado do conselho inválido.")
        return value

    @field_validator("bio")
    @classmethod
    def validate_bio(cls, value: str | None) -> str | None:
        value = _blank_to_none(value)
        if value is not None and len(value) > MAX_BIO_LENGTH:
            raise ValueError(f"A apresentação deve ter no máximo {MAX_BIO_LENGTH} caracteres.")
        return value
