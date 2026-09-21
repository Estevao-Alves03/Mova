import re
from datetime import date, datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, StringConstraints, field_validator

from app.core.validators import normalize_phone
from app.modules.schedule.models import ConsultationGoal
from app.modules.schedule.schemas import AppointmentOut

MAX_NOTES_LENGTH = 300
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _blank_to_none(value):
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


class FirstAppointmentIn(BaseModel):
    """Primeira consulta agendada junto com o cadastro (tipo sempre `first_consultation`)."""

    model_config = ConfigDict(extra="forbid")

    starts_at: AwareDatetime
    room_id: UUID | None = None
    goal: ConsultationGoal
    notes: Annotated[str, StringConstraints(strip_whitespace=True, max_length=MAX_NOTES_LENGTH)] | None = None

    @field_validator("notes", mode="before")
    @classmethod
    def blank_notes(cls, value):
        return _blank_to_none(value)


class PatientCreate(BaseModel):
    """Cadastro básico + primeira consulta. O nutricionista responsável é obrigatório (docs/permissoes.md)."""

    model_config = ConfigDict(extra="forbid")

    full_name: str
    birth_date: date | None = None
    # Vazio = "Outro / Prefiro não informar" (a avaliação corporal exigirá o sexo depois).
    sex: Literal["female", "male"] | None = None
    phone: str
    email: str | None = None
    nutritionist_id: UUID
    first_appointment: FirstAppointmentIn

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: str) -> str:
        value = " ".join(value.split())
        if not 2 <= len(value) <= 120:
            raise ValueError("O nome deve ter entre 2 e 120 caracteres.")
        return value

    @field_validator("birth_date")
    @classmethod
    def validate_birth_date(cls, value: date | None) -> date | None:
        if value is not None and not (date(1900, 1, 1) <= value <= date.today()):
            raise ValueError("Data de nascimento inválida.")
        return value

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str) -> str:
        return normalize_phone(value.strip())

    @field_validator("email", mode="before")
    @classmethod
    def blank_email(cls, value):
        return _blank_to_none(value)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if len(value) > 254 or not _EMAIL.match(value):
            raise ValueError("E-mail inválido.")
        return value.lower()


class PatientOut(BaseModel):
    """Só o cadastro básico: nada clínico (o objetivo e a observação ficam com a consulta)."""

    id: UUID
    full_name: str
    birth_date: date | None
    sex: Literal["female", "male"] | None
    phone: str | None
    email: str | None
    nutritionist_id: UUID | None
    created_at: datetime


class PatientCreated(BaseModel):
    patient: PatientOut
    appointment: AppointmentOut


# ------------------------------------------------------------------ lista

PatientSituation = Literal["first_visit", "following", "alert"]


class PatientListBasic(BaseModel):
    """Lista para a recepção: só cadastro e agenda, nenhum dado clínico (nem a chave `goal`)."""

    id: UUID
    full_name: str
    birth_date: date | None
    sex: Literal["female", "male"] | None
    phone: str | None
    email: str | None
    nutritionist_id: UUID | None
    created_at: datetime
    # Derivada do histórico: first_visit (sem consulta concluída), following, alert (>45 dias sem retorno agendado).
    situation: PatientSituation
    last_consultation_at: datetime | None
    next_appointment_at: datetime | None


class PatientListClinical(PatientListBasic):
    """Admin e nutricionista: acrescenta o objetivo informado na 1ª consulta."""

    goal: ConsultationGoal | None


class PatientSearchItem(BaseModel):
    """Resultado da busca principal: só identificação e contato (o mesmo para todos os papéis, nada clínico)."""

    id: UUID
    full_name: str
    birth_date: date | None
    sex: Literal["female", "male"] | None
    phone: str | None
    email: str | None
