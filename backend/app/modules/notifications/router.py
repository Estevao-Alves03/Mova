from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status

from app.core.deps import DbSession, require_roles
from app.modules.auth.models import Membership, UserRole
from app.modules.notifications import service
from app.modules.notifications.schemas import NotificationListOut

# Cada pessoa só lê e marca os PRÓPRIOS avisos (o membership vem do token; não há id de usuário na rota).
# O paciente não tem sino: o portal está fora de escopo.
Staff = Annotated[Membership, Depends(require_roles(UserRole.admin, UserRole.receptionist, UserRole.nutritionist))]

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=NotificationListOut)
def list_notifications(
    actor: Staff, db: DbSession, limit: Annotated[int, Query(ge=1, le=service.MAX_ITEMS)] = 30
) -> NotificationListOut:
    return service.list_notifications(db, actor, limit)


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
def read_all(actor: Staff, db: DbSession) -> Response:
    service.mark_all_read(db, actor)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def read_one(notification_id: UUID, actor: Staff, db: DbSession) -> Response:
    service.mark_read(db, actor, notification_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
