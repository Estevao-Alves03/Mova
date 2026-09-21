from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.core.deps import DbSession, require_roles
from app.modules.auth.models import Membership, UserRole
from app.modules.settings import team_service as service
from app.modules.settings.auth_admin import AuthAdmin, get_auth_admin
from app.modules.settings.team_schemas import MemberCreate, MemberCreated, MemberOut, MemberUpdate

# Equipe e acesso: só o admin, sempre na própria clínica (o membership vem do token).
Admin = Annotated[Membership, Depends(require_roles(UserRole.admin))]

router = APIRouter(prefix="/team", tags=["team"])


@router.get("", response_model=list[MemberOut])
def list_members(actor: Admin, db: DbSession) -> list[MemberOut]:
    return service.list_members(db, actor)


@router.post("", response_model=MemberCreated, status_code=status.HTTP_201_CREATED)
def create_member(
    payload: MemberCreate, actor: Admin, db: DbSession, auth_admin: Annotated[AuthAdmin, Depends(get_auth_admin)]
) -> MemberCreated:
    return service.create_member(db, actor, auth_admin, payload)


@router.patch("/{member_id}", response_model=MemberOut)
def update_member(member_id: UUID, payload: MemberUpdate, actor: Admin, db: DbSession) -> MemberOut:
    return service.update_member(db, actor, member_id, payload)
