from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class SessionOut(BaseModel):
    id: UUID
    device: str
    client: str
    kind: Literal["laptop", "phone", "desktop"]
    ip: str | None
    created_at: datetime
    last_active_at: datetime
    current: bool
