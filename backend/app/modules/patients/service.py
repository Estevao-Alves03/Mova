from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
import re
import unicodedata

from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session

from app.core.scoping import scope_patients

from app.core.errors import field_error
from app.modules.auth.models import Membership, UserRole
from app.modules.notifications.service import notify_appointment
from app.modules.patients.models import Patient, PatientSex
from app.modules.patients.schemas import (
    PatientCreate,
    PatientCreated,
    PatientDetailBasic,
    PatientDetailClinical,
    PatientListBasic,
    PatientListClinical,
    PatientNutritionist,
    PatientOut,
    PatientSearchItem,
    PatientSituation,
    PatientTimelineItem,
    PatientUnit,
)
from app.modules.schedule import service as schedule
from app.modules.schedule.models import ACTIVE_STATUSES, Appointment, AppointmentStatus, AppointmentType, Unit
from app.modules.schedule.schemas import AppointmentOut


def create_patient(db: Session, actor: Membership, payload: PatientCreate) -> PatientCreated:
    """Cadastra o paciente e agenda a 1ª consulta numa única transação.

    O horário é validado pela mesma regra de disponibilidade da agenda; se falhar (ou se alguém ocupar
    o horário antes do commit), NADA é criado: nem o paciente nem a consulta.
    """
    try:
        professional = schedule.resolve_professional(db, actor, payload.nutritionist_id)
    except HTTPException as error:
        # Aqui é dado do formulário, não um recurso da URL: erro de validação apontando o campo.
        raise field_error(422, "nutritionist_id", "Nutricionista inválido.") from error

    first = payload.first_appointment
    patient = Patient(
        clinic_id=actor.clinic_id,
        nutritionist_id=professional.id,
        full_name=payload.full_name,
        email=payload.email,
        phone=payload.phone,
        birth_date=payload.birth_date,
        sex=PatientSex(payload.sex) if payload.sex else None,
        created_by=actor.id,
    )
    db.add(patient)
    db.flush()  # gera o id; o commit só acontece depois de a consulta ser validada

    appointment = schedule.add_appointment(
        db,
        actor,
        professional,
        patient.id,
        AppointmentType.first_consultation,
        first.starts_at,
        first.room_id,
        goal=first.goal,
        initial_notes=first.notes,
    )
    schedule.flush_or_translate(db)
    notify_appointment(db, actor, appointment, professional, "created")  # mesma transação do cadastro
    schedule.commit_or_translate(db)
    db.refresh(patient)
    return PatientCreated(
        patient=PatientOut(
            id=patient.id,
            full_name=patient.full_name,
            birth_date=patient.birth_date,
            sex=patient.sex.value if patient.sex else None,
            phone=patient.phone,
            email=patient.email,
            nutritionist_id=patient.nutritionist_id,
            created_at=patient.created_at,
        ),
        appointment=AppointmentOut.model_validate(appointment, from_attributes=True),
    )


# Sem retorno há mais de 45 dias (e nada agendado) o paciente entra em alerta (rótulo "Em alerta (>45d)").
ALERT_AFTER_DAYS = 45
MAX_LIST = 1000


def _summarize(history, now: datetime) -> tuple[PatientSituation, datetime | None, datetime | None]:
    """Situação, última consulta concluída e próxima consulta ativa, derivadas do histórico de consultas."""
    completed = [item.starts_at for item in history if item.status == AppointmentStatus.completed]
    upcoming = [item.starts_at for item in history if item.status in ACTIVE_STATUSES and item.starts_at > now]
    last = max(completed) if completed else None
    nxt = min(upcoming) if upcoming else None
    if last is None:
        situation = "first_visit"
    elif nxt is None and now - last > timedelta(days=ALERT_AFTER_DAYS):
        situation = "alert"
    else:
        situation = "following"
    return situation, last, nxt


def list_patients(db: Session, actor: Membership) -> list[PatientListBasic | PatientListClinical]:
    patients = list(db.scalars(scope_patients(select(Patient), actor).order_by(Patient.full_name).limit(MAX_LIST)))
    if not patients:
        return []

    appointments: dict = {patient.id: [] for patient in patients}
    rows = db.execute(
        select(Appointment.patient_id, Appointment.starts_at, Appointment.status, Appointment.appointment_type, Appointment.goal)
        .where(Appointment.patient_id.in_(appointments.keys()), Appointment.clinic_id == actor.clinic_id)
        .order_by(Appointment.starts_at)
    )
    for row in rows:
        appointments[row.patient_id].append(row)

    now = datetime.now(timezone.utc)
    clinical = actor.role in (UserRole.admin, UserRole.nutritionist)
    result: list[PatientListBasic | PatientListClinical] = []
    for patient in patients:
        history = appointments[patient.id]
        situation, last, nxt = _summarize(history, now)
        common = dict(
            id=patient.id,
            full_name=patient.full_name,
            birth_date=patient.birth_date,
            sex=patient.sex.value if patient.sex else None,
            phone=patient.phone,
            email=patient.email,
            nutritionist_id=patient.nutritionist_id,
            created_at=patient.created_at,
            situation=situation,
            last_consultation_at=last,
            next_appointment_at=nxt,
        )
        if clinical:
            goal = next(
                (item.goal for item in history if item.appointment_type == AppointmentType.first_consultation and item.goal), None
            )
            result.append(PatientListClinical(**common, goal=goal))
        else:
            result.append(PatientListBasic(**common))
    return result


# ------------------------------------------------------------------ perfil do paciente

MAX_TIMELINE = 20


def get_patient(db: Session, actor: Membership, patient_id: UUID) -> PatientDetailBasic | PatientDetailClinical:
    """Perfil de um paciente do escopo do papel. Fora do escopo (outro nutricionista, outra clínica,
    excluído ou inexistente) = 404, sem revelar que existe. A recepção recebe só cadastro, responsável e unidade."""
    patient = db.scalars(scope_patients(select(Patient), actor).where(Patient.id == patient_id)).first()
    if patient is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paciente não encontrado.")

    history = list(
        db.execute(
            select(
                Appointment.id,
                Appointment.starts_at,
                Appointment.status,
                Appointment.appointment_type,
                Appointment.unit_id,
                Appointment.goal,
                Appointment.initial_notes,
            )
            .where(Appointment.patient_id == patient.id, Appointment.clinic_id == actor.clinic_id)
            .order_by(Appointment.starts_at)
        )
    )
    now = datetime.now(timezone.utc)
    situation, last, nxt = _summarize(history, now)
    live = [item for item in history if item.status != AppointmentStatus.cancelled]

    nutritionist = None
    if patient.nutritionist_id:
        row = db.scalars(
            select(Membership).where(Membership.id == patient.nutritionist_id, Membership.clinic_id == actor.clinic_id)
        ).first()
        if row:
            nutritionist = PatientNutritionist(id=row.id, full_name=row.full_name, crn=row.crn)

    # Sem unidade no cadastro: a da próxima consulta ativa; sem ela, a da consulta mais recente.
    reference = next((item for item in live if nxt and item.starts_at == nxt), live[-1] if live else None)
    unit = None
    if reference:
        row = db.scalars(select(Unit).where(Unit.id == reference.unit_id, Unit.clinic_id == actor.clinic_id)).first()
        if row:
            unit = PatientUnit(id=row.id, name=row.name)

    common = dict(
        id=patient.id,
        full_name=patient.full_name,
        birth_date=patient.birth_date,
        sex=patient.sex.value if patient.sex else None,
        phone=patient.phone,
        email=patient.email,
        created_at=patient.created_at,
        nutritionist=nutritionist,
        unit=unit,
        situation=situation,
    )
    if actor.role == UserRole.receptionist:
        return PatientDetailBasic(**common)

    first = next((item for item in history if item.appointment_type == AppointmentType.first_consultation and item.goal), None)
    return PatientDetailClinical(
        **common,
        goal=first.goal if first else None,
        initial_notes=first.initial_notes if first else None,
        last_consultation_at=last,
        next_appointment_at=nxt,
        timeline=[
            PatientTimelineItem(id=item.id, appointment_type=item.appointment_type, status=item.status, starts_at=item.starts_at)
            for item in live[-MAX_TIMELINE:]
        ],
    )


# ------------------------------------------------------------------ busca principal

MIN_QUERY = 2
SEARCH_LIMIT = 8
# Letras acentuadas -> base, para a busca por nome ignorar acentos e maiúsculas (sem extensão no banco).
_ACCENTED = "áàâãäåéèêëíìîïóòôõöúùûüçñ"
_PLAIN = "aaaaaaeeeeiiiiooooouuuucn"
_PHONE_LIKE = re.compile(r"^[\d\s()+\-.]+$")


def _fold(text_: str) -> str:
    decomposed = unicodedata.normalize("NFD", text_)
    return "".join(ch for ch in decomposed if not unicodedata.combining(ch)).lower()


def _escape(text_: str) -> str:
    """Trecho literal para LIKE: %, _ e a barra invertida digitados pela pessoa não viram curinga."""
    return text_.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _like_term(text_: str) -> str:
    return f"%{_escape(text_)}%"


def search_patients(db: Session, actor: Membership, term: str, limit: int = SEARCH_LIMIT) -> list[PatientSearchItem]:
    """Busca por nome, telefone ou e-mail, dentro do escopo do papel (nutricionista: só os próprios)."""
    term = " ".join(term.split())
    if len(term) < MIN_QUERY:
        return []

    folded_name = func.translate(func.lower(Patient.full_name), _ACCENTED, _PLAIN)
    name_term = _like_term(_fold(term))
    conditions = [
        folded_name.like(name_term, escape="\\"),
        func.lower(func.coalesce(Patient.email, "")).like(_like_term(term.lower()), escape="\\"),
    ]
    # Telefone só entra quando o que foi digitado parece telefone, comparando apenas os dígitos
    # ("(11) 9874" acha "11987412030"; um nome nunca casa por acidente com o telefone).
    digits = re.sub(r"\D", "", term)
    if _PHONE_LIKE.match(term) and len(digits) >= MIN_QUERY:
        conditions.append(
            func.regexp_replace(func.coalesce(Patient.phone, ""), r"\D", "", "g").like(_like_term(digits), escape="\\")
        )

    prefix = f"{_escape(_fold(term))}%"
    query = (
        scope_patients(select(Patient), actor)
        .where(or_(*conditions))
        # Quem começa com o termo vem primeiro; depois, ordem alfabética.
        .order_by(case((folded_name.like(prefix, escape="\\"), 0), else_=1), Patient.full_name)
        .limit(limit)
    )
    return [
        PatientSearchItem(
            id=patient.id,
            full_name=patient.full_name,
            birth_date=patient.birth_date,
            sex=patient.sex.value if patient.sex else None,
            phone=patient.phone,
            email=patient.email,
        )
        for patient in db.scalars(query)
    ]
