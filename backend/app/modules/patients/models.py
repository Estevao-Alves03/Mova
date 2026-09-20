import uuid
from datetime import datetime

from sqlalchemy import DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Patient(Base):
    """Espelho parcial de `patients` (só o necessário até o módulo de pacientes)."""

    __tablename__ = "patients"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True)
    clinic_id: Mapped[uuid.UUID]
    nutritionist_id: Mapped[uuid.UUID | None]
    full_name: Mapped[str]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
