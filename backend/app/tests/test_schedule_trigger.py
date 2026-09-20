"""A trava do banco (AV001) vale mesmo para quem escreve direto no SQL, sem passar pela API."""

from datetime import date, timedelta

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.db.session import get_engine
from app.modules.schedule import availability as engine
from app.modules.schedule.service import _blocks, _periods, clinic_timezone, load_rules
from app.tests import schedule_helpers as sh
from app.tests.schedule_helpers import at, next_weekday

MONDAY = next_weekday(1)
TUESDAY = next_weekday(2)
WEDNESDAY = next_weekday(3)
SUNDAY = next_weekday(0)


def _code(error: DBAPIError) -> str:
    assert getattr(error.orig, "sqlstate", None) == "AV001", error
    return str(error.orig).split("availability:")[-1].split("\n")[0].strip()


def _insert(w, start, minutes=60, status="scheduled", kind="return_consultation", unit=None):
    return sh.insert_appointment(w.clinic, w.patient, w.nutri.membership_id, unit or w.unit, start,
                                 start + timedelta(minutes=minutes), status=status, appointment_type=kind)


def _rejected(w, start, minutes=60, **kwargs) -> str:
    with pytest.raises(DBAPIError) as caught:
        _insert(w, start, minutes, **kwargs)
    return _code(caught.value)


def test_accepts_a_valid_appointment(configured):
    _insert(configured, at(MONDAY, 9))
    _insert(configured, at(MONDAY, 14, 30))
    _insert(configured, at(TUESDAY, 8), 90, kind="first_consultation")


@pytest.mark.parametrize(
    "day, hour, minute, minutes, kind, code",
    [
        (MONDAY, 7, 0, 60, "return_consultation", "outside_working_hours"),
        (MONDAY, 12, 0, 60, "return_consultation", "lunch"),
        (MONDAY, 11, 30, 60, "return_consultation", "lunch"),
        (MONDAY, 17, 30, 60, "return_consultation", "outside_working_hours"),
        (WEDNESDAY, 9, 0, 60, "return_consultation", "outside_working_hours"),
        (SUNDAY, 9, 0, 60, "return_consultation", "outside_working_hours"),
        (MONDAY, 9, 0, 45, "return_consultation", "wrong_duration"),
        (MONDAY, 9, 0, 60, "first_consultation", "wrong_duration"),
    ],
)
def test_rejects_times_outside_the_rules(configured, day, hour, minute, minutes, kind, code):
    assert _rejected(configured, at(day, hour, minute), minutes, kind=kind) == code


def test_rejects_appointment_crossing_midnight(configured):
    assert _rejected(configured, at(MONDAY, 23, 30), 60) in {"outside_working_hours", "invalid_interval"}


def test_rejects_other_unit(configured):
    other_unit = sh.insert_unit(configured.clinic, "Outra")
    assert _rejected(configured, at(MONDAY, 9), unit=other_unit) == "outside_working_hours"


def test_rejects_a_blocked_period_and_accepts_after_it_is_removed(client, configured):
    w = configured
    block = client.post(f"/api/v1/schedule/professionals/{w.nutri.membership_id}/blocks", headers=w.headers["nutri"],
                        json={"kind": "time_block", "date": MONDAY.isoformat(), "start_time": "09:00", "end_time": "10:00"}).json()
    assert _rejected(w, at(MONDAY, 9)) == "blocked"
    client.delete(f"/api/v1/schedule/professionals/{w.nutri.membership_id}/blocks/{block['id']}", headers=w.headers["nutri"])
    _insert(w, at(MONDAY, 9))


def test_rejects_when_not_configured(world):
    assert _rejected(world, at(MONDAY, 9)) == "schedule_not_configured"


def test_rejects_when_only_part_of_the_durations_exist(client, world):
    partial = sh.example_config(world.unit, durations={"return_consultation": 60})
    client.put(f"/api/v1/schedule/professionals/{world.nutri.membership_id}/config", headers=world.headers["nutri"], json=partial)
    assert _rejected(world, at(MONDAY, 9)) == "schedule_not_configured"


@pytest.mark.parametrize("status", ["completed", "cancelled", "no_show"])
def test_non_active_statuses_are_exempt(configured, status):
    _insert(configured, at(SUNDAY, 9), 45, status=status)  # domingo, duração errada: histórico não é validado


def test_status_only_update_is_allowed_on_an_outside_appointment(client, configured):
    w = configured
    appointment = _insert(w, at(MONDAY, 9))
    client.put(f"/api/v1/schedule/professionals/{w.nutri.membership_id}/config", headers=w.headers["nutri"],
               json=sh.example_config(w.unit, days=[]))
    with get_engine().begin() as conn:
        conn.execute(text("update appointments set status = 'confirmed' where id = :i"), {"i": appointment})
        conn.execute(text("update appointments set status = 'completed' where id = :i"), {"i": appointment})
    assert sh.appointment_row(appointment)["status"] == "completed"


def test_moving_an_appointment_to_an_invalid_time_is_rejected(configured):
    w = configured
    appointment = _insert(w, at(MONDAY, 9))
    with pytest.raises(DBAPIError) as caught, get_engine().begin() as conn:
        conn.execute(text("update appointments set starts_at = :s, ends_at = :e where id = :i"),
                     {"s": at(MONDAY, 12), "e": at(MONDAY, 13), "i": appointment})
    assert _code(caught.value) == "lunch"
    assert sh.appointment_row(appointment)["starts_at"] == at(MONDAY, 9)


def test_reviving_a_cancelled_appointment_in_an_invalid_slot_is_rejected(configured):
    w = configured
    appointment = _insert(w, at(WEDNESDAY, 9), status="cancelled")
    with pytest.raises(DBAPIError) as caught, get_engine().begin() as conn:
        conn.execute(text("update appointments set status = 'scheduled' where id = :i"), {"i": appointment})
    assert _code(caught.value) == "outside_working_hours"


def test_overlap_is_still_rejected_by_the_exclusion_constraint(configured):
    _insert(configured, at(MONDAY, 9))
    with pytest.raises(DBAPIError) as caught:
        _insert(configured, at(MONDAY, 9, 30))
    assert getattr(caught.value.orig, "sqlstate", None) == "23P01"


# ------------------------------------------------------------------ paridade motor × banco

def _candidate_starts(day: date):
    for hour in range(6, 21):
        for minute in (0, 15, 30, 45):
            yield at(day, hour, minute)


def test_engine_and_trigger_agree_on_every_quarter_hour(client, configured):
    """Todo horário que o motor diz que cabe é aceito pelo banco, e o que ele recusa por regra de
    expediente/almoço/bloqueio o banco também recusa (a grade de 30 min é regra só da API)."""
    w = configured
    client.post(f"/api/v1/schedule/professionals/{w.nutri.membership_id}/blocks", headers=w.headers["nutri"],
                json={"kind": "time_block", "date": MONDAY.isoformat(), "start_time": "15:00", "end_time": "15:30"})
    with Session(get_engine()) as db:
        rules = load_rules(db, w.nutri.membership_id)
        tz = clinic_timezone(db, w.clinic)
        periods = _periods(_blocks(db, w.nutri.membership_id))

    checked = 0
    for day in (MONDAY, TUESDAY, WEDNESDAY, next_weekday(4), next_weekday(5), next_weekday(6), SUNDAY):
        for start in _candidate_starts(day):
            for kind, minutes in rules.durations.items():
                end = start + timedelta(minutes=minutes)
                reason = engine.containment_reason(rules, start, end, tz, periods, w.unit)
                try:
                    appointment = _insert(w, start, minutes, kind=kind)
                except DBAPIError as error:
                    assert reason == _code(error), (start, kind, reason)
                else:
                    assert reason is None, (start, kind, reason)
                    with get_engine().begin() as conn:  # libera para o próximo candidato
                        conn.execute(text("delete from appointments where id = :i"), {"i": appointment})
                checked += 1
    assert checked > 1000
