import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class NotificationPreference(Base):
    """Preferências de notificação de um usuário (uma linha por membership)."""

    __tablename__ = "notification_preferences"

    membership_id: Mapped[uuid.UUID] = mapped_column(primary_key=True)
    clinic_id: Mapped[uuid.UUID]
    preferences: Mapped[dict[str, Any]] = mapped_column(JSONB)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
