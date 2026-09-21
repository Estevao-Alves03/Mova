from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.core.deps import DbSession, require_roles
from app.modules.auth.models import Membership, UserRole
from app.modules.patients import service
from app.modules.patients.schemas import (
    PatientCreate,
    PatientCreated,
    PatientDetailBasic,
    PatientDetailClinical,
    PatientListBasic,
    PatientListClinical,
    PatientSearchItem,
)


# Só recepção e admin cadastram pacientes; o nutricionista recebe 403 (docs/permissoes.md).
Creators = Annotated[Membership, Depends(require_roles(UserRole.admin, UserRole.receptionist))]

# Quem lê a lista: equipe da clínica. O escopo (nutricionista só os próprios) e o recorte de campos
# clínicos (recepção não recebe `goal`) são aplicados no service.
Readers = Annotated[Membership, Depends(require_roles(UserRole.admin, UserRole.nutritionist, UserRole.receptionist))]

router = APIRouter(prefix="/patients", tags=["patients"])


@router.get("/search", response_model=list[PatientSearchItem])
def search_patients(
    actor: Readers,
    db: DbSession,
    q: Annotated[str, Query(min_length=service.MIN_QUERY, max_length=100)],
    limit: Annotated[int, Query(ge=1, le=20)] = service.SEARCH_LIMIT,
) -> list[PatientSearchItem]:
    """Busca principal (campo do topo): nome, telefone ou e-mail, no escopo do papel."""
    return service.search_patients(db, actor, q, limit)


# response_model=None: cada papel recebe o SEU schema, sem chaves clínicas para a recepção.
@router.get("", response_model=None)
def list_patients(actor: Readers, db: DbSession) -> list[PatientListBasic | PatientListClinical]:
    return service.list_patients(db, actor)


@router.post("", response_model=PatientCreated, status_code=status.HTTP_201_CREATED)
def create_patient(payload: PatientCreate, actor: Creators, db: DbSession) -> PatientCreated:
    return service.create_patient(db, actor, payload)


# Depois de "/search" (que não é um id). response_model=None: a recepção recebe o schema básico,
# sem consultas, metas nem dados clínicos; o nutricionista só alcança os próprios pacientes (outros = 404).
@router.get("/{patient_id}", response_model=None)
def get_patient(patient_id: UUID, actor: Readers, db: DbSession) -> PatientDetailBasic | PatientDetailClinical:
    return service.get_patient(db, actor, patient_id)
