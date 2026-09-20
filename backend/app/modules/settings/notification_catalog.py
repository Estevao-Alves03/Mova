"""O que cada papel pode configurar nas notificações, e os valores padrão.

O backend é a fonte da verdade dos identificadores; os textos exibidos ficam no
frontend. Trocar o catálogo aqui muda o que a API aceita e devolve por papel.
"""

from typing import Any

from app.modules.auth.models import UserRole

# Sons por tipo de alerta: identificador -> opções permitidas.
SOUND_OPTIONS: dict[str, list[str]] = {
    "new_appointment": ["classic_soft", "crystal_bell", "serene_harp", "silent"],
    "upcoming_appointment": ["pulsing_alert", "double_bell", "major_chord", "silent"],
    "reception_checkin": ["soft_gong", "office_bell", "warm_notification", "silent"],
}
DEFAULT_SOUNDS: dict[str, dict[str, Any]] = {
    "new_appointment": {"sound": "classic_soft", "volume": 70},
    "upcoming_appointment": {"sound": "pulsing_alert", "volume": 85},
    "reception_checkin": {"sound": "soft_gong", "volume": 60},
}

# Eventos que geram alerta no sistema, por papel (na ordem de exibição).
EVENTS_BY_ROLE: dict[UserRole, list[str]] = {
    UserRole.admin: [
        "appointment_created", "appointment_cancelled", "appointment_confirmed",
        "reevaluation_due", "daily_summary",
    ],
    UserRole.receptionist: [
        "appointment_created", "appointment_cancelled", "appointment_confirmed", "daily_summary",
    ],
    UserRole.nutritionist: [
        "appointment_created", "appointment_cancelled", "reevaluation_due", "daily_summary",
    ],
    UserRole.patient: ["appointment_reminder", "appointment_changed"],
}
DEFAULT_EVENTS_DISABLED = {"daily_summary"}

# Alertas sonoros disponíveis por papel (paciente não tem sons).
SOUNDS_BY_ROLE: dict[UserRole, list[str]] = {
    UserRole.admin: ["new_appointment", "upcoming_appointment", "reception_checkin"],
    UserRole.receptionist: ["new_appointment", "reception_checkin"],
    UserRole.nutritionist: ["new_appointment", "upcoming_appointment"],
    UserRole.patient: [],
}

# "Silêncio durante o atendimento" só faz sentido para quem atende.
SILENCE_DURING_APPOINTMENT_ROLES = {UserRole.admin, UserRole.nutritionist}

QUIET_HOURS_DAYS = ("weekdays", "every_day")
DEFAULT_QUIET_HOURS = {"enabled": True, "start": "08:00", "end": "19:00", "days": "weekdays"}


def default_preferences(role: UserRole) -> dict[str, Any]:
    return {
        "sounds_enabled": bool(SOUNDS_BY_ROLE[role]),
        "silence_during_appointment": role in SILENCE_DURING_APPOINTMENT_ROLES,
        "sounds": {slot: dict(DEFAULT_SOUNDS[slot]) for slot in SOUNDS_BY_ROLE[role]},
        "events": {event: event not in DEFAULT_EVENTS_DISABLED for event in EVENTS_BY_ROLE[role]},
        "quiet_hours": dict(DEFAULT_QUIET_HOURS),
    }


def catalog_for(role: UserRole) -> dict[str, Any]:
    return {
        "events": list(EVENTS_BY_ROLE[role]),
        "sounds": [{"id": slot, "options": SOUND_OPTIONS[slot]} for slot in SOUNDS_BY_ROLE[role]],
        "silence_during_appointment": role in SILENCE_DURING_APPOINTMENT_ROLES,
    }
