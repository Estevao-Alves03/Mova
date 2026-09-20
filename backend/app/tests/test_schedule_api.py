"""API de agenda: configuração do nutricionista, bloqueios, disponibilidade e agendamento.

Cada teste roda numa clínica descartável (fixtures `world` / `configured`). O exemplo usado:
seg 08–18 (almoço 12–14), ter 08–12, qua sem atendimento, qui 14–18, sex 08–17;
1ª consulta 90 min, retorno 60, avaliação 60; início a cada 30 min.
"""

import uuid
from datetime import datetime, timedelta

import pytest
from sqlalchemy import text

from app.db.session import get_engine
from app.tests import schedule_helpers as sh
from app.tests.schedule_helpers import at, iso, local_hhmm, next_weekday

API = "/api/v1/schedule"


def cfg_url(user) -> str:
    return f"{API}/professionals/{user.membership_id}/config"


def blocks_url(user) -> str:
    return f"{API}/professionals/{user.membership_id}/blocks"


def book(client, w, day, hour, minute=0, kind="return_consultation", who="reception", **extra):
    return client.post(
        f"{API}/appointments", headers=w.headers[who],
        json={"patient_id": str(w.patient), "professional_id": str(w.nutri.membership_id),
              "appointment_type": kind, "starts_at": iso(day, hour, minute), **extra},
    )


def slots(client, w, kind, first, last=None, who="reception"):
    response = client.get(
        f"{API}/availability", headers=w.headers[who],
        params={"professional_id": str(w.nutri.membership_id), "appointment_type": kind,
                "from": first.isoformat(), "to": (last or first).isoformat()},
    )
    assert response.status_code == 200, response.text
    return [local_hhmm(s["starts_at"]) for s in response.json()["slots"]]


MONDAY = next_weekday(1)
TUESDAY = next_weekday(2)
WEDNESDAY = next_weekday(3)
THURSDAY = next_weekday(4)
SATURDAY = next_weekday(6)


# ------------------------------------------------------------------ permissões

def test_reception_can_never_write_availability_blocks_or_settings(client, configured):
    w = configured
    rec = w.headers["reception"]
    before = client.get(cfg_url(w.nutri), headers=rec).json()

    assert client.put(cfg_url(w.nutri), headers=rec, json=sh.example_config(w.unit)).status_code == 403
    body = {"kind": "day_off", "date": MONDAY.isoformat()}
    assert client.post(blocks_url(w.nutri), headers=rec, json=body).status_code == 403
    assert client.get(blocks_url(w.nutri), headers=rec).status_code == 403
    assert client.delete(f"{blocks_url(w.nutri)}/{uuid.uuid4()}", headers=rec).status_code == 403

    # Nada mudou e nenhum bloqueio nasceu.
    assert client.get(cfg_url(w.nutri), headers=rec).json() == before
    with get_engine().begin() as conn:
        assert conn.execute(text("select count(*) from professional_blocks where clinic_id = :c"), {"c": w.clinic}).scalar() == 0


def test_reception_deleting_a_real_block_is_forbidden_and_keeps_it(client, configured):
    w = configured
    created = client.post(blocks_url(w.nutri), headers=w.headers["nutri"], json={"kind": "day_off", "date": MONDAY.isoformat()})
    assert created.status_code == 201
    assert client.delete(f"{blocks_url(w.nutri)}/{created.json()['id']}", headers=w.headers["reception"]).status_code == 403
    assert len(client.get(blocks_url(w.nutri), headers=w.headers["nutri"]).json()) == 1


def test_reception_can_read_config_and_availability(client, configured):
    w = configured
    response = client.get(cfg_url(w.nutri), headers=w.headers["reception"])
    assert response.status_code == 200 and response.json()["configured"] is True
    assert slots(client, w, "return_consultation", MONDAY)


def test_nutritionist_cannot_book_reschedule_or_cancel(client, configured):
    w = configured
    booked = book(client, w, MONDAY, 9)
    assert booked.status_code == 201
    appointment = booked.json()["id"]

    assert book(client, w, MONDAY, 10, who="nutri").status_code == 403
    assert client.post(f"{API}/appointments/{appointment}/reschedule", headers=w.headers["nutri"],
                       json={"starts_at": iso(MONDAY, 10)}).status_code == 403
    assert client.post(f"{API}/appointments/{appointment}/cancel", headers=w.headers["nutri"],
                       json={"source": "client"}).status_code == 403


def test_nutritionist_cannot_touch_another_professional(client, configured):
    w = configured
    headers = w.headers["other"]
    assert client.get(cfg_url(w.nutri), headers=headers).status_code == 404
    assert client.put(cfg_url(w.nutri), headers=headers, json=sh.example_config(w.unit)).status_code == 404
    assert client.get(blocks_url(w.nutri), headers=headers).status_code == 404
    assert client.post(blocks_url(w.nutri), headers=headers, json={"kind": "day_off", "date": MONDAY.isoformat()}).status_code == 404
    assert client.delete(f"{blocks_url(w.nutri)}/{uuid.uuid4()}", headers=headers).status_code == 404
    assert client.get(f"{API}/professionals/{w.nutri.membership_id}/unavailable-periods", headers=headers,
                      params={"from": MONDAY.isoformat(), "to": MONDAY.isoformat()}).status_code == 404
    assert client.get(f"{API}/professionals/{w.nutri.membership_id}/outside-availability", headers=headers).status_code == 404
    response = client.get(f"{API}/availability", headers=headers, params={
        "professional_id": str(w.nutri.membership_id), "appointment_type": "return_consultation",
        "from": MONDAY.isoformat(), "to": MONDAY.isoformat()})
    assert response.status_code == 404


def test_nutritionist_lists_only_themselves_reception_lists_all(client, world):
    own = client.get(f"{API}/professionals", headers=world.headers["nutri"]).json()
    assert [p["id"] for p in own] == [str(world.nutri.membership_id)]
    everyone = client.get(f"{API}/professionals", headers=world.headers["reception"]).json()
    assert {p["id"] for p in everyone} == {str(world.nutri.membership_id), str(world.other.membership_id)}


def test_admin_can_edit_any_professional_in_own_clinic(client, world):
    response = client.put(cfg_url(world.nutri), headers=world.headers["admin"], json=sh.example_config(world.unit))
    assert response.status_code == 200 and response.json()["config"]["configured"] is True
    assert client.post(blocks_url(world.nutri), headers=world.headers["admin"],
                       json={"kind": "day_off", "date": MONDAY.isoformat()}).status_code == 201


def test_admin_cannot_reach_a_professional_of_another_clinic(client, world):
    foreign_clinic = uuid.uuid4()
    foreign_user = uuid.uuid4()
    foreign_professional = uuid.uuid4()
    with get_engine().begin() as conn:
        conn.execute(text("insert into clinics (id, name) values (:i, 'Outra')"), {"i": foreign_clinic})
        conn.execute(text("insert into auth.users (id, instance_id, aud, role, email) values "
                          "(:u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', :e)"),
                     {"u": foreign_user, "e": f"alheio-{foreign_user.hex[:8]}@mova.test"})
        conn.execute(text("insert into memberships (id, clinic_id, user_id, role, full_name) values "
                          "(:i, :c, :u, 'nutritionist', 'Alheio')"),
                     {"i": foreign_professional, "c": foreign_clinic, "u": foreign_user})
    try:
        url = f"{API}/professionals/{foreign_professional}"
        headers = world.headers["admin"]
        assert client.get(f"{url}/config", headers=headers).status_code == 404
        assert client.put(f"{url}/config", headers=headers, json=sh.example_config(world.unit)).status_code == 404
        assert client.post(f"{url}/blocks", headers=headers, json={"kind": "day_off", "date": MONDAY.isoformat()}).status_code == 404
    finally:
        with get_engine().begin() as conn:
            conn.execute(text("delete from memberships where id = :i"), {"i": foreign_professional})
            conn.execute(text("delete from clinics where id = :i"), {"i": foreign_clinic})
            conn.execute(text("delete from auth.users where id = :u"), {"u": foreign_user})


def test_patient_without_membership_and_anonymous_are_rejected(client, world, make_user, auth_headers):
    outsider = make_user(role=None)
    headers = auth_headers(outsider)
    assert client.get(cfg_url(world.nutri), headers=headers).status_code == 403
    assert client.get(cfg_url(world.nutri)).status_code == 401
    assert client.put(cfg_url(world.nutri), json=sh.example_config(world.unit)).status_code == 401
    assert client.post(f"{API}/appointments", json={}).status_code == 401


def test_patient_role_has_no_access(client, world, make_user, auth_headers):
    patient_user = make_user(role="patient")
    headers = auth_headers(patient_user)
    assert client.get(cfg_url(world.nutri), headers=headers).status_code == 403
    assert client.get(f"{API}/professionals", headers=headers).status_code == 403


# ------------------------------------------------------------------ configuração

def test_unconfigured_professional_reports_not_configured(client, world):
    config = client.get(cfg_url(world.nutri), headers=world.headers["nutri"]).json()
    assert config["configured"] is False and config["days"] == [] and config["durations"] == {}
    assert config["start_step_minutes"] == 30


def test_save_and_read_back_config(client, world):
    response = client.put(cfg_url(world.nutri), headers=world.headers["nutri"], json=sh.example_config(world.unit))
    assert response.status_code == 200
    saved = response.json()["config"]
    assert saved["configured"] is True
    assert saved["durations"] == {"first_consultation": 90, "return_consultation": 60, "assessment": 60}
    assert saved["lunch"] == {"start": "12:00", "end": "14:00"}
    assert [(d["weekday"], d["start"], d["end"]) for d in saved["days"]] == [
        (1, "08:00", "18:00"), (2, "08:00", "12:00"), (4, "14:00", "18:00"), (5, "08:00", "17:00")]
    assert client.get(cfg_url(world.nutri), headers=world.headers["reception"]).json() == saved


def test_config_is_replaced_not_merged(client, configured):
    w = configured
    smaller = sh.example_config(w.unit, days=[{"weekday": 3, "start": "09:00", "end": "13:00", "unit_id": str(w.unit)}], lunch=None)
    client.put(cfg_url(w.nutri), headers=w.headers["nutri"], json=smaller)
    saved = client.get(cfg_url(w.nutri), headers=w.headers["nutri"]).json()
    assert [d["weekday"] for d in saved["days"]] == [3] and saved["lunch"] is None


def test_configured_requires_all_three_durations_and_a_window(client, world):
    partial = sh.example_config(world.unit, durations={"return_consultation": 60})
    saved = client.put(cfg_url(world.nutri), headers=world.headers["nutri"], json=partial).json()["config"]
    assert saved["configured"] is False
    no_days = sh.example_config(world.unit, days=[])
    assert client.put(cfg_url(world.nutri), headers=world.headers["nutri"], json=no_days).json()["config"]["configured"] is False


@pytest.mark.parametrize(
    "patch",
    [
        {"start_step_minutes": 20},
        {"durations": {"first_consultation": 90, "return_consultation": 50, "assessment": 60}},
        {"durations": {"first_consultation": 0, "return_consultation": 60, "assessment": 60}},
        {"durations": {"first_consultation": 90, "return_consultation": 60, "assessment": 300}},
        {"durations": {"teleconsultation": 60}},
        {"lunch": {"start": "14:00", "end": "12:00"}},
        {"lunch": {"start": "12:00", "end": "25:00"}},
        {"role": "admin"},
    ],
)
def test_invalid_config_is_rejected_by_the_api(client, world, patch):
    payload = {**sh.example_config(world.unit), **patch}
    assert client.put(cfg_url(world.nutri), headers=world.headers["nutri"], json=payload).status_code == 422


def test_invalid_days_are_rejected(client, world):
    unit = str(world.unit)
    duplicated = sh.example_config(world.unit, days=[
        {"weekday": 1, "start": "08:00", "end": "12:00", "unit_id": unit},
        {"weekday": 1, "start": "14:00", "end": "18:00", "unit_id": unit}])
    backwards = sh.example_config(world.unit, days=[{"weekday": 1, "start": "12:00", "end": "08:00", "unit_id": unit}])
    bad_weekday = sh.example_config(world.unit, days=[{"weekday": 7, "start": "08:00", "end": "12:00", "unit_id": unit}])
    unknown_unit = sh.example_config(world.unit, days=[{"weekday": 1, "start": "08:00", "end": "12:00", "unit_id": str(uuid.uuid4())}])
    for payload in (duplicated, backwards, bad_weekday, unknown_unit):
        assert client.put(cfg_url(world.nutri), headers=world.headers["nutri"], json=payload).status_code == 422


def test_unit_from_another_clinic_is_rejected(client, world):
    foreign_clinic = uuid.uuid4()
    with get_engine().begin() as conn:
        conn.execute(text("insert into clinics (id, name) values (:i, 'Outra')"), {"i": foreign_clinic})
    try:
        foreign_unit = sh.insert_unit(foreign_clinic)
        response = client.put(cfg_url(world.nutri), headers=world.headers["nutri"], json=sh.example_config(foreign_unit))
        assert response.status_code == 422
    finally:
        with get_engine().begin() as conn:
            conn.execute(text("delete from units where clinic_id = :i"), {"i": foreign_clinic})
            conn.execute(text("delete from clinics where id = :i"), {"i": foreign_clinic})


# ------------------------------------------------------------------ disponibilidade

def test_availability_follows_the_example_week(client, configured):
    w = configured
    monday = slots(client, w, "return_consultation", MONDAY)
    # 60 min a cada 30: 08:00–11:00 antes do almoço e 14:00–17:00 depois (nunca invade 12–14).
    assert monday == ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00",
                      "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00"]
    assert slots(client, w, "return_consultation", TUESDAY) == ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00"]
    assert slots(client, w, "return_consultation", WEDNESDAY) == []
    assert slots(client, w, "return_consultation", THURSDAY) == ["14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00"]
    assert slots(client, w, "return_consultation", SATURDAY) == []


def test_availability_uses_the_duration_of_each_type(client, configured):
    w = configured
    # 1ª consulta dura 90 min: na terça (08–12) a última que cabe começa às 10:30.
    assert slots(client, w, "first_consultation", TUESDAY) == ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30"]
    response = client.get(f"{API}/availability", headers=w.headers["reception"], params={
        "professional_id": str(w.nutri.membership_id), "appointment_type": "first_consultation",
        "from": TUESDAY.isoformat(), "to": TUESDAY.isoformat()}).json()
    assert response["duration_minutes"] == 90
    first = response["slots"][0]
    assert datetime.fromisoformat(first["ends_at"]) - datetime.fromisoformat(first["starts_at"]) == timedelta(minutes=90)


def test_availability_of_unconfigured_professional_is_empty(client, world):
    response = client.get(f"{API}/availability", headers=world.headers["reception"], params={
        "professional_id": str(world.nutri.membership_id), "appointment_type": "return_consultation",
        "from": MONDAY.isoformat(), "to": MONDAY.isoformat()}).json()
    assert response["configured"] is False and response["slots"] == []


def test_start_step_is_configurable(client, configured):
    w = configured
    for step, expected in ((15, "08:15"), (60, "09:00")):
        client.put(cfg_url(w.nutri), headers=w.headers["nutri"], json=sh.example_config(w.unit, start_step_minutes=step))
        got = slots(client, w, "return_consultation", TUESDAY)
        assert expected in got
        if step == 60:
            assert "08:30" not in got


def test_availability_range_is_limited(client, configured):
    w = configured
    response = client.get(f"{API}/availability", headers=w.headers["reception"], params={
        "professional_id": str(w.nutri.membership_id), "appointment_type": "return_consultation",
        "from": MONDAY.isoformat(), "to": (MONDAY + timedelta(days=90)).isoformat()})
    assert response.status_code == 422
    backwards = client.get(f"{API}/availability", headers=w.headers["reception"], params={
        "professional_id": str(w.nutri.membership_id), "appointment_type": "return_consultation",
        "from": MONDAY.isoformat(), "to": (MONDAY - timedelta(days=1)).isoformat()})
    assert backwards.status_code == 422


def test_booked_slots_disappear_from_availability(client, configured):
    w = configured
    assert book(client, w, MONDAY, 9).status_code == 201  # 09:00–10:00
    got = slots(client, w, "return_consultation", MONDAY)
    assert "09:00" not in got and "08:30" not in got and "09:30" not in got  # sobrepõem
    assert "08:00" in got and "10:00" in got


# ------------------------------------------------------------------ agendar

def test_booking_creates_appointment_with_type_duration(client, configured):
    w = configured
    for kind, hour, minutes in (("first_consultation", 8, 90), ("return_consultation", 14, 60), ("assessment", 16, 60)):
        response = book(client, w, MONDAY, hour, kind=kind)
        assert response.status_code == 201, response.text
        body = response.json()
        assert body["status"] == "scheduled" and body["appointment_type"] == kind
        assert body["unit_id"] == str(w.unit)
        row = sh.appointment_row(body["id"])
        assert row["ends_at"] - row["starts_at"] == timedelta(minutes=minutes)


def test_booking_is_blocked_by_the_api_when_not_configured(client, world):
    response = book(client, world, MONDAY, 9)
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "schedule_not_configured"
    with get_engine().begin() as conn:
        assert conn.execute(text("select count(*) from appointments where clinic_id = :c"), {"c": world.clinic}).scalar() == 0


def test_booking_is_blocked_when_only_some_durations_are_set(client, world):
    partial = sh.example_config(world.unit, durations={"return_consultation": 60})
    client.put(cfg_url(world.nutri), headers=world.headers["nutri"], json=partial)
    assert book(client, world, MONDAY, 9).json()["detail"]["code"] == "schedule_not_configured"


@pytest.mark.parametrize(
    "day, hour, minute, code",
    [
        (MONDAY, 7, 0, "outside_working_hours"),
        (MONDAY, 12, 0, "lunch"),
        (MONDAY, 11, 30, "lunch"),        # 11:30–12:30 invade o almoço
        (MONDAY, 17, 30, "outside_working_hours"),  # termina 18:30
        (WEDNESDAY, 9, 0, "outside_working_hours"),
        (SATURDAY, 9, 0, "outside_working_hours"),
        (TUESDAY, 12, 0, "outside_working_hours"),
        (MONDAY, 9, 15, "off_grid"),
    ],
)
def test_booking_rejects_invalid_times(client, configured, day, hour, minute, code):
    response = book(client, configured, day, hour, minute)
    assert response.status_code == 422, response.text
    assert response.json()["detail"]["code"] == code


def test_booking_in_the_past_is_rejected(client, configured):
    yesterday = sh.next_weekday(1, min_days=-7)
    assert book(client, configured, yesterday, 9).json()["detail"]["code"] == "past"


def test_booking_a_taken_slot_is_a_conflict(client, configured):
    w = configured
    assert book(client, w, MONDAY, 9).status_code == 201
    for minute in (0, 30):
        response = book(client, w, MONDAY, 9, minute)
        assert response.status_code == 409 and response.json()["detail"]["code"] == "slot_taken"


def test_booking_validates_patient_room_and_body(client, configured):
    w = configured
    unknown = client.post(f"{API}/appointments", headers=w.headers["reception"], json={
        "patient_id": str(uuid.uuid4()), "professional_id": str(w.nutri.membership_id),
        "appointment_type": "return_consultation", "starts_at": iso(MONDAY, 9)})
    assert unknown.status_code == 422
    room = sh.insert_room(w.clinic, w.unit)
    assert book(client, w, MONDAY, 9, room_id=str(room)).status_code == 201
    other_unit = sh.insert_unit(w.clinic, "Outra unidade")
    wrong_room = sh.insert_room(w.clinic, other_unit)
    assert book(client, w, MONDAY, 10, room_id=str(wrong_room)).status_code == 422
    assert book(client, w, MONDAY, 10, room_id=str(uuid.uuid4())).status_code == 422
    assert book(client, w, MONDAY, 10, kind="teleconsultation").status_code == 422
    naive = client.post(f"{API}/appointments", headers=w.headers["reception"], json={
        "patient_id": str(w.patient), "professional_id": str(w.nutri.membership_id),
        "appointment_type": "return_consultation", "starts_at": "2030-01-07T09:00:00"})
    assert naive.status_code == 422


def test_booking_patient_from_another_clinic_is_rejected(client, configured):
    w = configured
    foreign = uuid.uuid4()
    with get_engine().begin() as conn:
        conn.execute(text("insert into clinics (id, name) values (:i, 'Outra')"), {"i": foreign})
    try:
        patient = sh.insert_patient(foreign)
        response = client.post(f"{API}/appointments", headers=w.headers["reception"], json={
            "patient_id": str(patient), "professional_id": str(w.nutri.membership_id),
            "appointment_type": "return_consultation", "starts_at": iso(MONDAY, 9)})
        assert response.status_code == 422
    finally:
        with get_engine().begin() as conn:
            conn.execute(text("delete from patients where clinic_id = :i"), {"i": foreign})
            conn.execute(text("delete from clinics where id = :i"), {"i": foreign})


def test_booking_a_time_blocked_by_the_nutritionist_is_rejected(client, configured):
    w = configured
    client.post(blocks_url(w.nutri), headers=w.headers["nutri"],
                json={"kind": "time_block", "date": MONDAY.isoformat(), "start_time": "09:00", "end_time": "10:00"})
    assert book(client, w, MONDAY, 9).json()["detail"]["code"] == "blocked"
    assert book(client, w, MONDAY, 8, 30).json()["detail"]["code"] == "blocked"  # 08:30–09:30 invade
    assert book(client, w, MONDAY, 10).status_code == 201
    assert "09:00" not in slots(client, w, "return_consultation", MONDAY)


# ------------------------------------------------------------------ remarcar

def test_reschedule_frees_the_old_slot_and_uses_current_duration(client, configured):
    w = configured
    appointment = book(client, w, MONDAY, 9).json()["id"]
    # A duração do retorno passa de 60 para 30 minutos DEPOIS de agendar.
    durations = {"first_consultation": 90, "return_consultation": 30, "assessment": 60}
    client.put(cfg_url(w.nutri), headers=w.headers["nutri"], json=sh.example_config(w.unit, durations=durations))
    before = sh.appointment_row(appointment)
    assert before["ends_at"] - before["starts_at"] == timedelta(minutes=60)  # config não altera o que já existe

    response = client.post(f"{API}/appointments/{appointment}/reschedule", headers=w.headers["reception"],
                           json={"starts_at": iso(TUESDAY, 10)})
    assert response.status_code == 200, response.text
    after = sh.appointment_row(appointment)
    assert after["ends_at"] - after["starts_at"] == timedelta(minutes=30)  # remarcada: duração atual
    assert "09:00" in slots(client, w, "return_consultation", MONDAY)      # horário antigo liberado
    assert "10:00" not in slots(client, w, "return_consultation", TUESDAY)


def test_reschedule_can_overlap_its_own_old_time(client, configured):
    w = configured
    appointment = book(client, w, MONDAY, 9).json()["id"]
    assert client.post(f"{API}/appointments/{appointment}/reschedule", headers=w.headers["reception"],
                       json={"starts_at": iso(MONDAY, 9, 30)}).status_code == 200


def test_reschedule_rejects_taken_and_outside_times(client, configured):
    w = configured
    first = book(client, w, MONDAY, 9).json()["id"]
    book(client, w, MONDAY, 15)
    url = f"{API}/appointments/{first}/reschedule"
    taken = client.post(url, headers=w.headers["reception"], json={"starts_at": iso(MONDAY, 15)})
    assert taken.status_code == 409 and taken.json()["detail"]["code"] == "slot_taken"
    lunch = client.post(url, headers=w.headers["reception"], json={"starts_at": iso(MONDAY, 12)})
    assert lunch.json()["detail"]["code"] == "lunch"
    off_day = client.post(url, headers=w.headers["reception"], json={"starts_at": iso(WEDNESDAY, 9)})
    assert off_day.json()["detail"]["code"] == "outside_working_hours"
    assert sh.appointment_row(first)["starts_at"] == at(MONDAY, 9)


def test_reschedule_only_active_appointments(client, configured):
    w = configured
    appointment = book(client, w, MONDAY, 9).json()["id"]
    client.post(f"{API}/appointments/{appointment}/cancel", headers=w.headers["reception"], json={"source": "client"})
    response = client.post(f"{API}/appointments/{appointment}/reschedule", headers=w.headers["reception"],
                           json={"starts_at": iso(MONDAY, 10)})
    assert response.status_code == 409


def test_unknown_or_foreign_appointment_is_404(client, configured):
    w = configured
    for action, body in (("reschedule", {"starts_at": iso(MONDAY, 9)}), ("cancel", {"source": "client"})):
        assert client.post(f"{API}/appointments/{uuid.uuid4()}/{action}", headers=w.headers["reception"], json=body).status_code == 404


# ------------------------------------------------------------------ cancelar

def test_client_cancellation_frees_the_slot(client, configured):
    w = configured
    appointment = book(client, w, MONDAY, 9).json()["id"]
    response = client.post(f"{API}/appointments/{appointment}/cancel", headers=w.headers["reception"], json={"source": "client"})
    assert response.status_code == 200
    assert response.json()["status"] == "cancelled" and response.json()["cancellation_source"] == "client"
    assert "09:00" in slots(client, w, "return_consultation", MONDAY)
    assert client.get(blocks_url(w.nutri), headers=w.headers["nutri"]).json() == []
    assert book(client, w, MONDAY, 9).status_code == 201


def test_internal_cancellation_without_keep_frees_the_slot(client, configured):
    w = configured
    appointment = book(client, w, MONDAY, 9).json()["id"]
    client.post(f"{API}/appointments/{appointment}/cancel", headers=w.headers["reception"], json={"source": "internal"})
    assert "09:00" in slots(client, w, "return_consultation", MONDAY)
    assert client.get(blocks_url(w.nutri), headers=w.headers["nutri"]).json() == []


def test_internal_cancellation_can_keep_the_slot_unavailable(client, configured):
    w = configured
    appointment = book(client, w, MONDAY, 9).json()["id"]
    response = client.post(f"{API}/appointments/{appointment}/cancel", headers=w.headers["reception"],
                           json={"source": "internal", "keep_slot_unavailable": True})
    assert response.status_code == 200 and response.json()["cancellation_source"] == "internal"

    got = slots(client, w, "return_consultation", MONDAY)
    assert "09:00" not in got and "09:30" not in got and "08:30" not in got
    assert book(client, w, MONDAY, 9).json()["detail"]["code"] == "blocked"

    # Vinculado à consulta, sem motivo/dado pessoal.
    blocks = client.get(blocks_url(w.nutri), headers=w.headers["nutri"]).json()
    assert len(blocks) == 1
    assert blocks[0]["kind"] == "cancellation_hold" and blocks[0]["reason"] is None
    assert blocks[0]["source_appointment_id"] == appointment
    assert local_hhmm(blocks[0]["starts_at"]) == "09:00" and local_hhmm(blocks[0]["ends_at"]) == "10:00"

    # A recepção só enxerga "Indisponível".
    periods = client.get(f"{API}/professionals/{w.nutri.membership_id}/unavailable-periods", headers=w.headers["reception"],
                         params={"from": MONDAY.isoformat(), "to": MONDAY.isoformat()}).json()
    assert periods == [{"starts_at": blocks[0]["starts_at"], "ends_at": blocks[0]["ends_at"], "label": "Indisponível"}]

    # O dono pode liberar o horário depois.
    assert client.delete(f"{blocks_url(w.nutri)}/{blocks[0]['id']}", headers=w.headers["nutri"]).status_code == 204
    assert "09:00" in slots(client, w, "return_consultation", MONDAY)


def test_keep_unavailable_only_applies_to_internal_cancellation(client, configured):
    w = configured
    appointment = book(client, w, MONDAY, 9).json()["id"]
    response = client.post(f"{API}/appointments/{appointment}/cancel", headers=w.headers["reception"],
                           json={"source": "client", "keep_slot_unavailable": True})
    assert response.status_code == 422
    assert sh.appointment_row(appointment)["status"] == "scheduled"


def test_cancel_takes_no_free_text_justification(client, configured):
    w = configured
    appointment = book(client, w, MONDAY, 9).json()["id"]
    for extra in ({"reason": "paciente viajou"}, {"justification": "x"}, {"note": "x"}):
        response = client.post(f"{API}/appointments/{appointment}/cancel", headers=w.headers["reception"],
                               json={"source": "client", **extra})
        assert response.status_code == 422
    assert client.post(f"{API}/appointments/{appointment}/cancel", headers=w.headers["reception"], json={}).status_code == 422
    assert client.post(f"{API}/appointments/{appointment}/cancel", headers=w.headers["reception"],
                       json={"source": "nutritionist"}).status_code == 422


def test_cancelling_twice_is_a_conflict(client, configured):
    w = configured
    appointment = book(client, w, MONDAY, 9).json()["id"]
    url = f"{API}/appointments/{appointment}/cancel"
    assert client.post(url, headers=w.headers["reception"], json={"source": "client"}).status_code == 200
    assert client.post(url, headers=w.headers["reception"], json={"source": "internal", "keep_slot_unavailable": True}).status_code == 409
    with get_engine().begin() as conn:
        assert conn.execute(text("select count(*) from professional_blocks where clinic_id = :c"), {"c": w.clinic}).scalar() == 0


def test_deleting_the_hold_survives_and_appointment_stays_cancelled(client, configured):
    w = configured
    appointment = book(client, w, MONDAY, 9).json()["id"]
    client.post(f"{API}/appointments/{appointment}/cancel", headers=w.headers["reception"],
                json={"source": "internal", "keep_slot_unavailable": True})
    hold = client.get(blocks_url(w.nutri), headers=w.headers["nutri"]).json()[0]["id"]
    client.delete(f"{blocks_url(w.nutri)}/{hold}", headers=w.headers["nutri"])
    assert sh.appointment_row(appointment)["status"] == "cancelled"


# ------------------------------------------------------------------ bloqueios

def test_day_off_blocks_the_whole_day_or_range(client, configured):
    w = configured
    response = client.post(blocks_url(w.nutri), headers=w.headers["nutri"], json={
        "kind": "day_off", "date": MONDAY.isoformat(), "end_date": TUESDAY.isoformat(), "reason": "Consulta médica pessoal"})
    assert response.status_code == 201, response.text
    assert response.json()["kind"] == "day_off"
    assert slots(client, w, "return_consultation", MONDAY) == []
    assert slots(client, w, "return_consultation", TUESDAY) == []
    assert slots(client, w, "return_consultation", THURSDAY)  # outro dia segue livre
    assert book(client, w, MONDAY, 9).json()["detail"]["code"] == "blocked"


def test_time_block_removes_only_that_period(client, configured):
    w = configured
    client.post(blocks_url(w.nutri), headers=w.headers["nutri"],
                json={"kind": "time_block", "date": THURSDAY.isoformat(), "start_time": "15:00", "end_time": "16:00"})
    got = slots(client, w, "return_consultation", THURSDAY)
    assert "14:00" in got and "16:00" in got and "14:30" not in got and "15:30" not in got


@pytest.mark.parametrize(
    "body",
    [
        {"kind": "day_off", "date": "2031-01-10", "start_time": "09:00"},
        {"kind": "day_off", "date": "2031-01-10", "end_date": "2031-01-05"},
        {"kind": "time_block", "date": "2031-01-10"},
        {"kind": "time_block", "date": "2031-01-10", "start_time": "10:00", "end_time": "09:00"},
        {"kind": "time_block", "date": "2031-01-10", "end_date": "2031-01-11", "start_time": "09:00", "end_time": "10:00"},
        {"kind": "time_block", "date": "2031-01-10", "start_time": "9h", "end_time": "10:00"},
        {"kind": "cancellation_hold", "date": "2031-01-10"},
        {"kind": "day_off", "date": "2031-01-10", "reason": "x" * 201},
        {"kind": "day_off", "date": "2031-01-10", "source_appointment_id": str(uuid.uuid4())},
    ],
)
def test_invalid_blocks_are_rejected(client, world, body):
    assert client.post(blocks_url(world.nutri), headers=world.headers["nutri"], json=body).status_code == 422


def test_blocks_must_be_in_the_future(client, world):
    yesterday = (sh.next_weekday(1, min_days=-10)).isoformat()
    response = client.post(blocks_url(world.nutri), headers=world.headers["nutri"], json={"kind": "day_off", "date": yesterday})
    assert response.status_code == 422


def test_owner_deletes_own_block_and_unknown_is_404(client, configured):
    w = configured
    block = client.post(blocks_url(w.nutri), headers=w.headers["nutri"], json={"kind": "day_off", "date": MONDAY.isoformat()}).json()
    assert client.delete(f"{blocks_url(w.nutri)}/{block['id']}", headers=w.headers["nutri"]).status_code == 204
    assert client.delete(f"{blocks_url(w.nutri)}/{block['id']}", headers=w.headers["nutri"]).status_code == 404
    assert slots(client, w, "return_consultation", MONDAY)


def test_block_of_another_professional_is_not_deletable_through_own_url(client, configured):
    w = configured
    other_config = client.put(cfg_url(w.other), headers=w.headers["other"], json=sh.example_config(w.unit))
    assert other_config.status_code == 200
    block = client.post(blocks_url(w.other), headers=w.headers["other"], json={"kind": "day_off", "date": MONDAY.isoformat()}).json()
    # O dono do bloqueio é `other`: acessar por /professionals/{nutri}/blocks/{id} não o encontra.
    assert client.delete(f"{blocks_url(w.nutri)}/{block['id']}", headers=w.headers["nutri"]).status_code == 404
    assert len(client.get(blocks_url(w.other), headers=w.headers["other"]).json()) == 1


# ------------------------------------------------------------------ privacidade dos motivos

SECRET = "Cirurgia do meu filho — segredo-pessoal-123"


def test_personal_block_reasons_never_reach_reception(client, configured):
    w = configured
    client.post(blocks_url(w.nutri), headers=w.headers["nutri"], json={
        "kind": "day_off", "date": MONDAY.isoformat(), "reason": SECRET})
    client.post(blocks_url(w.nutri), headers=w.headers["nutri"], json={
        "kind": "time_block", "date": THURSDAY.isoformat(), "start_time": "15:00", "end_time": "16:00", "reason": SECRET})

    # O dono e o admin veem a nota.
    for who in ("nutri", "admin"):
        assert SECRET in client.get(blocks_url(w.nutri), headers=w.headers[who]).text

    rec = w.headers["reception"]
    period = {"from": MONDAY.isoformat(), "to": (MONDAY + timedelta(days=10)).isoformat()}
    responses = [
        client.get(f"{API}/professionals/{w.nutri.membership_id}/unavailable-periods", headers=rec, params=period),
        client.get(f"{API}/availability", headers=rec, params={
            "professional_id": str(w.nutri.membership_id), "appointment_type": "return_consultation", **period}),
        client.get(cfg_url(w.nutri), headers=rec),
        client.get(f"{API}/professionals/{w.nutri.membership_id}/outside-availability", headers=rec),
        client.get(f"{API}/professionals", headers=rec),
        client.get(f"{API}/units", headers=rec),
        book(client, w, MONDAY, 9),  # bloqueada: a mensagem de erro também não pode vazar
        book(client, w, THURSDAY, 15),
    ]
    for response in responses:
        assert "segredo-pessoal" not in response.text and "Cirurgia" not in response.text, response.url


def test_unavailable_periods_expose_only_times_and_a_generic_label(client, configured):
    w = configured
    client.post(blocks_url(w.nutri), headers=w.headers["nutri"], json={"kind": "day_off", "date": MONDAY.isoformat(), "reason": SECRET})
    client.post(blocks_url(w.nutri), headers=w.headers["nutri"],
                json={"kind": "time_block", "date": THURSDAY.isoformat(), "start_time": "15:00", "end_time": "16:00"})
    periods = client.get(f"{API}/professionals/{w.nutri.membership_id}/unavailable-periods", headers=w.headers["reception"],
                         params={"from": MONDAY.isoformat(), "to": (MONDAY + timedelta(days=10)).isoformat()}).json()
    assert len(periods) == 2
    for period in periods:
        assert set(period) == {"starts_at", "ends_at", "label"}
        assert period["label"] == "Indisponível"


# ------------------------------------------------------------------ consultas existentes não são alteradas

def _seed_two_appointments(client, w):
    monday = book(client, w, MONDAY, 9).json()["id"]
    thursday = book(client, w, THURSDAY, 15).json()["id"]
    return monday, thursday


def _snapshot(*ids):
    return {i: sh.appointment_row(i) for i in ids}


def test_changing_config_never_alters_existing_appointments(client, configured):
    w = configured
    ids = _seed_two_appointments(client, w)
    before = _snapshot(*ids)

    narrower = sh.example_config(
        w.unit, durations={"first_consultation": 45, "return_consultation": 30, "assessment": 30},
        days=[{"weekday": 2, "start": "08:00", "end": "12:00", "unit_id": str(w.unit)}], lunch={"start": "08:00", "end": "09:30"},
        start_step_minutes=60)
    response = client.put(cfg_url(w.nutri), headers=w.headers["nutri"], json=narrower)
    assert response.status_code == 200, response.text

    assert _snapshot(*ids) == before  # inclusive updated_at, status, starts_at e ends_at
    affected = {a["appointment_id"]: a for a in response.json()["affected_appointments"]}
    assert set(affected) == set(ids)
    assert affected[ids[0]]["patient_name"] == "Paciente Um"
    assert affected[ids[0]]["reason"] == "outside_working_hours"


def test_blocks_and_day_off_never_alter_existing_appointments(client, configured):
    w = configured
    ids = _seed_two_appointments(client, w)
    before = _snapshot(*ids)
    client.post(blocks_url(w.nutri), headers=w.headers["nutri"], json={"kind": "day_off", "date": MONDAY.isoformat(), "end_date": THURSDAY.isoformat()})
    assert _snapshot(*ids) == before
    outside = client.get(f"{API}/professionals/{w.nutri.membership_id}/outside-availability", headers=w.headers["reception"]).json()
    assert {a["appointment_id"] for a in outside} == set(ids)
    assert {a["reason"] for a in outside} == {"blocked"}


def test_outside_availability_clears_when_config_is_widened(client, configured):
    w = configured
    ids = _seed_two_appointments(client, w)
    client.put(cfg_url(w.nutri), headers=w.headers["nutri"], json=sh.example_config(w.unit, days=[]))
    url = f"{API}/professionals/{w.nutri.membership_id}/outside-availability"
    assert len(client.get(url, headers=w.headers["nutri"]).json()) == 2
    restored = client.put(cfg_url(w.nutri), headers=w.headers["nutri"], json=sh.example_config(w.unit))
    assert restored.json()["affected_appointments"] == []
    assert client.get(url, headers=w.headers["nutri"]).json() == []
    assert _snapshot(*ids)


def test_outside_appointments_can_still_be_cancelled_and_rescheduled(client, configured):
    w = configured
    monday, thursday = _seed_two_appointments(client, w)
    client.put(cfg_url(w.nutri), headers=w.headers["nutri"], json=sh.example_config(
        w.unit, days=[{"weekday": 2, "start": "08:00", "end": "12:00", "unit_id": str(w.unit)}]))
    moved = client.post(f"{API}/appointments/{monday}/reschedule", headers=w.headers["reception"], json={"starts_at": iso(TUESDAY, 9)})
    assert moved.status_code == 200
    cancelled = client.post(f"{API}/appointments/{thursday}/cancel", headers=w.headers["reception"], json={"source": "client"})
    assert cancelled.status_code == 200  # troca de status não é barrada pela trava do banco


def test_existing_appointment_keeps_original_duration_after_type_duration_changes(client, configured):
    w = configured
    appointment = book(client, w, MONDAY, 9).json()["id"]
    client.put(cfg_url(w.nutri), headers=w.headers["nutri"], json=sh.example_config(
        w.unit, durations={"first_consultation": 90, "return_consultation": 120, "assessment": 60}))
    row = sh.appointment_row(appointment)
    assert row["ends_at"] - row["starts_at"] == timedelta(minutes=60)
    # Ainda ocupa a agenda com a duração original: 10:00 (fim original) está livre para uma consulta de 120 min?
    assert "10:00" in slots(client, w, "return_consultation", MONDAY)
    assert "09:00" not in slots(client, w, "return_consultation", MONDAY)


def test_outside_availability_ignores_past_and_inactive_appointments(client, configured):
    w = configured
    professional = w.nutri.membership_id
    past = at(sh.next_weekday(0, min_days=-10), 9)  # domingo passado: fora do expediente, mas já aconteceu
    sh.insert_appointment(w.clinic, w.patient, professional, w.unit, past, past + timedelta(hours=1), status="completed")
    sunday = sh.next_weekday(0)
    for hour, status in ((9, "completed"), (11, "cancelled"), (13, "no_show")):
        # Estados que não ocupam a agenda não passam pela trava e não contam como "fora da disponibilidade".
        start = at(sunday, hour)
        sh.insert_appointment(w.clinic, w.patient, professional, w.unit, start, start + timedelta(hours=1), status=status)
    url = f"{API}/professionals/{professional}/outside-availability"
    assert client.get(url, headers=w.headers["nutri"]).json() == []


# ------------------------------------------------------------------ admin agenda como a recepção

def test_admin_can_book_reschedule_and_cancel_for_any_professional(client, configured):
    w = configured
    booked = book(client, w, MONDAY, 9, who="admin")
    assert booked.status_code == 201, booked.text
    appointment = booked.json()["id"]
    moved = client.post(f"{API}/appointments/{appointment}/reschedule", headers=w.headers["admin"], json={"starts_at": iso(TUESDAY, 9)})
    assert moved.status_code == 200
    cancelled = client.post(f"{API}/appointments/{appointment}/cancel", headers=w.headers["admin"], json={"source": "client"})
    assert cancelled.status_code == 200


def test_reception_books_for_any_professional_of_the_clinic(client, configured):
    w = configured
    assert client.put(cfg_url(w.other), headers=w.headers["other"], json=sh.example_config(w.unit)).status_code == 200
    response = client.post(f"{API}/appointments", headers=w.headers["reception"], json={
        "patient_id": str(w.patient), "professional_id": str(w.other.membership_id),
        "appointment_type": "assessment", "starts_at": iso(MONDAY, 9)})
    assert response.status_code == 201 and response.json()["professional_id"] == str(w.other.membership_id)
