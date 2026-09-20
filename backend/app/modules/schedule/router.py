from datetime import date, datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import select

from app.core.deps import DbSession, require_roles
from app.modules.auth.models import Membership, UserRole
from app.modules.schedule import service
from app.modules.schedule.models import AppointmentType, Unit
from app.modules.schedule.schemas import (
    AffectedAppointment,
    AppointmentCancel,
    AppointmentCreate,
    AppointmentOut,
    AppointmentReschedule,
    AvailabilityOut,
    BlockCreate,
    BlockOut,
    ProfessionalOut,
    ScheduleConfigIn,
    ScheduleConfigOut,
    ScheduleConfigSaveOut,
    UnavailablePeriodOut,
    UnitOut,
)

router = APIRouter(prefix="/schedule", tags=["schedule"])

# Quem pode o quê (docs/permissoes.md). A separação acontece na dependência da rota:
# a recepção NUNCA chega a uma rota de escrita de disponibilidade.
Readers = Annotated[Membership, Depends(require_roles(UserRole.admin, UserRole.nutritionist, UserRole.receptionist))]
Editors = Annotated[Membership, Depends(require_roles(UserRole.admin, UserRole.nutritionist))]
Bookers = Annotated[Membership, Depends(require_roles(UserRole.admin, UserRole.receptionist))]


# ------------------------------------------------------------------ apoio

@router.get("/units", response_model=list[UnitOut])
def list_units(actor: Readers, db: DbSession) -> list[UnitOut]:
    rows = db.scalars(
        select(Unit).where(Unit.clinic_id == actor.clinic_id, Unit.active.is_(True)).order_by(Unit.name)
    )
    return [UnitOut(id=unit.id, name=unit.name) for unit in rows]


@router.get("/professionals", response_model=list[ProfessionalOut])
def list_professionals(actor: Readers, db: DbSession) -> list[ProfessionalOut]:
    """Nutricionistas da clínica; o nutricionista só enxerga a si mesmo."""
    query = select(Membership).where(
        Membership.clinic_id == actor.clinic_id, Membership.role == UserRole.nutritionist, Membership.active.is_(True)
    )
    if actor.role == UserRole.nutritionist:
        query = query.where(Membership.id == actor.id)
    return [ProfessionalOut(id=m.id, full_name=m.full_name) for m in db.scalars(query.order_by(Membership.full_name))]


# ------------------------------------------------------------------ configuração (dono e admin escrevem)

@router.get("/professionals/{professional_id}/config", response_model=ScheduleConfigOut)
def read_config(professional_id: UUID, actor: Readers, db: DbSession) -> ScheduleConfigOut:
    return service.get_config(db, service.resolve_professional(db, actor, professional_id))


@router.put("/professionals/{professional_id}/config", response_model=ScheduleConfigSaveOut)
def save_config(
    professional_id: UUID, payload: ScheduleConfigIn, actor: Editors, db: DbSession
) -> ScheduleConfigSaveOut:
    return service.save_config(db, service.resolve_professional(db, actor, professional_id), payload)


@router.get("/professionals/{professional_id}/blocks", response_model=list[BlockOut])
def read_blocks(
    professional_id: UUID, actor: Editors, db: DbSession, from_: Annotated[date | None, Query(alias="from")] = None
) -> list[BlockOut]:
    """Com o motivo pessoal: só o dono e o admin (a recepção usa /unavailable-periods)."""
    professional = service.resolve_professional(db, actor, professional_id)
    start = service.local_to_utc(service.clinic_timezone(db, actor.clinic_id), from_) if from_ else datetime.now(timezone.utc)
    return [
        BlockOut(
            id=b.id, kind=b.kind.value, starts_at=b.starts_at, ends_at=b.ends_at, reason=b.reason,
            source_appointment_id=b.source_appointment_id,
        )
        for b in service.list_blocks(db, professional, start, None)
    ]


@router.post("/professionals/{professional_id}/blocks", response_model=BlockOut, status_code=status.HTTP_201_CREATED)
def create_block(professional_id: UUID, payload: BlockCreate, actor: Editors, db: DbSession) -> BlockOut:
    block = service.create_block(db, actor, service.resolve_professional(db, actor, professional_id), payload)
    return BlockOut(
        id=block.id, kind=block.kind.value, starts_at=block.starts_at, ends_at=block.ends_at, reason=block.reason,
        source_appointment_id=None,
    )


@router.delete("/professionals/{professional_id}/blocks/{block_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_block(professional_id: UUID, block_id: UUID, actor: Editors, db: DbSession) -> Response:
    service.delete_block(db, service.resolve_professional(db, actor, professional_id), block_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ------------------------------------------------------------------ leitura para quem agenda

@router.get("/professionals/{professional_id}/unavailable-periods", response_model=list[UnavailablePeriodOut])
def unavailable_periods(
    professional_id: UUID,
    actor: Readers,
    db: DbSession,
    from_: Annotated[date, Query(alias="from")],
    to: date,
) -> list[UnavailablePeriodOut]:
    """Períodos bloqueados SEM motivo, tipo ou origem: seguro para a recepção."""
    professional = service.resolve_professional(db, actor, professional_id)
    _, start, end = service.range_bounds(db, professional, from_, to)
    return [UnavailablePeriodOut(starts_at=b.starts_at, ends_at=b.ends_at) for b in service.list_blocks(db, professional, start, end)]


@router.get("/availability", response_model=AvailabilityOut)
def availability(
    professional_id: UUID,
    appointment_type: AppointmentType,
    from_: Annotated[date, Query(alias="from")],
    to: date,
    actor: Readers,
    db: DbSession,
) -> AvailabilityOut:
    professional = service.resolve_professional(db, actor, professional_id)
    return service.get_availability(db, professional, appointment_type, from_, to)


@router.get("/professionals/{professional_id}/outside-availability", response_model=list[AffectedAppointment])
def outside_availability(professional_id: UUID, actor: Readers, db: DbSession) -> list[AffectedAppointment]:
    """Consultas futuras que ficaram fora da disponibilidade (calculado na hora; nada é alterado)."""
    return service.outside_availability(db, service.resolve_professional(db, actor, professional_id))


# ------------------------------------------------------------------ agendar (recepção e admin)

def _appointment_out(appointment) -> AppointmentOut:
    return AppointmentOut.model_validate(appointment, from_attributes=True)


@router.post("/appointments", response_model=AppointmentOut, status_code=status.HTTP_201_CREATED)
def create_appointment(payload: AppointmentCreate, actor: Bookers, db: DbSession) -> AppointmentOut:
    return _appointment_out(service.create_appointment(db, actor, payload))


@router.post("/appointments/{appointment_id}/reschedule", response_model=AppointmentOut)
def reschedule_appointment(
    appointment_id: UUID, payload: AppointmentReschedule, actor: Bookers, db: DbSession
) -> AppointmentOut:
    return _appointment_out(service.reschedule_appointment(db, actor, appointment_id, payload))


@router.post("/appointments/{appointment_id}/cancel", response_model=AppointmentOut)
def cancel_appointment(
    appointment_id: UUID, payload: AppointmentCancel, actor: Bookers, db: DbSession
) -> AppointmentOut:
    return _appointment_out(service.cancel_appointment(db, actor, appointment_id, payload))
