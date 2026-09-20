import re
import uuid
from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import field_error
from app.core.security import AuthenticatedUser
from app.modules.auth.models import Membership, UserRole
from app.modules.patients.models import Patient
from app.modules.schedule.models import Appointment, AppointmentStatus
from app.modules.settings.avatar_storage import AvatarStorage, StorageError
from app.modules.settings.constants import CRN_STATE_OPTIONS, MAX_AVATAR_BYTES, PROFESSIONAL_ROLES
from app.modules.settings.schemas import AccountSummaryOut, ProfileOut, ProfileUpdate

_SAO_PAULO = ZoneInfo("America/Sao_Paulo")
_PROFESSIONAL_ONLY_FIELDS = ("crn", "crn_state", "bio")

# Tipo real da imagem pelos primeiros bytes; o Content-Type enviado pelo cliente é ignorado.
_IMAGE_SIGNATURES: list[tuple[bytes, str, str]] = [
    (b"\xff\xd8\xff", "image/jpeg", "jpg"),
    (b"\x89PNG\r\n\x1a\n", "image/png", "png"),
]


def _detect_image(data: bytes) -> tuple[str, str] | None:
    for signature, content_type, extension in _IMAGE_SIGNATURES:
        if data.startswith(signature):
            return content_type, extension
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp", "webp"
    return None


def _crn_region(value: str) -> str | None:
    match = re.search(r"CRN-(\d+)", value)
    return match.group(1) if match else None


def _account_summary(db: Session, membership: Membership) -> AccountSummaryOut:
    now = datetime.now(_SAO_PAULO)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    own_patients = (
        Patient.clinic_id == membership.clinic_id,
        Patient.nutritionist_id == membership.id,
        Patient.deleted_at.is_(None),
    )
    active_patients = db.scalar(select(func.count()).select_from(Patient).where(*own_patients))
    new_patients = db.scalar(
        select(func.count()).select_from(Patient).where(*own_patients, Patient.created_at >= month_start)
    )
    total_appointments = db.scalar(
        select(func.count())
        .select_from(Appointment)
        .where(
            Appointment.clinic_id == membership.clinic_id,
            Appointment.professional_id == membership.id,
            Appointment.status == AppointmentStatus.completed,
        )
    )
    return AccountSummaryOut(
        active_patients=active_patients or 0,
        new_patients_this_month=new_patients or 0,
        total_appointments=total_appointments or 0,
    )


def build_profile(
    db: Session, membership: Membership, user: AuthenticatedUser, storage: AvatarStorage | None
) -> ProfileOut:
    avatar_url = (
        storage.signed_url(membership.avatar_path) if storage and membership.avatar_path else None
    )
    is_professional = membership.role in PROFESSIONAL_ROLES
    return ProfileOut(
        id=membership.id,
        full_name=membership.full_name,
        email=user.email,
        role=membership.role,
        phone=membership.phone,
        crn=membership.crn,
        crn_state=membership.crn_state,
        specialty=membership.specialty,
        bio=membership.bio,
        avatar_url=avatar_url,
        member_since=membership.created_at,
        active=membership.active,
        has_professional_fields=is_professional,
        crn_state_options=CRN_STATE_OPTIONS if is_professional else [],
        account_summary=(
            _account_summary(db, membership) if membership.role == UserRole.nutritionist else None
        ),
    )


def update_profile(db: Session, membership: Membership, payload: ProfileUpdate) -> None:
    changes = payload.model_dump(exclude_unset=True)

    if membership.role not in PROFESSIONAL_ROLES:
        for field in _PROFESSIONAL_ONLY_FIELDS:
            if field in changes:
                raise field_error(422, field, "Este campo não se aplica ao seu perfil.")

    for field, value in changes.items():
        setattr(membership, field, value)

    if membership.crn and membership.crn_state:
        if _crn_region(membership.crn) != _crn_region(membership.crn_state):
            raise field_error(422, "crn_state", "O estado não corresponde à região do CRN informado.")

    db.commit()


def _read_avatar(file: UploadFile) -> tuple[bytes, str, str]:
    # Lê no máximo limite+1 bytes: rejeita arquivos grandes sem carregá-los inteiros.
    data = file.file.read(MAX_AVATAR_BYTES + 1)
    if len(data) > MAX_AVATAR_BYTES:
        raise HTTPException(
            status_code=413,
            detail="A foto deve ter no máximo 2 MB.",
        )
    detected = _detect_image(data)
    if detected is None:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Formato inválido. Envie uma imagem JPG, PNG ou WebP.",
        )
    return data, detected[0], detected[1]


def set_avatar(db: Session, membership: Membership, file: UploadFile, storage: AvatarStorage) -> None:
    data, content_type, extension = _read_avatar(file)
    new_path = f"{membership.id}/{uuid.uuid4().hex}.{extension}"
    old_path = membership.avatar_path

    try:
        storage.upload(new_path, data, content_type)
    except StorageError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="Não foi possível salvar a foto."
        ) from error

    membership.avatar_path = new_path
    try:
        db.commit()
    except Exception:
        db.rollback()
        storage.delete(new_path)
        raise
    if old_path:
        storage.delete(old_path)


def remove_avatar(db: Session, membership: Membership, storage: AvatarStorage) -> None:
    old_path = membership.avatar_path
    if old_path is None:
        return
    membership.avatar_path = None
    db.commit()
    storage.delete(old_path)
