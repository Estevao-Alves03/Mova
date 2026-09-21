from typing import Any

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.errors import field_error
from app.modules.auth.models import Membership
from app.modules.settings.models import NotificationPreference
from app.modules.settings.notification_catalog import (
    SILENCE_DURING_APPOINTMENT_ROLES,
    SOUND_OPTIONS,
    catalog_for,
    default_preferences,
)
from app.modules.settings.notification_schemas import (
    NotificationPreferencesOut,
    PreferencesOut,
    PreferencesUpdate,
)


def _merge(base: dict[str, Any], stored: dict[str, Any]) -> dict[str, Any]:
    """Aplica o que está gravado sobre os padrões do papel, ignorando chaves que o papel não tem."""
    merged = {**base}
    for key in ("sounds_enabled", "silence_during_appointment"):
        if isinstance(stored.get(key), bool):
            merged[key] = stored[key]
    merged["events"] = {
        event: stored.get("events", {}).get(event, default) for event, default in base["events"].items()
    }
    merged["sounds"] = {
        slot: {**default, **stored.get("sounds", {}).get(slot, {})} for slot, default in base["sounds"].items()
    }
    merged["quiet_hours"] = {**base["quiet_hours"], **stored.get("quiet_hours", {})}
    return merged


def _effective(db: Session, membership: Membership) -> dict[str, Any]:
    row = db.get(NotificationPreference, membership.id)
    return _merge(default_preferences(membership.role), row.preferences if row else {})


def read_preferences(db: Session, membership: Membership) -> NotificationPreferencesOut:
    return NotificationPreferencesOut(
        catalog=catalog_for(membership.role),  # type: ignore[arg-type]
        defaults=PreferencesOut(**default_preferences(membership.role)),
        preferences=PreferencesOut(**_effective(db, membership)),
    )


def _validate(membership: Membership, payload: PreferencesUpdate) -> None:
    catalog = catalog_for(membership.role)
    if payload.events is not None:
        unknown = sorted(set(payload.events) - set(catalog["events"]))
        if unknown:
            raise field_error(422, "events", f"Evento não disponível para o seu perfil: {unknown[0]}.")
    if payload.sounds is not None:
        slots = {slot["id"] for slot in catalog["sounds"]}
        for slot, preference in payload.sounds.items():
            if slot not in slots:
                raise field_error(422, "sounds", f"Alerta sonoro não disponível para o seu perfil: {slot}.")
            if preference.sound not in SOUND_OPTIONS[slot]:
                raise field_error(422, "sounds", f"Som inválido para {slot}: {preference.sound}.")
    if payload.silence_during_appointment is not None and membership.role not in SILENCE_DURING_APPOINTMENT_ROLES:
        raise field_error(422, "silence_during_appointment", "Este ajuste não se aplica ao seu perfil.")
    if payload.sounds_enabled is not None and not catalog["sounds"]:
        raise field_error(422, "sounds_enabled", "Este perfil não tem alertas sonoros.")


def update_preferences(db: Session, membership: Membership, payload: PreferencesUpdate) -> NotificationPreferencesOut:
    _validate(membership, payload)
    changes = payload.model_dump(exclude_unset=True, exclude_none=True)

    current = _effective(db, membership)
    for key in ("sounds_enabled", "silence_during_appointment"):
        if key in changes:
            current[key] = changes[key]
    current["events"] = {**current["events"], **changes.get("events", {})}
    current["sounds"] = {
        slot: {**current["sounds"][slot], **changes.get("sounds", {}).get(slot, {})} for slot in current["sounds"]
    }
    if "quiet_hours" in changes:
        current["quiet_hours"] = changes["quiet_hours"]

    statement = (
        insert(NotificationPreference)
        .values(membership_id=membership.id, clinic_id=membership.clinic_id, preferences=current)
        .on_conflict_do_update(index_elements=["membership_id"], set_={"preferences": current})
    )
    db.execute(statement)
    db.commit()
    return read_preferences(db, membership)


def effective_for_many(db: Session, memberships: list[Membership]) -> dict:
    """Preferências efetivas (padrão do papel + o que a pessoa gravou) de vários usuários de uma vez."""
    rows = {
        row.membership_id: row.preferences
        for row in db.scalars(select(NotificationPreference).where(NotificationPreference.membership_id.in_([m.id for m in memberships])))
    }
    return {m.id: _merge(default_preferences(m.role), rows.get(m.id, {})) for m in memberships}
