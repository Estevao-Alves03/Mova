from uuid import UUID

from fastapi import APIRouter, Response, status

from app.core.deps import CurrentMembership, CurrentUser, DbSession
from app.modules.auth import service
from app.modules.auth.schemas import SessionOut

router = APIRouter(prefix="/auth/sessions", tags=["auth"])


@router.get("", response_model=list[SessionOut])
def list_sessions(user: CurrentUser, _: CurrentMembership, db: DbSession) -> list[SessionOut]:
    return service.list_sessions(db, user)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def revoke_other_sessions(user: CurrentUser, _: CurrentMembership, db: DbSession) -> Response:
    """Encerra todas as sessões do usuário, exceto a atual."""
    service.revoke_other_sessions(db, user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_session(
    session_id: UUID, user: CurrentUser, _: CurrentMembership, db: DbSession
) -> Response:
    service.revoke_session(db, user, session_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
