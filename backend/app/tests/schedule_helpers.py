import uuid
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import text

from app.db.session import get_engine

TZ = ZoneInfo("America/Sao_Paulo")


def next_weekday(weekday: int, min_days: int = 14) -> date:
    """Próxima data (0 = domingo) a pelo menos `min_days` de hoje: sempre no futuro."""
    day = date.today() + timedelta(days=min_days)
    while (day.weekday() + 1) % 7 != weekday:
        day += timedelta(days=1)
    return day


def at(day: date, hours: int, minutes: int = 0) -> datetime:
    return datetime(day.year, day.month, day.day, hours, minutes, tzinfo=TZ)


def iso(day: date, hours: int, minutes: int = 0) -> str:
    return at(day, hours, minutes).isoformat()


def local_hhmm(value: str) -> str:
    return datetime.fromisoformat(value).astimezone(TZ).strftime("%H:%M")


def example_config(unit_id, **overrides) -> dict:
    """O exemplo do pedido: seg 08–12/14–18, ter 08–12, qua não atende, qui 14–18, sex 08–12/14–17, almoço 12–14."""
    unit = str(unit_id)
    config = {
        "start_step_minutes": 30,
        "lunch": {"start": "12:00", "end": "14:00"},
        "durations": {"first_consultation": 90, "return_consultation": 60, "assessment": 60},
        "days": [
            {"weekday": 1, "start": "08:00", "end": "18:00", "unit_id": unit},
            {"weekday": 2, "start": "08:00", "end": "12:00", "unit_id": unit},
            {"weekday": 4, "start": "14:00", "end": "18:00", "unit_id": unit},
            {"weekday": 5, "start": "08:00", "end": "17:00", "unit_id": unit},
        ],
    }
    config.update(overrides)
    return config


def insert_unit(clinic_id, name: str = "Unidade Teste") -> uuid.UUID:
    unit_id = uuid.uuid4()
    with get_engine().begin() as conn:
        conn.execute(text("insert into units (id, clinic_id, name) values (:i, :c, :n)"), {"i": unit_id, "c": clinic_id, "n": name})
    return unit_id


def link_nutritionist(clinic_id, unit_id, membership_id) -> None:
    """Vínculo feito pelo admin: sem ele o nutricionista não configura atendimento na unidade."""
    with get_engine().begin() as conn:
        conn.execute(
            text("insert into unit_members (unit_id, membership_id, clinic_id) values (:u, :m, :c) on conflict do nothing"),
            {"u": unit_id, "m": membership_id, "c": clinic_id},
        )


def insert_room(clinic_id, unit_id, name: str = "Sala Teste") -> uuid.UUID:
    room_id = uuid.uuid4()
    with get_engine().begin() as conn:
        conn.execute(
            text("insert into rooms (id, clinic_id, unit_id, name) values (:i, :c, :u, :n)"),
            {"i": room_id, "c": clinic_id, "u": unit_id, "n": name},
        )
    return room_id


def insert_patient(clinic_id, nutritionist_id=None, name: str = "Paciente Teste") -> uuid.UUID:
    patient_id = uuid.uuid4()
    with get_engine().begin() as conn:
        conn.execute(
            text("insert into patients (id, clinic_id, nutritionist_id, full_name) values (:i, :c, :n, :name)"),
            {"i": patient_id, "c": clinic_id, "n": nutritionist_id, "name": name},
        )
    return patient_id


def insert_appointment(
    clinic_id, patient_id, professional_id, unit_id, start: datetime, end: datetime,
    status: str = "scheduled", appointment_type: str = "return_consultation",
) -> uuid.UUID:
    appointment_id = uuid.uuid4()
    with get_engine().begin() as conn:
        conn.execute(
            text(
                """
                insert into appointments (id, clinic_id, patient_id, professional_id, unit_id, starts_at, ends_at,
                                          status, appointment_type)
                values (:i, :c, :p, :prof, :u, :s, :e, cast(:st as appointment_status), cast(:t as appointment_type))
                """
            ),
            {"i": appointment_id, "c": clinic_id, "p": patient_id, "prof": professional_id, "u": unit_id,
             "s": start, "e": end, "st": status, "t": appointment_type},
        )
    return appointment_id


def appointment_row(appointment_id) -> dict:
    with get_engine().begin() as conn:
        row = conn.execute(
            text("select starts_at, ends_at, status, updated_at, appointment_type from appointments where id = :i"),
            {"i": appointment_id},
        ).mappings().one()
    return dict(row)
