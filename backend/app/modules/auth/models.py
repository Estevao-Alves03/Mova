import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class UserRole(str, enum.Enum):
    admin = "admin"
    nutritionist = "nutritionist"
    receptionist = "receptionist"
    patient = "patient"


class Membership(Base):
    """Papel do usuário na clínica. Fonte da verdade dos papéis."""

    __tablename__ = "memberships"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True)
    clinic_id: Mapped[uuid.UUID]
    user_id: Mapped[uuid.UUID]
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role", create_type=False, values_callable=lambda e: [m.value for m in e])
    )
    full_name: Mapped[str] = mapped_column(Text)
    active: Mapped[bool] = mapped_column(Boolean)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    phone: Mapped[str | None] = mapped_column(String)
    crn: Mapped[str | None] = mapped_column(String)
    crn_state: Mapped[str | None] = mapped_column(String)
    specialty: Mapped[str | None] = mapped_column(String)
    bio: Mapped[str | None] = mapped_column(Text)
    avatar_path: Mapped[str | None] = mapped_column(Text)
