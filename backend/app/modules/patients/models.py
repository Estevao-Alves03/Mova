import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PatientSex(str, enum.Enum):
    female = "female"
    male = "male"


class Patient(Base):
    """Espelho de `patients` (dados cadastrais; os clínicos ficam em tabelas próprias)."""

    __tablename__ = "patients"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    clinic_id: Mapped[uuid.UUID]
    nutritionist_id: Mapped[uuid.UUID | None]
    full_name: Mapped[str]
    email: Mapped[str | None] = mapped_column(Text)
    phone: Mapped[str | None] = mapped_column(Text)
    birth_date: Mapped[date | None] = mapped_column(Date)
    sex: Mapped[PatientSex | None] = mapped_column(
        Enum(PatientSex, name="patient_sex", create_type=False, values_callable=lambda e: [m.value for m in e])
    )
    created_by: Mapped[uuid.UUID | None]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
