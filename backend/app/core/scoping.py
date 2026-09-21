"""Escopo de pacientes por papel: o ÚNICO lugar que decide quais pacientes cada papel enxerga."""

from sqlalchemy import Select

from app.modules.auth.models import Membership, UserRole
from app.modules.patients.models import Patient


def scope_patients(query: Select, actor: Membership) -> Select:
    """Sempre da própria clínica e sem excluídos; o nutricionista só vê os pacientes sob sua responsabilidade.
    Admin e recepção veem toda a clínica (a recepção recebe schemas sem campos clínicos)."""
    query = query.where(Patient.clinic_id == actor.clinic_id, Patient.deleted_at.is_(None))
    if actor.role == UserRole.nutritionist:
        query = query.where(Patient.nutritionist_id == actor.id)
    return query
