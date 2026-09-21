from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class NotificationOut(BaseModel):
    id: UUID
    event: str
    # appointment_cancelled: 'cancelled' ou 'rescheduled'
    kind: Literal["created", "cancelled", "rescheduled"] | None
    title: str
    body: str
    appointment_id: UUID | None
    # Dia (fuso da clínica) que a agenda abre ao clicar.
    target_date: date | None
    read: bool
    created_at: datetime


class NotificationListOut(BaseModel):
    unread_count: int
    items: list[NotificationOut]
