from datetime import date
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, StringConstraints, model_validator

from app.modules.schedule.models import AppointmentStatus, AppointmentType, CancellationSource

HourMinute = Annotated[str, StringConstraints(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")]
Minutes = Annotated[int, Field(ge=15, le=240, multiple_of=15)]


def _to_minutes(value: str) -> int:
    hours, minutes = value.split(":")
    return int(hours) * 60 + int(minutes)


# ------------------------------------------------------------------ configuração

class DayConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    weekday: int = Field(ge=0, le=6)  # 0 = domingo
    start: HourMinute
    end: HourMinute
    unit_id: UUID

    @model_validator(mode="after")
    def end_after_start(self) -> "DayConfig":
        if _to_minutes(self.end) <= _to_minutes(self.start):
            raise ValueError("O fim do atendimento deve ser depois do início.")
        return self


class LunchConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    start: HourMinute
    end: HourMinute

    @model_validator(mode="after")
    def end_after_start(self) -> "LunchConfig":
        if _to_minutes(self.end) <= _to_minutes(self.start):
            raise ValueError("O fim do almoço deve ser depois do início.")
        return self


class ScheduleConfigIn(BaseModel):
    """Substitui a configuração inteira do profissional (não mexe em consultas)."""

    model_config = ConfigDict(extra="forbid")

    start_step_minutes: Literal[15, 30, 60]
    lunch: LunchConfig | None = None
    durations: dict[AppointmentType, Minutes]
    days: list[DayConfig] = Field(max_length=7)

    @model_validator(mode="after")
    def unique_weekdays(self) -> "ScheduleConfigIn":
        weekdays = [day.weekday for day in self.days]
        if len(weekdays) != len(set(weekdays)):
            raise ValueError("Informe uma única faixa por dia da semana.")
        return self


class ScheduleConfigOut(BaseModel):
    professional_id: UUID
    start_step_minutes: int
    lunch: LunchConfig | None
    durations: dict[AppointmentType, int]
    days: list[DayConfig]
    configured: bool


class AffectedAppointment(BaseModel):
    """Consulta futura que ficou fora da disponibilidade. Só informativo: nada é alterado."""

    appointment_id: UUID
    patient_name: str
    appointment_type: AppointmentType
    starts_at: AwareDatetime
    ends_at: AwareDatetime
    reason: str


class ScheduleConfigSaveOut(BaseModel):
    config: ScheduleConfigOut
    affected_appointments: list[AffectedAppointment]


class RoomOut(BaseModel):
    id: UUID
    name: str


class UnitOut(BaseModel):
    """Unidade ativa com suas salas ativas (para escolher onde agendar)."""

    id: UUID
    name: str
    address: str | None
    rooms: list[RoomOut]


class ProfessionalOut(BaseModel):
    id: UUID
    full_name: str
    crn: str | None
    specialty: str | None


# ------------------------------------------------------------------ bloqueios

class BlockCreate(BaseModel):
    """`day_off`: um ou mais dias inteiros. `time_block`: intervalo de horário num dia."""

    model_config = ConfigDict(extra="forbid")

    kind: Literal["day_off", "time_block"]
    date: date
    end_date: date | None = None
    start_time: HourMinute | None = None
    end_time: HourMinute | None = None
    reason: Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)] | None = None

    @model_validator(mode="after")
    def coherent(self) -> "BlockCreate":
        if self.kind == "day_off":
            if self.start_time or self.end_time:
                raise ValueError("Folga de dia inteiro não tem horário.")
            if self.end_date and self.end_date < self.date:
                raise ValueError("A data final deve ser igual ou depois da inicial.")
        else:
            if self.end_date:
                raise ValueError("Bloqueio de horário acontece em um único dia.")
            if not self.start_time or not self.end_time:
                raise ValueError("Informe o horário inicial e o final.")
            if _to_minutes(self.end_time) <= _to_minutes(self.start_time):
                raise ValueError("O horário final deve ser depois do inicial.")
        return self


class BlockOut(BaseModel):
    """Visão do dono (e do admin): inclui a nota pessoal."""

    id: UUID
    kind: Literal["day_off", "time_block", "cancellation_hold"]
    starts_at: AwareDatetime
    ends_at: AwareDatetime
    reason: str | None
    source_appointment_id: UUID | None


class UnavailablePeriodOut(BaseModel):
    """Visão de quem só usa a agenda (recepção): sem motivo, sem tipo, sem origem."""

    starts_at: AwareDatetime
    ends_at: AwareDatetime
    label: Literal["Indisponível"] = "Indisponível"


# ------------------------------------------------------------------ horários e consultas

class SlotOut(BaseModel):
    starts_at: AwareDatetime
    ends_at: AwareDatetime
    unit_id: UUID


class AvailabilityOut(BaseModel):
    professional_id: UUID
    appointment_type: AppointmentType
    duration_minutes: int | None
    configured: bool
    slots: list[SlotOut]


class AppointmentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    patient_id: UUID
    professional_id: UUID
    appointment_type: AppointmentType
    starts_at: AwareDatetime
    room_id: UUID | None = None


class AppointmentReschedule(BaseModel):
    model_config = ConfigDict(extra="forbid")

    starts_at: AwareDatetime


class AppointmentCancel(BaseModel):
    """Sem texto de justificativa: os motivos e a obrigatoriedade ainda não foram definidos."""

    model_config = ConfigDict(extra="forbid")

    source: CancellationSource
    keep_slot_unavailable: bool = False


class AppointmentOut(BaseModel):
    id: UUID
    patient_id: UUID
    professional_id: UUID
    unit_id: UUID
    room_id: UUID | None
    appointment_type: AppointmentType
    starts_at: AwareDatetime
    ends_at: AwareDatetime
    status: AppointmentStatus
    cancellation_source: CancellationSource | None


class AgendaAppointmentOut(BaseModel):
    """Consulta na agenda: só o que a agenda mostra (nada clínico: sem objetivo nem observações)."""

    id: UUID
    patient_id: UUID
    patient_name: str
    professional_id: UUID
    unit_id: UUID
    room_id: UUID | None
    appointment_type: AppointmentType
    starts_at: AwareDatetime
    ends_at: AwareDatetime
    status: AppointmentStatus
