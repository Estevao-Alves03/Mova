"""Cadastro de paciente + 1ª consulta (`POST /patients`): permissões, validação e atomicidade."""

import uuid
from datetime import timedelta

import pytest
from sqlalchemy import text

from app.db.session import get_engine
from app.tests import schedule_helpers as sh
from app.tests.schedule_helpers import iso, next_weekday

URL = "/api/v1/patients"
MONDAY = next_weekday(1)
TUESDAY = next_weekday(2)
WEDNESDAY = next_weekday(3)


def cfg_url(user) -> str:
    return f"/api/v1/schedule/professionals/{user.membership_id}/config"


def payload(w, day=MONDAY, hour=9, minute=0, **overrides):
    body = {
        "full_name": "Camila Vasconcellos",
        "birth_date": "1994-08-18",
        "sex": "female",
        "phone": "(11) 98741-2030",
        "email": "camila@email.com",
        "nutritionist_id": str(w.nutri.membership_id),
        "first_appointment": {"starts_at": iso(day, hour, minute), "goal": "weight_loss", "notes": "Busco perda de peso sustentável."},
    }
    body.update(overrides)
    return body


def create(client, w, who="reception", **kwargs):
    return client.post(URL, headers=w.headers[who], json=payload(w, **kwargs))


def counts(w) -> tuple[int, int]:
    with get_engine().begin() as conn:
        patients = conn.execute(text("select count(*) from patients where clinic_id = :c"), {"c": w.clinic}).scalar()
        appointments = conn.execute(text("select count(*) from appointments where clinic_id = :c"), {"c": w.clinic}).scalar()
    return patients, appointments


def slots(client, w, first, kind="first_consultation"):
    response = client.get("/api/v1/schedule/availability", headers=w.headers["reception"], params={
        "professional_id": str(w.nutri.membership_id), "appointment_type": kind, "from": first.isoformat(), "to": first.isoformat()})
    return [sh.local_hhmm(s["starts_at"]) for s in response.json()["slots"]]


# ------------------------------------------------------------------ permissões

def test_only_reception_and_admin_create_patients(client, configured, make_user, auth_headers):
    w = configured
    before = counts(w)
    patient_user = auth_headers(make_user(role="patient"))
    outsider = auth_headers(make_user(role=None))
    assert client.post(URL, headers=w.headers["nutri"], json=payload(w)).status_code == 403
    assert client.post(URL, headers=w.headers["other"], json=payload(w)).status_code == 403
    assert client.post(URL, headers=patient_user, json=payload(w)).status_code == 403
    assert client.post(URL, headers=outsider, json=payload(w)).status_code == 403
    assert client.post(URL, json=payload(w)).status_code == 401
    assert counts(w) == before  # nada foi criado


@pytest.mark.parametrize("who", ["reception", "admin"])
def test_reception_and_admin_can_create(client, configured, who):
    response = create(client, configured, who=who)
    assert response.status_code == 201, response.text


# ------------------------------------------------------------------ sucesso

def test_creates_patient_and_first_consultation_together(client, configured):
    w = configured
    response = create(client, w, full_name="  Camila   Vasconcellos ", phone="11987412030", email=" Camila@Email.COM ")
    assert response.status_code == 201, response.text
    body = response.json()

    patient = body["patient"]
    assert patient["full_name"] == "Camila Vasconcellos"
    assert patient["phone"] == "(11) 98741-2030" and patient["email"] == "camila@email.com"
    assert patient["sex"] == "female" and patient["birth_date"] == "1994-08-18"
    assert patient["nutritionist_id"] == str(w.nutri.membership_id)

    appointment = body["appointment"]
    assert appointment["appointment_type"] == "first_consultation" and appointment["status"] == "scheduled"
    assert appointment["patient_id"] == patient["id"] and appointment["professional_id"] == str(w.nutri.membership_id)
    assert appointment["unit_id"] == str(w.unit)

    with get_engine().begin() as conn:
        row = conn.execute(text("select clinic_id, created_by, deleted_at from patients where id = :i"), {"i": patient["id"]}).one()
        assert row.clinic_id == w.clinic and row.created_by == w.reception.membership_id and row.deleted_at is None
        appt = conn.execute(text("select starts_at, ends_at, goal, initial_notes, created_by from appointments where id = :i"),
                            {"i": appointment["id"]}).one()
    assert appt.ends_at - appt.starts_at == timedelta(minutes=90)  # duração configurada para a 1ª consulta
    assert appt.goal == "weight_loss" and appt.initial_notes == "Busco perda de peso sustentável."
    assert appt.created_by == w.reception.membership_id


def test_clinical_fields_are_never_returned(client, configured):
    text_body = create(client, configured).text
    assert "goal" not in text_body and "initial_notes" not in text_body and "Busco perda de peso" not in text_body


def test_the_booked_slot_leaves_the_availability(client, configured):
    w = configured
    assert "09:00" in slots(client, w, MONDAY)
    create(client, w)
    got = slots(client, w, MONDAY)
    assert "09:00" not in got and "10:00" not in got and "08:30" not in got  # 1ª consulta ocupa 90 min


def test_optional_fields_can_be_omitted(client, configured):
    body = payload(configured)
    for key in ("birth_date", "sex", "email"):
        body.pop(key)
    body["first_appointment"].pop("notes")
    response = client.post(URL, headers=configured.headers["reception"], json=body)
    assert response.status_code == 201, response.text
    patient = response.json()["patient"]
    assert patient["sex"] is None and patient["birth_date"] is None and patient["email"] is None
    with get_engine().begin() as conn:
        assert conn.execute(text("select initial_notes from appointments where id = :i"), {"i": response.json()["appointment"]["id"]}).scalar() is None


def test_blank_optional_fields_become_null(client, configured):
    response = create(client, configured, email="  ", sex=None,
                      first_appointment={"starts_at": iso(MONDAY, 9), "goal": "other", "notes": "   "})
    assert response.status_code == 201, response.text
    assert response.json()["patient"]["email"] is None
    with get_engine().begin() as conn:
        assert conn.execute(text("select initial_notes from appointments where id = :i"), {"i": response.json()["appointment"]["id"]}).scalar() is None


@pytest.mark.parametrize("goal", ["weight_loss", "muscle_gain", "healthy_eating", "clinical", "sports", "other"])
def test_every_goal_is_accepted(client, configured, goal):
    response = create(client, configured, first_appointment={"starts_at": iso(MONDAY, 9), "goal": goal})
    assert response.status_code == 201


def test_room_of_the_slot_unit_is_accepted(client, configured):
    room = sh.insert_room(configured.clinic, configured.unit)
    response = create(client, configured, first_appointment={"starts_at": iso(MONDAY, 9), "goal": "sports", "room_id": str(room)})
    assert response.status_code == 201 and response.json()["appointment"]["room_id"] == str(room)


# ------------------------------------------------------------------ nutricionista responsável

def test_nutritionist_is_required(client, configured):
    body = payload(configured)
    body.pop("nutritionist_id")
    assert client.post(URL, headers=configured.headers["reception"], json=body).status_code == 422
    assert counts(configured) == (1, 0)  # só o paciente do fixture


def test_invalid_nutritionists_are_rejected_with_the_field(client, configured, make_user):
    w = configured
    foreign_clinic = uuid.uuid4()
    with get_engine().begin() as conn:
        conn.execute(text("insert into clinics (id, name) values (:i, 'Outra')"), {"i": foreign_clinic})
        foreign_user = uuid.uuid4()
        foreign_member = uuid.uuid4()
        conn.execute(text("insert into auth.users (id, instance_id, aud, role, email) values "
                          "(:u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', :e)"),
                     {"u": foreign_user, "e": f"alheio-{foreign_user.hex[:8]}@mova.test"})
        conn.execute(text("insert into memberships (id, clinic_id, user_id, role, full_name) values (:i, :c, :u, 'nutritionist', 'Alheio')"),
                     {"i": foreign_member, "c": foreign_clinic, "u": foreign_user})
    try:
        inactive = w.other.membership_id
        with get_engine().begin() as conn:
            conn.execute(text("update memberships set active = false where id = :i"), {"i": inactive})
        before = counts(w)
        for bad in (uuid.uuid4(), w.reception.membership_id, w.admin.membership_id, foreign_member, inactive):
            response = client.post(URL, headers=w.headers["reception"], json=payload(w, nutritionist_id=str(bad)))
            assert response.status_code == 422, bad
            assert response.json()["detail"][0]["loc"][-1] == "nutritionist_id"
        assert counts(w) == before
    finally:
        with get_engine().begin() as conn:
            conn.execute(text("delete from memberships where id = :i"), {"i": foreign_member})
            conn.execute(text("delete from clinics where id = :i"), {"i": foreign_clinic})
            conn.execute(text("delete from auth.users where id = :u"), {"u": foreign_user})


def test_patient_is_assigned_to_the_chosen_nutritionist(client, configured):
    w = configured
    client.put(cfg_url(w.other), headers=w.headers["other"], json=sh.example_config(w.unit))
    response = create(client, w, nutritionist_id=str(w.other.membership_id))
    assert response.status_code == 201
    assert response.json()["patient"]["nutritionist_id"] == str(w.other.membership_id)
    assert response.json()["appointment"]["professional_id"] == str(w.other.membership_id)


# ------------------------------------------------------------------ atomicidade e disponibilidade

def test_unconfigured_nutritionist_blocks_the_whole_creation(client, world):
    before = counts(world)
    response = create(client, world)
    assert response.status_code == 409 and response.json()["detail"]["code"] == "schedule_not_configured"
    assert counts(world) == before


@pytest.mark.parametrize(
    "day, hour, minute, status, code",
    [
        (MONDAY, 7, 0, 422, "outside_working_hours"),
        (MONDAY, 12, 0, 422, "lunch"),
        (MONDAY, 11, 0, 422, "lunch"),  # 90 min invade o almoço
        (WEDNESDAY, 9, 0, 422, "outside_working_hours"),
        (MONDAY, 9, 15, 422, "off_grid"),
    ],
)
def test_invalid_slot_creates_nothing(client, configured, day, hour, minute, status, code):
    before = counts(configured)
    response = create(client, configured, day=day, hour=hour, minute=minute)
    assert response.status_code == status and response.json()["detail"]["code"] == code
    assert counts(configured) == before


def test_past_slot_creates_nothing(client, configured):
    before = counts(configured)
    response = create(client, configured, day=sh.next_weekday(1, min_days=-7))
    assert response.json()["detail"]["code"] == "past"
    assert counts(configured) == before


def test_blocked_slot_creates_nothing(client, configured):
    w = configured
    client.post(f"/api/v1/schedule/professionals/{w.nutri.membership_id}/blocks", headers=w.headers["nutri"],
                json={"kind": "time_block", "date": MONDAY.isoformat(), "start_time": "09:00", "end_time": "10:00"})
    before = counts(w)
    response = create(client, w)
    assert response.json()["detail"]["code"] == "blocked"
    assert counts(w) == before


def test_taken_slot_creates_no_patient(client, configured):
    w = configured
    assert create(client, w).status_code == 201
    before = counts(w)
    response = create(client, w, full_name="Outra Pessoa")
    assert response.status_code == 409 and response.json()["detail"]["code"] == "slot_taken"
    assert counts(w) == before
    with get_engine().begin() as conn:
        assert conn.execute(text("select count(*) from patients where full_name = 'Outra Pessoa' and clinic_id = :c"), {"c": w.clinic}).scalar() == 0


def test_invalid_room_creates_nothing(client, configured):
    w = configured
    other_unit = sh.insert_unit(w.clinic, "Outra unidade")
    wrong = sh.insert_room(w.clinic, other_unit)
    before = counts(w)
    for room in (str(wrong), str(uuid.uuid4())):
        response = create(client, w, first_appointment={"starts_at": iso(MONDAY, 9), "goal": "sports", "room_id": room})
        assert response.status_code == 422 and response.json()["detail"][0]["loc"][-1] == "room_id"
    assert counts(w) == before


# ------------------------------------------------------------------ validação

@pytest.mark.parametrize(
    "field, value",
    [
        ("full_name", "A"),
        ("full_name", "x" * 121),
        ("full_name", "   "),
        ("phone", "123"),
        ("phone", "(11) 1234-56789"),
        ("phone", "11123456789"),      # celular sem o 9
        ("phone", ""),
        ("email", "sem-arroba"),
        ("email", "a@b"),
        ("birth_date", "2999-01-01"),
        ("birth_date", "1800-01-01"),
        ("birth_date", "31/02/1994"),
        ("sex", "other"),
        ("sex", "unspecified"),
    ],
)
def test_invalid_fields_are_rejected(client, configured, field, value):
    before = counts(configured)
    response = client.post(URL, headers=configured.headers["reception"], json=payload(configured, **{field: value}))
    assert response.status_code == 422, response.text
    assert counts(configured) == before


@pytest.mark.parametrize(
    "first",
    [
        {"goal": "weight_loss"},                                              # sem horário
        {"starts_at": "2030-01-07T09:00:00", "goal": "weight_loss"},          # sem fuso
        {"starts_at": "2030-01-07T09:00:00-03:00"},                           # sem objetivo
        {"starts_at": "2030-01-07T09:00:00-03:00", "goal": "nope"},
        {"starts_at": "2030-01-07T09:00:00-03:00", "goal": "sports", "notes": "x" * 301},
        {"starts_at": "2030-01-07T09:00:00-03:00", "goal": "sports", "appointment_type": "return_consultation"},
        {"starts_at": "2030-01-07T09:00:00-03:00", "goal": "sports", "professional_id": str(uuid.uuid4())},
        {"starts_at": "2030-01-07T09:00:00-03:00", "goal": "sports", "status": "completed"},
    ],
)
def test_invalid_first_appointment_is_rejected(client, configured, first):
    before = counts(configured)
    response = client.post(URL, headers=configured.headers["reception"], json=payload(configured, first_appointment=first))
    assert response.status_code == 422, response.text
    assert counts(configured) == before


def test_first_appointment_is_required(client, configured):
    body = payload(configured)
    body.pop("first_appointment")
    assert client.post(URL, headers=configured.headers["reception"], json=body).status_code == 422


@pytest.mark.parametrize("extra", [{"clinic_id": str(uuid.uuid4())}, {"created_by": str(uuid.uuid4())}, {"id": str(uuid.uuid4())},
                                   {"user_id": str(uuid.uuid4())}, {"deleted_at": "2020-01-01T00:00:00Z"}, {"cpf": "12345678901"},
                                   {"preferred_contact_channel": "whatsapp"}])
def test_protected_and_unknown_fields_are_rejected(client, configured, extra):
    before = counts(configured)
    response = client.post(URL, headers=configured.headers["reception"], json={**payload(configured), **extra})
    assert response.status_code == 422
    assert counts(configured) == before


def test_notes_accept_exactly_300_characters(client, configured):
    response = create(client, configured, first_appointment={"starts_at": iso(MONDAY, 9), "goal": "other", "notes": "x" * 300})
    assert response.status_code == 201


# ------------------------------------------------------------------ dados que a etapa 2 consome

def test_units_come_with_address_and_only_active_rooms(client, world):
    active = sh.insert_room(world.clinic, world.unit, "Sala 01")
    inactive = sh.insert_room(world.clinic, world.unit, "Sala 02")
    with get_engine().begin() as conn:
        conn.execute(text("update rooms set active = false where id = :i"), {"i": inactive})
        conn.execute(text("update units set address = 'Alameda Santos, 1470' where id = :i"), {"i": world.unit})
    units = client.get("/api/v1/schedule/units", headers=world.headers["reception"]).json()
    unit = next(u for u in units if u["id"] == str(world.unit))
    assert unit["address"] == "Alameda Santos, 1470"
    assert [r["id"] for r in unit["rooms"]] == [str(active)]


def test_professionals_come_with_crn_and_specialty(client, clinic, make_user, auth_headers):
    reception = make_user(role="receptionist")
    nutri = make_user(role="nutritionist", full_name="Dra. Ana", crn="CRN-3 52140", specialty="Clínica & Esportiva")
    headers = auth_headers(reception)
    professional = next(p for p in client.get("/api/v1/schedule/professionals", headers=headers).json() if p["id"] == str(nutri.membership_id))
    assert professional["crn"] == "CRN-3 52140" and professional["specialty"] == "Clínica & Esportiva"
