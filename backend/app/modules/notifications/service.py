"""Notificações do sino. Geradas a partir dos eventos do catálogo de preferências (Configurações > Notificações).

Regras: só quem tem o evento ligado recebe; quem fez a ação não é avisado do que ele mesmo fez; o nutricionista
só recebe o que é da própria agenda; nada clínico entra no texto. Eventos que o sistema ainda não consegue
gerar (confirmação de presença, reavaliação, portal do paciente) não têm gerador aqui.
"""

from datetime import date, datetime, time, timedelta, timezone
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.modules.auth.models import Membership, UserRole
from app.modules.notifications.models import Notification
from app.modules.notifications.schemas import NotificationListOut, NotificationOut
from app.modules.patients.models import Patient
from app.modules.schedule.models import ACTIVE_STATUSES, Appointment, AppointmentType, Clinic
from app.modules.settings.notification_catalog import EVENTS_BY_ROLE
from app.modules.settings.notification_service import effective_for_many

DAILY_SUMMARY_AT = time(7, 30)
MAX_ITEMS = 50

_TYPE_LABEL = {
    AppointmentType.first_consultation: "1ª consulta",
    AppointmentType.return_consultation: "Retorno",
    AppointmentType.assessment: "Avaliação antropométrica",
}
_WEEKDAY = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]
_MONTH = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
_SOURCE_LABEL = {"client": "pelo paciente", "internal": "pela clínica"}


def _clinic_tz(db: Session, clinic_id: UUID) -> ZoneInfo:
    return ZoneInfo(db.scalar(select(Clinic.timezone).where(Clinic.id == clinic_id)) or "America/Sao_Paulo")


def _when(moment: datetime, tz: ZoneInfo) -> str:
    local = moment.astimezone(tz)
    return f"{_WEEKDAY[local.weekday()]}, {local.day} {_MONTH[local.month - 1]} às {local:%H:%M}"


def _recipients(db: Session, actor: Membership, professional_id: UUID, event: str) -> list[Membership]:
    """Equipe ativa da clínica com o evento ligado: admin e recepção (toda a clínica) e o nutricionista da
    consulta. Quem fez a ação fica de fora."""
    people = list(
        db.scalars(
            select(Membership).where(
                Membership.clinic_id == actor.clinic_id,
                Membership.active.is_(True),
                Membership.id != actor.id,
                Membership.role.in_((UserRole.admin, UserRole.receptionist, UserRole.nutritionist)),
            )
        )
    )
    people = [p for p in people if p.role != UserRole.nutritionist or p.id == professional_id]
    if not people:
        return []
    preferences = effective_for_many(db, people)
    return [p for p in people if event in EVENTS_BY_ROLE[p.role] and preferences[p.id]["events"].get(event, False)]


def notify_appointment(
    db: Session,
    actor: Membership,
    appointment: Appointment,
    professional: Membership,
    kind: str,
    previous_start: datetime | None = None,
    cancel_source: str | None = None,
) -> None:
    """Cria os avisos de uma consulta criada, remarcada ou cancelada. Não faz commit: entra na mesma
    transação da consulta (se ela falhar, nenhum aviso nasce)."""
    event = "appointment_created" if kind == "created" else "appointment_cancelled"
    recipients = _recipients(db, actor, appointment.professional_id, event)
    if not recipients:
        return

    tz = _clinic_tz(db, actor.clinic_id)
    patient_name = db.scalar(select(Patient.full_name).where(Patient.id == appointment.patient_id)) or "Paciente"
    what = _TYPE_LABEL[appointment.appointment_type]
    when = _when(appointment.starts_at, tz)
    if kind == "created":
        title = "Nova consulta agendada"
        body = f"{patient_name} • {what} • {when} • {professional.full_name}"
    elif kind == "rescheduled":
        title = "Consulta remarcada"
        old = _when(previous_start, tz) if previous_start else "horário anterior"
        body = f"{patient_name} • {what} • de {old} para {when} • {professional.full_name}"
    else:
        title = "Consulta cancelada"
        by = f" ({_SOURCE_LABEL[cancel_source]})" if cancel_source in _SOURCE_LABEL else ""
        body = f"{patient_name} • {what} • {when}{by} • {professional.full_name}"

    for person in recipients:
        db.add(
            Notification(
                clinic_id=actor.clinic_id,
                membership_id=person.id,
                event=event,
                kind=kind,
                title=title,
                body=body,
                appointment_id=appointment.id,
                target_date=appointment.starts_at.astimezone(tz).date(),
            )
        )


# ------------------------------------------------------------------ resumo diário (gerado sob demanda)

def ensure_daily_summary(db: Session, actor: Membership, now: datetime | None = None) -> None:
    """Sem agendador: o resumo do dia nasce quando a pessoa abre o app depois das 07:30 (uma vez por dia),
    se o evento estiver ligado e houver consultas."""
    if "daily_summary" not in EVENTS_BY_ROLE.get(actor.role, []):
        return
    if not effective_for_many(db, [actor])[actor.id]["events"].get("daily_summary", False):
        return

    tz = _clinic_tz(db, actor.clinic_id)
    local_now = (now or datetime.now(timezone.utc)).astimezone(tz)
    if local_now.time() < DAILY_SUMMARY_AT:
        return

    today = local_now.date()
    start = datetime.combine(today, time(0, 0), tzinfo=tz).astimezone(timezone.utc)
    end = datetime.combine(today + timedelta(days=1), time(0, 0), tzinfo=tz).astimezone(timezone.utc)
    query = (
        select(Appointment, Patient.full_name)
        .join(Patient, Patient.id == Appointment.patient_id)
        .where(
            Appointment.clinic_id == actor.clinic_id,
            Appointment.status.in_(ACTIVE_STATUSES),
            Appointment.starts_at >= start,
            Appointment.starts_at < end,
        )
        .order_by(Appointment.starts_at)
    )
    if actor.role == UserRole.nutritionist:
        query = query.where(Appointment.professional_id == actor.id)
    rows = db.execute(query).all()
    if not rows:
        return

    first, first_patient = rows[0]
    count = len(rows)
    plural = "consulta" if count == 1 else "consultas"
    where = "hoje" if actor.role == UserRole.nutritionist else "hoje na clínica"
    body = f"{count} {plural} {where}. A primeira é às {first.starts_at.astimezone(tz):%H:%M} ({first_patient})."
    db.execute(
        insert(Notification)
        .values(
            clinic_id=actor.clinic_id,
            membership_id=actor.id,
            event="daily_summary",
            title="Resumo da agenda de hoje",
            body=body,
            target_date=today,
            dedupe_key=f"daily:{today.isoformat()}",
        )
        .on_conflict_do_nothing(index_elements=["membership_id", "dedupe_key"], index_where=Notification.dedupe_key.is_not(None))
    )
    db.commit()


# ------------------------------------------------------------------ leitura

def list_notifications(db: Session, actor: Membership, limit: int = 30, now: datetime | None = None) -> NotificationListOut:
    ensure_daily_summary(db, actor, now)
    rows = list(
        db.scalars(
            select(Notification)
            .where(Notification.membership_id == actor.id)
            .order_by(Notification.created_at.desc(), Notification.id)
            .limit(min(limit, MAX_ITEMS))
        )
    )
    unread = db.scalar(
        select(func.count()).select_from(Notification).where(Notification.membership_id == actor.id, Notification.read_at.is_(None))
    )
    return NotificationListOut(
        unread_count=unread or 0,
        items=[
            NotificationOut(
                id=row.id,
                event=row.event,
                kind=row.kind,  # type: ignore[arg-type]
                title=row.title,
                body=row.body,
                appointment_id=row.appointment_id,
                target_date=row.target_date,
                read=row.read_at is not None,
                created_at=row.created_at,
            )
            for row in rows
        ],
    )


def mark_read(db: Session, actor: Membership, notification_id: UUID) -> None:
    row = db.scalars(
        select(Notification).where(Notification.id == notification_id, Notification.membership_id == actor.id)
    ).first()
    if row is None:
        # Aviso de outra pessoa ou inexistente: 404, sem revelar que existe.
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Notificação não encontrada.")
    if row.read_at is None:
        row.read_at = datetime.now(timezone.utc)
        db.commit()


def mark_all_read(db: Session, actor: Membership) -> None:
    db.execute(
        update(Notification)
        .where(Notification.membership_id == actor.id, Notification.read_at.is_(None))
        .values(read_at=datetime.now(timezone.utc))
    )
    db.commit()
