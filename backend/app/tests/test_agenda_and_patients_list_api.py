"""Leitura real: consultas da agenda (`GET /schedule/appointments`) e lista de pacientes (`GET /patients`)."""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import text

from app.db.session import get_engine
from app.tests import schedule_helpers as sh
from app.tests.schedule_helpers import at, iso, next_weekday

AGENDA = "/api/v1/schedule/appointments"
PATIENTS = "/api/v1/patients"
MONDAY = next_weekday(1)
TUESDAY = next_weekday(2)


def agenda(client, headers, first, last=None, **params):
    return client.get(AGENDA, headers=headers, params={"from": first.isoformat(), "to": (last or first).isoformat(), **params})


def book(client, w, day, hour, who="reception", kind="return_consultation", patient=None, nutri=None):
    response = client.post("/api/v1/schedule/appointments", headers=w.headers[who], json={
        "patient_id": str(patient or w.patient), "professional_id": str((nutri or w.nutri).membership_id),
        "appointment_type": kind, "starts_at": iso(day, hour)})
    assert response.status_code == 201, response.text
    return response.json()


def by_name(items):
    return {item["full_name"]: item for item in items}


# ================================================================== agenda

def test_agenda_requires_a_staff_role(client, configured, make_user, auth_headers):
    w = configured
    assert client.get(AGENDA, params={"from": MONDAY.isoformat(), "to": MONDAY.isoformat()}).status_code == 401
    for user in (make_user(role="patient"), make_user(role=None)):
        assert agenda(client, auth_headers(user), MONDAY).status_code == 403


def test_agenda_lists_the_real_appointments_with_patient_name(client, configured):
    w = configured
    book(client, w, MONDAY, 9)
    items = agenda(client, w.headers["reception"], MONDAY).json()
    assert len(items) == 1
    item = items[0]
    assert item["patient_name"] == "Paciente Um" and item["appointment_type"] == "return_consultation" and item["status"] == "scheduled"
    assert item["professional_id"] == str(w.nutri.membership_id) and item["unit_id"] == str(w.unit)
    assert set(item) == {"id", "patient_id", "patient_name", "professional_id", "unit_id", "room_id", "appointment_type", "starts_at", "ends_at", "status"}


def test_agenda_never_exposes_clinical_fields(client, world):
    client.put(f"/api/v1/schedule/professionals/{world.nutri.membership_id}/config", headers=world.headers["nutri"], json=sh.example_config(world.unit))
    created = client.post("/api/v1/patients", headers=world.headers["reception"], json={
        "full_name": "Fulana", "phone": "11987412030", "nutritionist_id": str(world.nutri.membership_id),
        "first_appointment": {"starts_at": iso(MONDAY, 9), "goal": "sports", "notes": "segredo clínico"}})
    assert created.status_code == 201, created.text
    for who in ("reception", "nutri", "admin"):
        body = agenda(client, world.headers[who], MONDAY).text
        assert "segredo clínico" not in body and "goal" not in body and "initial_notes" not in body


def test_nutritionist_only_sees_own_agenda(client, configured):
    w = configured
    client.put(f"/api/v1/schedule/professionals/{w.other.membership_id}/config", headers=w.headers["other"], json=sh.example_config(w.unit))
    book(client, w, MONDAY, 9)
    book(client, w, MONDAY, 10, nutri=w.other)
    own = agenda(client, w.headers["nutri"], MONDAY).json()
    assert [i["professional_id"] for i in own] == [str(w.nutri.membership_id)]
    assert agenda(client, w.headers["nutri"], MONDAY, professional_id=str(w.other.membership_id)).status_code == 404
    assert len(agenda(client, w.headers["nutri"], MONDAY, professional_id=str(w.nutri.membership_id)).json()) == 1


def test_reception_and_admin_see_all_and_can_filter(client, configured):
    w = configured
    client.put(f"/api/v1/schedule/professionals/{w.other.membership_id}/config", headers=w.headers["other"], json=sh.example_config(w.unit))
    book(client, w, MONDAY, 9)
    book(client, w, MONDAY, 10, nutri=w.other)
    for who in ("reception", "admin"):
        assert len(agenda(client, w.headers[who], MONDAY).json()) == 2
        only = agenda(client, w.headers[who], MONDAY, professional_id=str(w.other.membership_id)).json()
        assert [i["professional_id"] for i in only] == [str(w.other.membership_id)]
    assert agenda(client, w.headers["reception"], MONDAY, professional_id=str(uuid.uuid4())).status_code == 404
    assert agenda(client, w.headers["reception"], MONDAY, professional_id=str(w.reception.membership_id)).status_code == 404


def test_agenda_hides_cancelled_and_keeps_completed_and_no_show(client, configured):
    w = configured
    cancelled = book(client, w, MONDAY, 9)
    client.post(f"/api/v1/schedule/appointments/{cancelled['id']}/cancel", headers=w.headers["reception"], json={"source": "client"})
    book(client, w, MONDAY, 10)
    for hour, status in ((14, "completed"), (15, "no_show")):
        start = at(MONDAY, hour)
        sh.insert_appointment(w.clinic, w.patient, w.nutri.membership_id, w.unit, start, start + timedelta(hours=1), status=status)
    statuses = sorted(i["status"] for i in agenda(client, w.headers["reception"], MONDAY).json())
    assert statuses == ["completed", "no_show", "scheduled"]


def test_agenda_period_filter_and_limits(client, configured):
    w = configured
    book(client, w, MONDAY, 9)
    book(client, w, TUESDAY, 9)
    assert len(agenda(client, w.headers["reception"], MONDAY).json()) == 1
    assert len(agenda(client, w.headers["reception"], MONDAY, TUESDAY).json()) == 2
    assert agenda(client, w.headers["reception"], TUESDAY + timedelta(days=1)).json() == []
    assert agenda(client, w.headers["reception"], MONDAY, MONDAY + timedelta(days=90)).status_code == 422
    assert agenda(client, w.headers["reception"], MONDAY, MONDAY - timedelta(days=1)).status_code == 422


def test_agenda_uses_the_clinic_day_not_utc(client, configured):
    """Uma consulta às 23:00 do horário da clínica já é o dia seguinte em UTC, mas pertence ao dia local."""
    w = configured
    late = at(MONDAY, 23, 0)
    with get_engine().begin() as conn:
        conn.execute(text("alter table appointments disable trigger appointments_enforce_availability"))
    try:
        sh.insert_appointment(w.clinic, w.patient, w.nutri.membership_id, w.unit, late, late + timedelta(minutes=30), status="completed")
    finally:
        with get_engine().begin() as conn:
            conn.execute(text("alter table appointments enable trigger appointments_enforce_availability"))
    assert len(agenda(client, w.headers["reception"], MONDAY).json()) == 1
    assert agenda(client, w.headers["reception"], MONDAY + timedelta(days=1)).json() == []


def test_agenda_is_isolated_by_clinic(client, configured):
    w = configured
    book(client, w, MONDAY, 9)
    foreign = uuid.uuid4()
    with get_engine().begin() as conn:
        conn.execute(text("insert into clinics (id, name) values (:i, 'Outra')"), {"i": foreign})
    try:
        assert len(agenda(client, w.headers["reception"], MONDAY).json()) == 1
    finally:
        with get_engine().begin() as conn:
            conn.execute(text("delete from clinics where id = :i"), {"i": foreign})


def test_patient_created_by_the_form_shows_up_in_the_nutritionist_agenda(client, configured):
    w = configured
    created = client.post("/api/v1/patients", headers=w.headers["reception"], json={
        "full_name": "Camila Nova", "phone": "11987412030", "nutritionist_id": str(w.nutri.membership_id),
        "first_appointment": {"starts_at": iso(MONDAY, 9), "goal": "weight_loss"}})
    assert created.status_code == 201, created.text
    items = agenda(client, w.headers["nutri"], MONDAY).json()
    assert [(i["patient_name"], i["appointment_type"]) for i in items] == [("Camila Nova", "first_consultation")]
    assert sh.local_hhmm(items[0]["starts_at"]) == "09:00"


# ================================================================== lista de pacientes

def test_patient_list_requires_a_staff_role(client, world, make_user, auth_headers):
    assert client.get(PATIENTS).status_code == 401
    for user in (make_user(role="patient"), make_user(role=None)):
        assert client.get(PATIENTS, headers=auth_headers(user)).status_code == 403


def test_patient_list_scope_by_role(client, world):
    w = world
    sh.insert_patient(w.clinic, w.other.membership_id, "Paciente da Nutri Dois")
    assert set(by_name(client.get(PATIENTS, headers=w.headers["nutri"]).json())) == {"Paciente Um"}
    assert set(by_name(client.get(PATIENTS, headers=w.headers["other"]).json())) == {"Paciente da Nutri Dois"}
    for who in ("reception", "admin"):
        assert set(by_name(client.get(PATIENTS, headers=w.headers[who]).json())) == {"Paciente Um", "Paciente da Nutri Dois"}


def test_patient_list_is_isolated_by_clinic_and_hides_deleted(client, world):
    w = world
    foreign = uuid.uuid4()
    with get_engine().begin() as conn:
        conn.execute(text("insert into clinics (id, name) values (:i, 'Outra')"), {"i": foreign})
    try:
        sh.insert_patient(foreign, None, "De Outra Clínica")
        removed = sh.insert_patient(w.clinic, w.nutri.membership_id, "Removido")
        with get_engine().begin() as conn:
            conn.execute(text("update patients set deleted_at = now() where id = :i"), {"i": removed})
        assert set(by_name(client.get(PATIENTS, headers=w.headers["admin"]).json())) == {"Paciente Um"}
    finally:
        with get_engine().begin() as conn:
            conn.execute(text("delete from patients where clinic_id = :i"), {"i": foreign})
            conn.execute(text("delete from clinics where id = :i"), {"i": foreign})


def test_reception_never_receives_clinical_fields(client, configured):
    w = configured
    client.post("/api/v1/patients", headers=w.headers["reception"], json={
        "full_name": "Com Objetivo", "phone": "11987412030", "nutritionist_id": str(w.nutri.membership_id),
        "first_appointment": {"starts_at": iso(MONDAY, 9), "goal": "muscle_gain", "notes": "observação clínica"}})
    body = client.get(PATIENTS, headers=w.headers["reception"])
    assert "goal" not in body.text and "muscle_gain" not in body.text and "observação clínica" not in body.text
    assert all("goal" not in item for item in body.json())
    for who in ("admin", "nutri"):
        item = by_name(client.get(PATIENTS, headers=w.headers[who]).json())["Com Objetivo"]
        assert item["goal"] == "muscle_gain"
        assert "observação clínica" not in str(item)


def test_created_patient_is_listed_as_first_visit_with_the_next_appointment(client, configured):
    w = configured
    client.post("/api/v1/patients", headers=w.headers["reception"], json={
        "full_name": "Camila Nova", "birth_date": "1994-08-18", "sex": "female", "phone": "11987412030",
        "nutritionist_id": str(w.nutri.membership_id), "first_appointment": {"starts_at": iso(MONDAY, 9), "goal": "weight_loss"}})
    item = by_name(client.get(PATIENTS, headers=w.headers["reception"]).json())["Camila Nova"]
    assert item["situation"] == "first_visit" and item["last_consultation_at"] is None
    assert sh.local_hhmm(item["next_appointment_at"]) == "09:00"
    assert item["birth_date"] == "1994-08-18" and item["sex"] == "female" and item["phone"] == "(11) 98741-2030"
    assert item["nutritionist_id"] == str(w.nutri.membership_id)


_lane = iter(range(1, 1000))


def _history(w, name, completed_days_ago=None, upcoming=None, extra=()):
    """Cada paciente ganha um horário próprio (o mesmo nutricionista não pode ter consultas sobrepostas)."""
    lane = (next(_lane) % 6 + 1) * 2
    patient = sh.insert_patient(w.clinic, w.nutri.membership_id, name)
    if completed_days_ago is not None:
        start = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0) - timedelta(days=completed_days_ago, hours=lane)
        sh.insert_appointment(w.clinic, patient, w.nutri.membership_id, w.unit, start, start + timedelta(hours=1), status="completed")
    for days_ago, status in extra:
        start = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0) - timedelta(days=days_ago, hours=lane + 1)
        sh.insert_appointment(w.clinic, patient, w.nutri.membership_id, w.unit, start, start + timedelta(hours=1), status=status)
    if upcoming is not None:  # `upcoming` é o índice do horário (08:00, 09:00, 10:00...)
        first = at(MONDAY, 8) + timedelta(hours=upcoming)
        sh.insert_appointment(w.clinic, patient, w.nutri.membership_id, w.unit, first, first + timedelta(hours=1))
    return patient


def test_situation_is_derived_from_the_history(client, configured):
    w = configured
    _history(w, "Sem consulta")
    _history(w, "Recente", completed_days_ago=10)
    _history(w, "Antigo sem retorno", completed_days_ago=50)
    _history(w, "Antigo com retorno", completed_days_ago=50, upcoming=1)
    _history(w, "Quase alerta", completed_days_ago=44)
    _history(w, "Só faltou", extra=((5, "no_show"), (8, "cancelled")))
    got = {name: item["situation"] for name, item in by_name(client.get(PATIENTS, headers=w.headers["admin"]).json()).items()}
    assert got["Sem consulta"] == "first_visit"
    assert got["Recente"] == "following"
    assert got["Antigo sem retorno"] == "alert"
    assert got["Antigo com retorno"] == "following"
    assert got["Quase alerta"] == "following"
    assert got["Só faltou"] == "first_visit"  # falta e cancelamento não contam como consulta concluída


def test_last_and_next_appointment_dates(client, configured):
    w = configured
    _history(w, "Datas", completed_days_ago=12, upcoming=1)
    item = by_name(client.get(PATIENTS, headers=w.headers["admin"]).json())["Datas"]
    last = datetime.fromisoformat(item["last_consultation_at"])
    assert abs((datetime.now(timezone.utc) - last) - timedelta(days=12)) < timedelta(days=1)
    assert sh.local_hhmm(item["next_appointment_at"]) == "09:00"


def test_patient_list_is_sorted_by_name(client, world):
    for name in ("Zélia", "Ana", "Marcos"):
        sh.insert_patient(world.clinic, world.nutri.membership_id, name)
    names = [item["full_name"] for item in client.get(PATIENTS, headers=world.headers["admin"]).json()]
    assert names == sorted(names, key=str.lower)
