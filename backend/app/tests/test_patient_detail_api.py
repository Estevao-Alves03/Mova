"""Perfil do paciente (`GET /patients/{id}`): escopo por papel e recorte dos dados clínicos."""

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import text

from app.db.session import get_engine
from app.tests import schedule_helpers as sh

PATIENTS = "/api/v1/patients"
NOW = datetime.now(timezone.utc)
MONDAY = sh.next_weekday(1)

BASIC_KEYS = {"id", "full_name", "birth_date", "sex", "phone", "email", "created_at", "nutritionist", "unit", "situation"}
CLINICAL_KEYS = BASIC_KEYS | {"goal", "initial_notes", "last_consultation_at", "next_appointment_at", "timeline"}


def detail(client, headers, patient_id):
    return client.get(f"{PATIENTS}/{patient_id}", headers=headers)


def past_or_closed(w, patient, days, status="completed", kind="return_consultation", unit=None):
    """Consulta que não ocupa a agenda (concluída ou cancelada): entra direto, sem passar pela trava de disponibilidade."""
    start = NOW + timedelta(days=days)
    return sh.insert_appointment(
        w.clinic, patient, w.nutri.membership_id, unit or w.unit, start, start + timedelta(hours=1),
        status=status, appointment_type=kind,
    )


def book(client, w, hour=9, day=MONDAY, patient=None):
    """Consulta futura ativa: só pela API, que valida a disponibilidade."""
    response = client.post("/api/v1/schedule/appointments", headers=w.headers["reception"], json={
        "patient_id": str(patient or w.patient), "professional_id": str(w.nutri.membership_id),
        "appointment_type": "return_consultation", "starts_at": sh.iso(day, hour)})
    assert response.status_code == 201, response.text
    return uuid.UUID(response.json()["id"])


def set_first_consultation_info(appointment_id, goal="muscle_gain", notes="Observação inicial reservada"):
    with get_engine().begin() as conn:
        conn.execute(
            text("update appointments set goal = cast(:g as consultation_goal), initial_notes = :n where id = :i"),
            {"g": goal, "n": notes, "i": appointment_id},
        )


def test_requires_a_staff_role(client, world, make_user, auth_headers):
    w = world
    assert client.get(f"{PATIENTS}/{w.patient}").status_code == 401
    for user in (make_user(role="patient"), make_user(role=None)):
        assert detail(client, auth_headers(user), w.patient).status_code == 403


def test_reception_gets_only_registration_nutritionist_and_unit(client, configured):
    w = configured
    first = past_or_closed(w, w.patient, -30, kind="first_consultation")
    set_first_consultation_info(first)
    book(client, w)

    response = detail(client, w.headers["reception"], w.patient)
    assert response.status_code == 200, response.text
    body = response.json()
    assert set(body) == BASIC_KEYS
    assert body["full_name"] == "Paciente Um"
    assert body["nutritionist"]["id"] == str(w.nutri.membership_id) and body["nutritionist"]["full_name"] == "Nutri Um"
    assert body["unit"] == {"id": str(w.unit), "name": "Unidade Teste"}
    assert body["situation"] == "following"
    # Nada de consultas, metas ou dados clínicos, nem como texto.
    for forbidden in ("goal", "initial_notes", "timeline", "muscle_gain", "Observação inicial reservada", "next_appointment_at"):
        assert forbidden not in response.text


def test_nutritionist_and_admin_get_goal_notes_and_timeline(client, configured):
    w = configured
    first = past_or_closed(w, w.patient, -30, kind="first_consultation")
    set_first_consultation_info(first)
    upcoming = book(client, w)
    past_or_closed(w, w.patient, 20, status="cancelled")

    for who in ("nutri", "admin"):
        response = detail(client, w.headers[who], w.patient)
        assert response.status_code == 200, response.text
        body = response.json()
        assert set(body) == CLINICAL_KEYS
        assert body["goal"] == "muscle_gain" and body["initial_notes"] == "Observação inicial reservada"
        assert body["last_consultation_at"] is not None and body["next_appointment_at"] is not None
        # Cancelada não entra; o resto vem da mais antiga para a mais recente.
        assert [item["id"] for item in body["timeline"]] == [str(first), str(upcoming)]
        assert [item["status"] for item in body["timeline"]] == ["completed", "scheduled"]


def test_new_patient_without_history_has_no_unit_and_first_visit_situation(client, world):
    w = world
    for who in ("reception", "nutri", "admin"):
        body = detail(client, w.headers[who], w.patient).json()
        assert body["unit"] is None and body["situation"] == "first_visit"
    clinical = detail(client, w.headers["nutri"], w.patient).json()
    assert clinical["goal"] is None and clinical["timeline"] == []


def test_situation_follows_the_history(client, world):
    w = world
    old = sh.insert_patient(w.clinic, w.nutri.membership_id, "Paciente Antigo")
    past_or_closed(w, old, -60)
    assert detail(client, w.headers["admin"], old).json()["situation"] == "alert"


def test_unit_comes_from_the_next_active_appointment_else_the_latest(client, configured):
    w = configured
    other_unit = sh.insert_unit(w.clinic, "Outra Unidade")
    sh.link_nutritionist(w.clinic, other_unit, w.nutri.membership_id)
    past_or_closed(w, w.patient, -60, unit=other_unit)
    past_or_closed(w, w.patient, -30, unit=w.unit)
    # Só histórico: a unidade da consulta mais recente.
    assert detail(client, w.headers["reception"], w.patient).json()["unit"]["name"] == "Unidade Teste"

    # Com consulta futura ativa em outra unidade, é a dela.
    config = sh.example_config(other_unit)
    assert client.put(f"/api/v1/schedule/professionals/{w.nutri.membership_id}/config", headers=w.headers["nutri"], json=config).status_code == 200
    book(client, w)
    assert detail(client, w.headers["reception"], w.patient).json()["unit"] == {"id": str(other_unit), "name": "Outra Unidade"}


def test_nutritionist_never_reaches_another_nutritionists_patient(client, world):
    w = world
    foreign = sh.insert_patient(w.clinic, w.other.membership_id, "Paciente do Outro")
    missing = uuid.uuid4()
    denied = detail(client, w.headers["nutri"], foreign)
    absent = detail(client, w.headers["nutri"], missing)
    # Mesma resposta para "é de outro" e "não existe": não revela que o paciente existe.
    assert denied.status_code == absent.status_code == 404
    assert denied.json() == absent.json()
    assert "Paciente do Outro" not in denied.text
    # Quem é da clínica toda continua alcançando.
    assert detail(client, w.headers["admin"], foreign).status_code == 200
    assert detail(client, w.headers["reception"], foreign).status_code == 200


def test_other_clinic_and_deleted_patients_are_404(client, world, make_user, auth_headers):
    w = world
    with get_engine().begin() as conn:
        other_clinic = uuid.uuid4()
        conn.execute(text("insert into clinics (id, name) values (:i, 'Outra Clínica')"), {"i": other_clinic})
    try:
        foreign = sh.insert_patient(other_clinic, None, "Paciente de Fora")
        for who in ("reception", "nutri", "admin"):
            assert detail(client, w.headers[who], foreign).status_code == 404

        gone = sh.insert_patient(w.clinic, w.nutri.membership_id, "Paciente Excluído")
        with get_engine().begin() as conn:
            conn.execute(text("update patients set deleted_at = now() where id = :i"), {"i": gone})
        for who in ("reception", "nutri", "admin"):
            assert detail(client, w.headers[who], gone).status_code == 404
    finally:
        with get_engine().begin() as conn:
            conn.execute(text("delete from patients where clinic_id = :c"), {"c": other_clinic})
            conn.execute(text("delete from clinics where id = :c"), {"c": other_clinic})


def test_invalid_id_is_rejected(client, world):
    assert detail(client, world.headers["admin"], "nao-e-um-id").status_code == 422
    # "/search" continua sendo a busca, não um id.
    assert client.get(f"{PATIENTS}/search", headers=world.headers["admin"], params={"q": "Paciente"}).status_code == 200
