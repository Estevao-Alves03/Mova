from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.core.deps import DbSession, require_roles
from app.modules.auth.models import Membership, UserRole
from app.modules.settings import unit_service as service
from app.modules.settings.unit_schemas import MemberLinkCreate, RoomCreate, RoomUpdate, UnitCreate, UnitOut, UnitUpdate

# Cadastro de unidades e consultórios: só o admin, sempre na própria clínica.
# (A agenda lê as unidades ativas por `GET /schedule/units`.)
Admin = Annotated[Membership, Depends(require_roles(UserRole.admin))]

router = APIRouter(prefix="/units", tags=["units"])


@router.get("", response_model=list[UnitOut])
def list_units(actor: Admin, db: DbSession) -> list[UnitOut]:
    return service.list_units(db, actor)


@router.post("", response_model=UnitOut, status_code=status.HTTP_201_CREATED)
def create_unit(payload: UnitCreate, actor: Admin, db: DbSession) -> UnitOut:
    return service.create_unit(db, actor, payload)


@router.patch("/{unit_id}", response_model=UnitOut)
def update_unit(unit_id: UUID, payload: UnitUpdate, actor: Admin, db: DbSession) -> UnitOut:
    return service.update_unit(db, actor, unit_id, payload)


@router.post("/{unit_id}/rooms", response_model=UnitOut, status_code=status.HTTP_201_CREATED)
def create_room(unit_id: UUID, payload: RoomCreate, actor: Admin, db: DbSession) -> UnitOut:
    return service.create_room(db, actor, unit_id, payload)


@router.patch("/{unit_id}/rooms/{room_id}", response_model=UnitOut)
def update_room(unit_id: UUID, room_id: UUID, payload: RoomUpdate, actor: Admin, db: DbSession) -> UnitOut:
    return service.update_room(db, actor, unit_id, room_id, payload)


@router.post("/{unit_id}/members", response_model=UnitOut, status_code=status.HTTP_201_CREATED)
def add_member(unit_id: UUID, payload: MemberLinkCreate, actor: Admin, db: DbSession) -> UnitOut:
    return service.add_member(db, actor, unit_id, payload)


@router.delete("/{unit_id}/members/{membership_id}", response_model=UnitOut)
def remove_member(unit_id: UUID, membership_id: UUID, actor: Admin, db: DbSession) -> UnitOut:
    return service.remove_member(db, actor, unit_id, membership_id)
