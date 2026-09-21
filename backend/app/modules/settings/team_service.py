"""Equipe e acesso (só admin). Nada é excluído: desativar bloqueia o acesso e preserva o histórico."""

from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.core.errors import field_error
from app.modules.auth.models import Membership, UserRole
from app.modules.patients.models import Patient
from app.modules.schedule.models import ACTIVE_STATUSES, Appointment
from app.modules.settings.auth_admin import (
    AuthAdmin,
    AuthAdminError,
    EmailAlreadyRegistered,
    generate_temporary_password,
)
from app.modules.settings.team_schemas import MemberCreate, MemberCreated, MemberOut, MemberUpdate

_LIST_SQL = """
    select m.id, m.full_name, u.email, m.role, m.crn, m.active, u.last_sign_in_at
    from memberships m join auth.users u on u.id = m.user_id
    where m.clinic_id = :clinic and m.role <> 'patient' {only}
    order by m.created_at, m.full_name
"""


def _status(active: bool, last_sign_in_at: datetime | None) -> str:
    if not active:
        return "inactive"
    return "active" if last_sign_in_at else "invited"


def _rows(db: Session, actor: Membership, member_id: UUID | None = None) -> list[MemberOut]:
    sql = text(_LIST_SQL.format(only="and m.id = :member" if member_id else ""))
    params = {"clinic": actor.clinic_id, **({"member": member_id} if member_id else {})}
    return [
        MemberOut(
            id=row.id,
            full_name=row.full_name,
            email=row.email,
            role=row.role,
            crn=row.crn,
            active=row.active,
            status=_status(row.active, row.last_sign_in_at),
            last_sign_in_at=row.last_sign_in_at,
            is_you=row.id == actor.id,
        )
        for row in db.execute(sql, params)
    ]


def list_members(db: Session, actor: Membership) -> list[MemberOut]:
    return _rows(db, actor)


def _conflict(message: str) -> HTTPException:
    return HTTPException(status.HTTP_409_CONFLICT, detail=message)


def create_member(db: Session, actor: Membership, auth_admin: AuthAdmin, payload: MemberCreate) -> MemberCreated:
    password = generate_temporary_password()
    try:
        user_id = auth_admin.create_user(payload.email, password)
    except EmailAlreadyRegistered:
        # Nunca vincula uma conta existente (poderia ser de outra clínica ou de um paciente).
        raise field_error(409, "email", "Este e-mail já possui cadastro.") from None
    except AuthAdminError as error:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail="Não foi possível criar o usuário agora.") from error

    member_id = uuid4()
    try:
        db.add(
            Membership(
                id=member_id,
                clinic_id=actor.clinic_id,
                user_id=user_id,
                role=payload.role,
                full_name=payload.full_name,
                active=True,
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        auth_admin.delete_user(user_id)
        raise
    return MemberCreated(member=_rows(db, actor, member_id)[0], temporary_password=password)


def _load_member(db: Session, actor: Membership, member_id: UUID) -> Membership:
    """Membro da própria clínica (equipe). Outra clínica, paciente ou inexistente: 404."""
    member = db.scalars(
        select(Membership).where(
            Membership.id == member_id, Membership.clinic_id == actor.clinic_id, Membership.role != UserRole.patient
        )
    ).first()
    if member is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Membro não encontrado.")
    return member


def _nutritionist_has_work(db: Session, member: Membership) -> bool:
    patients = db.scalar(
        select(func.count()).select_from(Patient).where(Patient.nutritionist_id == member.id, Patient.deleted_at.is_(None))
    )
    upcoming = db.scalar(
        select(func.count()).select_from(Appointment).where(
            Appointment.professional_id == member.id,
            Appointment.status.in_(ACTIVE_STATUSES),
            Appointment.starts_at > datetime.now(timezone.utc),
        )
    )
    return bool(patients or upcoming)


def update_member(db: Session, actor: Membership, member_id: UUID, payload: MemberUpdate) -> MemberOut:
    # Trava os administradores da clínica: duas mudanças simultâneas não deixam a clínica sem admin.
    admins = list(
        db.scalars(
            select(Membership)
            .where(Membership.clinic_id == actor.clinic_id, Membership.role == UserRole.admin, Membership.active.is_(True))
            .with_for_update()
        )
    )
    member = _load_member(db, actor, member_id)
    changes = payload.model_dump(exclude_unset=True)
    new_role = changes.get("role", member.role)
    new_active = changes.get("active", member.active)
    role_changed = new_role != member.role
    active_changed = new_active != member.active

    if actor.id == member.id and (role_changed or active_changed):
        raise _conflict("Você não pode alterar a própria função nem desativar a própria conta.")

    is_active_admin = member.role == UserRole.admin and member.active
    still_admin = new_role == UserRole.admin and new_active
    if is_active_admin and not still_admin and not [a for a in admins if a.id != member.id]:
        raise _conflict("A clínica precisa ter ao menos um administrador ativo.")

    # Um nutricionista com pacientes ou consultas futuras não pode virar outra função: os vínculos
    # deixariam de apontar para um nutricionista. (Reatribuir pacientes ainda não existe na interface.)
    if role_changed and member.role == UserRole.nutritionist and _nutritionist_has_work(db, member):
        raise _conflict("Este nutricionista tem pacientes ou consultas futuras. Reatribua-os antes de mudar a função.")

    if "full_name" in changes:
        member.full_name = changes["full_name"]
    member.role = new_role
    member.active = new_active
    db.commit()
    return _rows(db, actor, member.id)[0]
