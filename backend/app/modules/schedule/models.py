import enum
import uuid
from datetime import datetime, time

from sqlalchemy import Boolean, DateTime, Enum, SmallInteger, String, Text, Time, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _pg_enum(enum_class: type[enum.Enum], name: str) -> Enum:
    return Enum(enum_class, name=name, create_type=False, values_callable=lambda e: [m.value for m in e])


class AppointmentStatus(str, enum.Enum):
    scheduled = "scheduled"
    confirmed = "confirmed"
    completed = "completed"
    cancelled = "cancelled"
    no_show = "no_show"


class AppointmentType(str, enum.Enum):
    first_consultation = "first_consultation"
    return_consultation = "return_consultation"
    assessment = "assessment"


class BlockKind(str, enum.Enum):
    day_off = "day_off"
    time_block = "time_block"
    cancellation_hold = "cancellation_hold"


class CancellationSource(str, enum.Enum):
    client = "client"
    internal = "internal"


# Consultas que ocupam a agenda e precisam caber na disponibilidade.
ACTIVE_STATUSES = (AppointmentStatus.scheduled, AppointmentStatus.confirmed)


class Clinic(Base):
    __tablename__ = "clinics"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True)
    timezone: Mapped[str] = mapped_column(Text)


class Unit(Base):
    __tablename__ = "units"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    clinic_id: Mapped[uuid.UUID]
    name: Mapped[str] = mapped_column(Text)
    address: Mapped[str | None] = mapped_column(Text)
    phone: Mapped[str | None] = mapped_column(Text)
    email: Mapped[str | None] = mapped_column(Text)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class UnitMember(Base):
    """Nutricionista vinculado a uma unidade pelo admin (define onde ele pode atender)."""

    __tablename__ = "unit_members"

    unit_id: Mapped[uuid.UUID] = mapped_column(primary_key=True)
    membership_id: Mapped[uuid.UUID] = mapped_column(primary_key=True)
    clinic_id: Mapped[uuid.UUID]


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    clinic_id: Mapped[uuid.UUID]
    unit_id: Mapped[uuid.UUID]
    name: Mapped[str] = mapped_column(Text)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class ConsultationGoal(str, enum.Enum):
    weight_loss = "weight_loss"
    muscle_gain = "muscle_gain"
    healthy_eating = "healthy_eating"
    clinical = "clinical"
    sports = "sports"
    other = "other"


class Appointment(Base):
    __tablename__ = "appointments"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    clinic_id: Mapped[uuid.UUID]
    patient_id: Mapped[uuid.UUID]
    professional_id: Mapped[uuid.UUID]
    unit_id: Mapped[uuid.UUID]
    room_id: Mapped[uuid.UUID | None]
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[AppointmentStatus] = mapped_column(_pg_enum(AppointmentStatus, "appointment_status"))
    appointment_type: Mapped[AppointmentType] = mapped_column(_pg_enum(AppointmentType, "appointment_type"))
    # Informados no cadastro do paciente (dado clínico: nunca devolvido à recepção).
    goal: Mapped[ConsultationGoal | None] = mapped_column(_pg_enum(ConsultationGoal, "consultation_goal"))
    initial_notes: Mapped[str | None] = mapped_column(Text)
    cancellation_source: Mapped[CancellationSource | None] = mapped_column(
        _pg_enum(CancellationSource, "cancellation_source")
    )
    created_by: Mapped[uuid.UUID | None]


class ProfessionalAvailability(Base):
    """Faixa de atendimento de um dia da semana (0 = domingo)."""

    __tablename__ = "professional_availability"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    clinic_id: Mapped[uuid.UUID]
    professional_id: Mapped[uuid.UUID]
    unit_id: Mapped[uuid.UUID]
    weekday: Mapped[int] = mapped_column(SmallInteger)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)


class ProfessionalScheduleSettings(Base):
    __tablename__ = "professional_schedule_settings"

    professional_id: Mapped[uuid.UUID] = mapped_column(primary_key=True)
    clinic_id: Mapped[uuid.UUID]
    start_step_minutes: Mapped[int] = mapped_column(SmallInteger)
    lunch_start: Mapped[time | None] = mapped_column(Time)
    lunch_end: Mapped[time | None] = mapped_column(Time)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ProfessionalAppointmentDuration(Base):
    __tablename__ = "professional_appointment_durations"

    professional_id: Mapped[uuid.UUID] = mapped_column(primary_key=True)
    appointment_type: Mapped[AppointmentType] = mapped_column(
        _pg_enum(AppointmentType, "appointment_type"), primary_key=True
    )
    minutes: Mapped[int] = mapped_column(SmallInteger)


class ProfessionalBlock(Base):
    """Folga ou bloqueio. `reason` é nota pessoal: nunca sai para a recepção."""

    __tablename__ = "professional_blocks"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    clinic_id: Mapped[uuid.UUID]
    professional_id: Mapped[uuid.UUID]
    kind: Mapped[BlockKind] = mapped_column(_pg_enum(BlockKind, "block_kind"))
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    reason: Mapped[str | None] = mapped_column(String)
    source_appointment_id: Mapped[uuid.UUID | None]
    created_by: Mapped[uuid.UUID | None]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
