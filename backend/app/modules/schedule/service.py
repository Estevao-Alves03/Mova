"""Regras de agenda aplicadas na API. O frontend nunca decide disponibilidade.

Salvar a configuração do profissional NÃO altera consultas: `save_config` só escreve
nas tabelas de configuração e devolve, de forma informativa, as consultas futuras que
ficaram fora da disponibilidade (calculadas pelo mesmo motor usado para agendar).
"""

from collections.abc import Sequence
from datetime import date, datetime, time, timedelta, timezone
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.core.errors import field_error
from app.modules.auth.models import Membership, UserRole
from app.modules.notifications.service import notify_appointment
from app.modules.patients.models import Patient
from app.modules.schedule import availability as engine
from app.modules.schedule.models import (
    ACTIVE_STATUSES,
    Appointment,
    AppointmentStatus,
    AppointmentType,
    BlockKind,
    CancellationSource,
    Clinic,
    ProfessionalAppointmentDuration,
    ProfessionalAvailability,
    ProfessionalBlock,
    ProfessionalScheduleSettings,
    Room,
    Unit,
    UnitMember,
)
from app.modules.schedule.schemas import (
    AffectedAppointment,
    AgendaAppointmentOut,
    AppointmentCancel,
    AppointmentCreate,
    AppointmentReschedule,
    AvailabilityOut,
    BlockCreate,
    DayConfig,
    LunchConfig,
    ScheduleConfigIn,
    ScheduleConfigOut,
    ScheduleConfigSaveOut,
    SlotOut,
)

MAX_AVAILABILITY_DAYS = 62

# Mensagens para o usuário. Nenhuma carrega dado pessoal (nem motivo de bloqueio).
MESSAGES = {
    "schedule_not_configured": "O profissional ainda não configurou as durações e os horários de atendimento.",
    "outside_working_hours": "Horário fora do expediente do profissional.",
    "lunch": "Horário dentro do intervalo de almoço do profissional.",
    "blocked": "O profissional está indisponível neste horário.",
    "off_grid": "Horário fora da grade de atendimento do profissional.",
    "past": "Não é possível agendar em um horário que já passou.",
    "slot_taken": "Este horário já está ocupado.",
    "invalid_interval": "Intervalo de horário inválido.",
    "wrong_duration": "A duração não corresponde à configurada para este tipo de atendimento.",
    "room_taken": "A sala já está ocupada neste horário.",
}
CONFLICT_CODES = {"schedule_not_configured", "slot_taken", "room_taken"}


def availability_http_error(code: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT if code in CONFLICT_CODES else 422,
        detail={"code": code, "message": MESSAGES.get(code, "Horário indisponível.")},
    )


def _db_error_to_http(error: DBAPIError) -> HTTPException | None:
    """Traduz erros da trava (AV001) e das restrições de sobreposição (23P01)."""
    sqlstate = getattr(error.orig, "sqlstate", None)
    if sqlstate == "AV001":
        return availability_http_error(str(error.orig).split("availability:")[-1].split("\n")[0].strip())
    if sqlstate == "23P01":
        constraint = getattr(getattr(error.orig, "diag", None), "constraint_name", "") or ""
        return availability_http_error("room_taken" if "room" in constraint else "slot_taken")
    return None


def flush_or_translate(db: Session) -> None:
    """Envia os INSERTs pendentes (a trava do banco roda aqui) traduzindo os erros de disponibilidade."""
    try:
        db.flush()
    except DBAPIError as error:
        db.rollback()
        mapped = _db_error_to_http(error)
        if mapped is None:
            raise
        raise mapped from error


def commit_or_translate(db: Session) -> None:
    try:
        db.commit()
    except DBAPIError as error:
        db.rollback()
        mapped = _db_error_to_http(error)
        if mapped is None:
            raise
        raise mapped from error


# ------------------------------------------------------------------ carga

def clinic_timezone(db: Session, clinic_id: UUID) -> ZoneInfo:
    name = db.scalar(select(Clinic.timezone).where(Clinic.id == clinic_id))
    return ZoneInfo(name or "America/Sao_Paulo")


def resolve_professional(db: Session, actor: Membership, professional_id: UUID) -> Membership:
    """Profissional (nutricionista ativo) da clínica do usuário. Recurso alheio = 404, sem revelar que existe."""
    professional = db.scalars(
        select(Membership).where(
            Membership.id == professional_id,
            Membership.clinic_id == actor.clinic_id,
            Membership.role == UserRole.nutritionist,
            Membership.active.is_(True),
        )
    ).first()
    if professional is None or (actor.role == UserRole.nutritionist and actor.id != professional.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profissional não encontrado.")
    return professional


def _to_minutes(value: time) -> int:
    return value.hour * 60 + value.minute


def load_rules(db: Session, professional_id: UUID) -> engine.Rules:
    settings = db.get(ProfessionalScheduleSettings, professional_id)
    durations = {
        row.appointment_type.value: row.minutes
        for row in db.scalars(
            select(ProfessionalAppointmentDuration).where(ProfessionalAppointmentDuration.professional_id == professional_id)
        )
    }
    windows = tuple(
        engine.Window(row.weekday, _to_minutes(row.start_time), _to_minutes(row.end_time), row.unit_id)
        for row in db.scalars(
            select(ProfessionalAvailability).where(ProfessionalAvailability.professional_id == professional_id)
        )
    )
    lunch = (
        (_to_minutes(settings.lunch_start), _to_minutes(settings.lunch_end))
        if settings and settings.lunch_start and settings.lunch_end
        else None
    )
    return engine.Rules(step=settings.start_step_minutes if settings else 30, lunch=lunch, durations=durations, windows=windows)


def _blocks(db: Session, professional_id: UUID) -> list[ProfessionalBlock]:
    return list(db.scalars(select(ProfessionalBlock).where(ProfessionalBlock.professional_id == professional_id)))


def _periods(blocks: Sequence[ProfessionalBlock]) -> list[engine.Period]:
    return [engine.Period(block.starts_at, block.ends_at) for block in blocks]


def _active_appointments(
    db: Session, professional_id: UUID, start: datetime | None = None, end: datetime | None = None
) -> list[Appointment]:
    query = select(Appointment).where(
        Appointment.professional_id == professional_id, Appointment.status.in_(ACTIVE_STATUSES)
    )
    if start:
        query = query.where(Appointment.ends_at > start)
    if end:
        query = query.where(Appointment.starts_at < end)
    return list(db.scalars(query))


def _busy(appointments: Sequence[Appointment], exclude: UUID | None = None) -> list[engine.Period]:
    return [engine.Period(a.starts_at, a.ends_at) for a in appointments if a.id != exclude]


# ------------------------------------------------------------------ configuração

def _hhmm(value: int) -> str:
    return f"{value // 60:02d}:{value % 60:02d}"


def get_config(db: Session, professional: Membership) -> ScheduleConfigOut:
    rules = load_rules(db, professional.id)
    return ScheduleConfigOut(
        professional_id=professional.id,
        start_step_minutes=rules.step,
        lunch=LunchConfig(start=_hhmm(rules.lunch[0]), end=_hhmm(rules.lunch[1])) if rules.lunch else None,
        durations={AppointmentType(kind): minutes for kind, minutes in rules.durations.items()},
        days=[
            DayConfig(weekday=w.weekday, start=_hhmm(w.start), end=_hhmm(w.end), unit_id=w.unit_id)
            for w in sorted(rules.windows, key=lambda w: w.weekday)
        ],
        configured=rules.configured,
    )


def _affected(db: Session, professional: Membership, rules: engine.Rules, blocks: Sequence[ProfessionalBlock]) -> list[AffectedAppointment]:
    tz = clinic_timezone(db, professional.clinic_id)
    now = datetime.now(timezone.utc)
    periods = _periods(blocks)
    rows = db.execute(
        select(Appointment, Patient.full_name)
        .join(Patient, Patient.id == Appointment.patient_id)
        .where(
            Appointment.professional_id == professional.id,
            Appointment.status.in_(ACTIVE_STATUSES),
            Appointment.starts_at > now,
        )
        .order_by(Appointment.starts_at)
    ).all()
    result = []
    for appointment, patient_name in rows:
        reason = engine.outside_reason(rules, appointment.starts_at, appointment.ends_at, tz, periods, appointment.unit_id)
        if reason:
            result.append(
                AffectedAppointment(
                    appointment_id=appointment.id,
                    patient_name=patient_name,
                    appointment_type=appointment.appointment_type,
                    starts_at=appointment.starts_at,
                    ends_at=appointment.ends_at,
                    reason=reason,
                )
            )
    return result


def save_config(db: Session, professional: Membership, payload: ScheduleConfigIn) -> ScheduleConfigSaveOut:
    unit_ids = {day.unit_id for day in payload.days}
    if unit_ids:
        # Só as unidades em que o admin vinculou este nutricionista (e que estejam ativas).
        valid = set(
            db.scalars(
                select(Unit.id)
                .join(UnitMember, UnitMember.unit_id == Unit.id)
                .where(
                    Unit.clinic_id == professional.clinic_id,
                    Unit.active.is_(True),
                    Unit.id.in_(unit_ids),
                    UnitMember.membership_id == professional.id,
                )
            )
        )
        if valid != unit_ids:
            raise field_error(422, "days", "Escolha apenas unidades vinculadas a este profissional.")

    # Somente tabelas de configuração: `appointments` não é tocada aqui.
    db.execute(delete(ProfessionalAvailability).where(ProfessionalAvailability.professional_id == professional.id))
    db.execute(delete(ProfessionalAppointmentDuration).where(ProfessionalAppointmentDuration.professional_id == professional.id))
    db.flush()

    settings = db.get(ProfessionalScheduleSettings, professional.id)
    if settings is None:
        settings = ProfessionalScheduleSettings(professional_id=professional.id, clinic_id=professional.clinic_id)
        db.add(settings)
    settings.start_step_minutes = payload.start_step_minutes
    settings.lunch_start = time.fromisoformat(payload.lunch.start) if payload.lunch else None
    settings.lunch_end = time.fromisoformat(payload.lunch.end) if payload.lunch else None

    for day in payload.days:
        db.add(
            ProfessionalAvailability(
                clinic_id=professional.clinic_id,
                professional_id=professional.id,
                unit_id=day.unit_id,
                weekday=day.weekday,
                start_time=time.fromisoformat(day.start),
                end_time=time.fromisoformat(day.end),
            )
        )
    for kind, minutes in payload.durations.items():
        db.add(ProfessionalAppointmentDuration(professional_id=professional.id, appointment_type=kind, minutes=minutes))
    db.flush()

    rules = load_rules(db, professional.id)
    affected = _affected(db, professional, rules, _blocks(db, professional.id))
    config = get_config(db, professional)
    commit_or_translate(db)
    return ScheduleConfigSaveOut(config=config, affected_appointments=affected)


# ------------------------------------------------------------------ bloqueios

def local_to_utc(tz: ZoneInfo, day: date, at: time | None = None) -> datetime:
    return datetime.combine(day, at or time(0, 0), tzinfo=tz).astimezone(timezone.utc)


def create_block(db: Session, actor: Membership, professional: Membership, payload: BlockCreate) -> ProfessionalBlock:
    tz = clinic_timezone(db, professional.clinic_id)
    if payload.kind == "day_off":
        starts_at = local_to_utc(tz, payload.date)
        ends_at = local_to_utc(tz, (payload.end_date or payload.date) + timedelta(days=1))
    else:
        starts_at = local_to_utc(tz, payload.date, time.fromisoformat(payload.start_time or "00:00"))
        ends_at = local_to_utc(tz, payload.date, time.fromisoformat(payload.end_time or "00:00"))
    if ends_at <= datetime.now(timezone.utc):
        raise field_error(422, "date", "Só é possível bloquear dias ou horários futuros.")
    if ends_at - starts_at > timedelta(days=366):
        raise field_error(422, "end_date", "O período do bloqueio é longo demais.")

    block = ProfessionalBlock(
        clinic_id=professional.clinic_id,
        professional_id=professional.id,
        kind=BlockKind(payload.kind),
        starts_at=starts_at,
        ends_at=ends_at,
        reason=payload.reason or None,
        created_by=actor.id,
    )
    db.add(block)
    commit_or_translate(db)
    return block


def list_blocks(db: Session, professional: Membership, start: datetime | None, end: datetime | None) -> list[ProfessionalBlock]:
    query = select(ProfessionalBlock).where(ProfessionalBlock.professional_id == professional.id)
    if start:
        query = query.where(ProfessionalBlock.ends_at > start)
    if end:
        query = query.where(ProfessionalBlock.starts_at < end)
    return list(db.scalars(query.order_by(ProfessionalBlock.starts_at)))


def delete_block(db: Session, professional: Membership, block_id: UUID) -> None:
    block = db.scalars(
        select(ProfessionalBlock).where(
            ProfessionalBlock.id == block_id, ProfessionalBlock.professional_id == professional.id
        )
    ).first()
    if block is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bloqueio não encontrado.")
    db.delete(block)
    commit_or_translate(db)


# ------------------------------------------------------------------ horários livres

def range_bounds(db: Session, professional: Membership, first: date, last: date) -> tuple[ZoneInfo, datetime, datetime]:
    if last < first or (last - first).days > MAX_AVAILABILITY_DAYS:
        raise field_error(422, "to", f"Informe um período de até {MAX_AVAILABILITY_DAYS} dias.")
    tz = clinic_timezone(db, professional.clinic_id)
    return tz, local_to_utc(tz, first), local_to_utc(tz, last + timedelta(days=1))


def get_availability(
    db: Session, professional: Membership, appointment_type: AppointmentType, first: date, last: date
) -> AvailabilityOut:
    tz, start, end = range_bounds(db, professional, first, last)
    rules = load_rules(db, professional.id)
    slots = engine.free_slots(
        rules,
        appointment_type.value,
        first,
        last,
        tz,
        _periods(list_blocks(db, professional, start, end)),
        _busy(_active_appointments(db, professional.id, start, end)),
        datetime.now(timezone.utc),
    )
    return AvailabilityOut(
        professional_id=professional.id,
        appointment_type=appointment_type,
        duration_minutes=rules.durations.get(appointment_type.value),
        configured=rules.configured,
        slots=[SlotOut(starts_at=s.start, ends_at=s.end, unit_id=s.unit_id) for s in slots],
    )


def outside_availability(db: Session, professional: Membership) -> list[AffectedAppointment]:
    return _affected(db, professional, load_rules(db, professional.id), _blocks(db, professional.id))


# ------------------------------------------------------------------ consultas

def validated_slot(db: Session, professional: Membership, appointment_type: AppointmentType, start: datetime, exclude: UUID | None = None):
    tz = clinic_timezone(db, professional.clinic_id)
    rules = load_rules(db, professional.id)
    day = start.astimezone(tz).date()
    _, window_start, window_end = range_bounds(db, professional, day, day)
    try:
        return engine.validate_booking(
            rules,
            appointment_type.value,
            start,
            tz,
            _periods(list_blocks(db, professional, window_start, window_end)),
            _busy(_active_appointments(db, professional.id, window_start, window_end), exclude),
            datetime.now(timezone.utc),
        )
    except engine.AvailabilityError as error:
        raise availability_http_error(error.code) from error


def add_appointment(
    db: Session,
    actor: Membership,
    professional: Membership,
    patient_id: UUID,
    appointment_type: AppointmentType,
    starts_at: datetime,
    room_id: UUID | None = None,
    **extra,
) -> Appointment:
    """Valida o horário e a sala e ADICIONA a consulta à sessão (quem chama faz o commit).

    Toda regra de disponibilidade passa por aqui, seja no agendamento avulso ou no cadastro do paciente.
    """
    slot = validated_slot(db, professional, appointment_type, starts_at)
    if room_id:
        room = db.scalars(
            select(Room).where(
                Room.id == room_id, Room.clinic_id == actor.clinic_id, Room.unit_id == slot.unit_id, Room.active.is_(True)
            )
        ).first()
        if room is None:
            raise field_error(422, "room_id", "Sala inválida para a unidade deste horário.")

    appointment = Appointment(
        clinic_id=actor.clinic_id,
        patient_id=patient_id,
        professional_id=professional.id,
        unit_id=slot.unit_id,
        room_id=room_id,
        starts_at=slot.start,
        ends_at=slot.end,
        status=AppointmentStatus.scheduled,
        appointment_type=appointment_type,
        created_by=actor.id,
        **extra,
    )
    db.add(appointment)
    return appointment


def create_appointment(db: Session, actor: Membership, payload: AppointmentCreate) -> Appointment:
    professional = resolve_professional(db, actor, payload.professional_id)
    patient = db.scalars(
        select(Patient).where(
            Patient.id == payload.patient_id, Patient.clinic_id == actor.clinic_id, Patient.deleted_at.is_(None)
        )
    ).first()
    if patient is None:
        raise field_error(422, "patient_id", "Paciente não encontrado.")
    appointment = add_appointment(
        db, actor, professional, patient.id, payload.appointment_type, payload.starts_at, payload.room_id
    )
    flush_or_translate(db)
    notify_appointment(db, actor, appointment, professional, "created")  # mesma transação da consulta
    commit_or_translate(db)
    return appointment


def _load_appointment(db: Session, actor: Membership, appointment_id: UUID) -> Appointment:
    appointment = db.scalars(
        select(Appointment).where(Appointment.id == appointment_id, Appointment.clinic_id == actor.clinic_id)
    ).first()
    if appointment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consulta não encontrada.")
    return appointment


def reschedule_appointment(db: Session, actor: Membership, appointment_id: UUID, payload: AppointmentReschedule) -> Appointment:
    appointment = _load_appointment(db, actor, appointment_id)
    if appointment.status not in ACTIVE_STATUSES:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Só é possível remarcar consultas agendadas ou confirmadas.")
    professional = resolve_professional(db, actor, appointment.professional_id)
    # Usa a duração ATUAL do tipo; consultas não remarcadas mantêm o ends_at original.
    slot = validated_slot(db, professional, appointment.appointment_type, payload.starts_at, exclude=appointment.id)
    previous_start = appointment.starts_at
    appointment.starts_at, appointment.ends_at, appointment.unit_id = slot.start, slot.end, slot.unit_id
    notify_appointment(db, actor, appointment, professional, "rescheduled", previous_start=previous_start)
    commit_or_translate(db)
    return appointment


def cancel_appointment(db: Session, actor: Membership, appointment_id: UUID, payload: AppointmentCancel) -> Appointment:
    appointment = _load_appointment(db, actor, appointment_id)
    if appointment.status not in ACTIVE_STATUSES:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Só é possível cancelar consultas agendadas ou confirmadas.")
    if payload.keep_slot_unavailable and payload.source != CancellationSource.internal:
        raise field_error(422, "keep_slot_unavailable", "Só se aplica ao cancelamento por motivo interno.")

    # Cancelado pelo cliente: o horário volta a ficar disponível (consulta cancelada não ocupa a agenda).
    appointment.status = AppointmentStatus.cancelled
    appointment.cancellation_source = payload.source
    if payload.keep_slot_unavailable:
        # Bloqueio de sistema vinculado à consulta, sem nenhum dado pessoal: a recepção não gerencia
        # bloqueios, ele é efeito do cancelamento interno.
        db.add(
            ProfessionalBlock(
                clinic_id=appointment.clinic_id,
                professional_id=appointment.professional_id,
                kind=BlockKind.cancellation_hold,
                starts_at=appointment.starts_at,
                ends_at=appointment.ends_at,
                reason=None,
                source_appointment_id=appointment.id,
                created_by=actor.id,
            )
        )
    professional = db.get(Membership, appointment.professional_id)
    if professional is not None:
        notify_appointment(db, actor, appointment, professional, "cancelled", cancel_source=payload.source.value)
    commit_or_translate(db)
    return appointment


# ------------------------------------------------------------------ agenda (leitura)

# Cancelada libera o horário e sai da agenda; as demais aparecem.
AGENDA_STATUSES = (
    AppointmentStatus.scheduled,
    AppointmentStatus.confirmed,
    AppointmentStatus.completed,
    AppointmentStatus.no_show,
)


def list_agenda(
    db: Session, actor: Membership, first: date, last: date, professional_id: UUID | None
) -> list[AgendaAppointmentOut]:
    """Consultas do período. O nutricionista só enxerga as próprias (outro profissional = 404)."""
    if actor.role == UserRole.nutritionist:
        if professional_id is not None and professional_id != actor.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profissional não encontrado.")
        professional_id = actor.id
    elif professional_id is not None:
        professional_id = resolve_professional(db, actor, professional_id).id

    if last < first or (last - first).days > MAX_AVAILABILITY_DAYS:
        raise field_error(422, "to", f"Informe um período de até {MAX_AVAILABILITY_DAYS} dias.")
    tz = clinic_timezone(db, actor.clinic_id)
    start, end = local_to_utc(tz, first), local_to_utc(tz, last + timedelta(days=1))

    query = (
        select(Appointment, Patient.full_name)
        .join(Patient, Patient.id == Appointment.patient_id)
        .where(
            Appointment.clinic_id == actor.clinic_id,
            Appointment.status.in_(AGENDA_STATUSES),
            Appointment.starts_at < end,
            Appointment.ends_at > start,
        )
        .order_by(Appointment.starts_at)
    )
    if professional_id is not None:
        query = query.where(Appointment.professional_id == professional_id)
    return [
        AgendaAppointmentOut(
            id=appointment.id,
            patient_id=appointment.patient_id,
            patient_name=patient_name,
            professional_id=appointment.professional_id,
            unit_id=appointment.unit_id,
            room_id=appointment.room_id,
            appointment_type=appointment.appointment_type,
            starts_at=appointment.starts_at,
            ends_at=appointment.ends_at,
            status=appointment.status,
        )
        for appointment, patient_name in db.execute(query)
    ]
