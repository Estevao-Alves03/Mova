"""Unidades e consultórios (só admin). Nada é excluído: desativar preserva o histórico da agenda."""

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import exists, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import field_error
from app.modules.auth.models import Membership, UserRole
from app.modules.schedule.models import ACTIVE_STATUSES, Appointment, ProfessionalAvailability, Room, Unit, UnitMember
from app.modules.settings.unit_schemas import (
    MemberLink,
    MemberLinkCreate,
    RoomCreate,
    RoomOut,
    RoomUpdate,
    UnitCreate,
    UnitOut,
    UnitUpdate,
)


def _out(unit: Unit, rooms: list[Room], members: list[MemberLink]) -> UnitOut:
    return UnitOut(
        id=unit.id,
        name=unit.name,
        address=unit.address,
        phone=unit.phone,
        email=unit.email,
        active=unit.active,
        rooms=[RoomOut(id=r.id, name=r.name, active=r.active) for r in sorted(rooms, key=lambda r: r.name.lower())],
        members=sorted(members, key=lambda m: m.full_name.lower()),
    )


def _rooms_of(db: Session, unit_id: UUID) -> list[Room]:
    return list(db.scalars(select(Room).where(Room.unit_id == unit_id)))


def _members_of(db: Session, unit_id: UUID) -> list[MemberLink]:
    rows = db.execute(
        select(Membership.id, Membership.full_name, Membership.active)
        .join(UnitMember, UnitMember.membership_id == Membership.id)
        .where(UnitMember.unit_id == unit_id)
    )
    return [MemberLink(id=row.id, full_name=row.full_name, active=row.active) for row in rows]


def _full(db: Session, unit: Unit) -> UnitOut:
    return _out(unit, _rooms_of(db, unit.id), _members_of(db, unit.id))


def list_units(db: Session, actor: Membership) -> list[UnitOut]:
    units = list(db.scalars(select(Unit).where(Unit.clinic_id == actor.clinic_id).order_by(Unit.name)))
    rooms = list(db.scalars(select(Room).where(Room.clinic_id == actor.clinic_id)))
    links = db.execute(
        select(UnitMember.unit_id, Membership.id, Membership.full_name, Membership.active)
        .join(Membership, Membership.id == UnitMember.membership_id)
        .where(UnitMember.clinic_id == actor.clinic_id)
    ).all()
    return [
        _out(
            unit,
            [room for room in rooms if room.unit_id == unit.id],
            [MemberLink(id=link.id, full_name=link.full_name, active=link.active) for link in links if link.unit_id == unit.id],
        )
        for unit in units
    ]


def _load_unit(db: Session, actor: Membership, unit_id: UUID) -> Unit:
    unit = db.scalars(select(Unit).where(Unit.id == unit_id, Unit.clinic_id == actor.clinic_id)).first()
    if unit is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Unidade não encontrada.")
    return unit


def _commit_unique(db: Session, field: str, message: str) -> None:
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        if getattr(error.orig, "sqlstate", None) == "23505":
            raise field_error(409, field, message) from error
        raise


def create_unit(db: Session, actor: Membership, payload: UnitCreate) -> UnitOut:
    unit = Unit(clinic_id=actor.clinic_id, **payload.model_dump())
    db.add(unit)
    _commit_unique(db, "name", "Já existe uma unidade com este nome.")
    return _out(unit, [], [])


def update_unit(db: Session, actor: Membership, unit_id: UUID, payload: UnitUpdate) -> UnitOut:
    unit = _load_unit(db, actor, unit_id)
    changes = payload.model_dump(exclude_unset=True)
    if changes.get("active") is False and unit.active:
        # Profissionais atendem nas unidades da agenda deles; desativar uma em uso quebraria essas agendas.
        if db.scalar(select(exists().where(ProfessionalAvailability.unit_id == unit.id))):
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail="Há profissionais com atendimento nesta unidade. Ajuste a agenda deles antes de desativá-la.",
            )
        if db.scalar(
            select(exists().where(
                Appointment.unit_id == unit.id,
                Appointment.status.in_(ACTIVE_STATUSES),
                Appointment.starts_at > datetime.now(timezone.utc),
            ))
        ):
            raise HTTPException(
                status.HTTP_409_CONFLICT, detail="Há consultas futuras nesta unidade. Remarque-as antes de desativá-la."
            )
    for field, value in changes.items():
        setattr(unit, field, value)
    _commit_unique(db, "name", "Já existe uma unidade com este nome.")
    return _full(db, unit)


def create_room(db: Session, actor: Membership, unit_id: UUID, payload: RoomCreate) -> UnitOut:
    unit = _load_unit(db, actor, unit_id)
    if not unit.active:
        raise field_error(422, "name", "Reative a unidade antes de adicionar salas.")
    db.add(Room(clinic_id=actor.clinic_id, unit_id=unit.id, name=payload.name))
    _commit_unique(db, "name", "Já existe uma sala com este nome nesta unidade.")
    return _full(db, unit)


def update_room(db: Session, actor: Membership, unit_id: UUID, room_id: UUID, payload: RoomUpdate) -> UnitOut:
    unit = _load_unit(db, actor, unit_id)
    room = db.scalars(select(Room).where(Room.id == room_id, Room.unit_id == unit.id)).first()
    if room is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Sala não encontrada.")
    changes = payload.model_dump(exclude_unset=True)
    if changes.get("active") is False and room.active and db.scalar(
        select(exists().where(
            Appointment.room_id == room.id,
            Appointment.status.in_(ACTIVE_STATUSES),
            Appointment.starts_at > datetime.now(timezone.utc),
        ))
    ):
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail="Há consultas futuras nesta sala. Remarque-as antes de desativá-la."
        )
    if changes.get("active") and not unit.active:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Reative a unidade antes de reativar a sala.")
    for field, value in changes.items():
        setattr(room, field, value)
    _commit_unique(db, "name", "Já existe uma sala com este nome nesta unidade.")
    return _full(db, unit)


# ------------------------------------------------------------------ vínculo de nutricionistas

def add_member(db: Session, actor: Membership, unit_id: UUID, payload: MemberLinkCreate) -> UnitOut:
    unit = _load_unit(db, actor, unit_id)
    if not unit.active:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Reative a unidade antes de vincular nutricionistas.")
    member = db.scalars(
        select(Membership).where(
            Membership.id == payload.membership_id,
            Membership.clinic_id == actor.clinic_id,
            Membership.role == UserRole.nutritionist,
            Membership.active.is_(True),
        )
    ).first()
    if member is None:
        raise field_error(422, "membership_id", "Só é possível vincular nutricionistas ativos da clínica.")
    if db.get(UnitMember, (unit.id, member.id)) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Este nutricionista já está vinculado à unidade.")
    db.add(UnitMember(unit_id=unit.id, membership_id=member.id, clinic_id=actor.clinic_id))
    db.commit()
    return _full(db, unit)


def remove_member(db: Session, actor: Membership, unit_id: UUID, membership_id: UUID) -> UnitOut:
    unit = _load_unit(db, actor, unit_id)
    link = db.get(UnitMember, (unit.id, membership_id))
    if link is None or link.clinic_id != actor.clinic_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Vínculo não encontrado.")
    # Desvincular quem ainda atende aqui deixaria a agenda dele apontando para uma unidade a que ele não pertence.
    if db.scalar(
        select(exists().where(ProfessionalAvailability.unit_id == unit.id, ProfessionalAvailability.professional_id == membership_id))
    ):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Este nutricionista atende nesta unidade (agenda). Ele precisa ajustar os dias de atendimento antes de ser desvinculado.",
        )
    if db.scalar(
        select(exists().where(
            Appointment.unit_id == unit.id,
            Appointment.professional_id == membership_id,
            Appointment.status.in_(ACTIVE_STATUSES),
            Appointment.starts_at > datetime.now(timezone.utc),
        ))
    ):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Há consultas futuras deste nutricionista nesta unidade. Remarque-as antes de desvinculá-lo.",
        )
    db.delete(link)
    db.commit()
    return _full(db, unit)
