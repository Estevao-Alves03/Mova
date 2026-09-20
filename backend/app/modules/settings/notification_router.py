from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.deps import DbSession, require_roles
from app.modules.auth.models import Membership, UserRole
from app.modules.settings import notification_service as service
from app.modules.settings.notification_schemas import NotificationPreferencesOut, PreferencesUpdate

# Cada usuário lê e grava apenas as PRÓPRIAS preferências: não há id na rota, o
# membership vem do token. Equipe em /notification-preferences; paciente em
# /me/... (o paciente só acessa rotas /me).
StaffMembership = Annotated[
    Membership, Depends(require_roles(UserRole.admin, UserRole.nutritionist, UserRole.receptionist))
]
PatientMembership = Annotated[Membership, Depends(require_roles(UserRole.patient))]

staff_router = APIRouter(prefix="/notification-preferences", tags=["notifications"])
patient_router = APIRouter(prefix="/me/notification-preferences", tags=["notifications"])


@staff_router.get("", response_model=NotificationPreferencesOut)
def read_staff(membership: StaffMembership, db: DbSession) -> NotificationPreferencesOut:
    return service.read_preferences(db, membership)


@staff_router.put("", response_model=NotificationPreferencesOut)
def update_staff(
    payload: PreferencesUpdate, membership: StaffMembership, db: DbSession
) -> NotificationPreferencesOut:
    return service.update_preferences(db, membership, payload)


@patient_router.get("", response_model=NotificationPreferencesOut)
def read_patient(membership: PatientMembership, db: DbSession) -> NotificationPreferencesOut:
    return service.read_preferences(db, membership)


@patient_router.put("", response_model=NotificationPreferencesOut)
def update_patient(
    payload: PreferencesUpdate, membership: PatientMembership, db: DbSession
) -> NotificationPreferencesOut:
    return service.update_preferences(db, membership, payload)
