"""Notificações do sino: geradas pelos eventos do catálogo de preferências."""

import uuid
from datetime import datetime, timedelta

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import get_engine
from app.modules.auth.models import Membership
from app.modules.notifications import service as notifications
from app.tests import schedule_helpers as sh
from app.tests.schedule_helpers import TZ, iso, next_weekday

URL = "/api/v1/notifications"
MONDAY = next_weekday(1)
TUESDAY = next_weekday(2)


def book(client, w, day=MONDAY, hour=9, who="reception", kind="return_consultation", patient=None, nutri=None):
    response = client.post("/api/v1/schedule/appointments", headers=w.headers[who], json={
        "patient_id": str(patient or w.patient), "professional_id": str((nutri or w.nutri).membership_id),
        "appointment_type": kind, "starts_at": iso(day, hour)})
    assert response.status_code == 201, response.text
    return response.json()


def feed(client, w, who):
    response = client.get(URL, headers=w.headers[who])
    assert response.status_code == 200, response.text
    return response.json()


def set_events(client, w, who, **events):
    response = client.put("/api/v1/notification-preferences", headers=w.headers[who], json={"events": events})
    assert response.status_code == 200, response.text


# ------------------------------------------------------------------ permissões

def test_only_staff_have_a_bell(client, world, make_user, auth_headers):
    assert client.get(URL).status_code == 401
    for user in (make_user(role="patient"), make_user(role=None)):
        assert client.get(URL, headers=auth_headers(user)).status_code == 403
    for who in ("nutri", "reception", "admin"):
        assert feed(client, world, who) == {"unread_count": 0, "items": []}


# ------------------------------------------------------------------ nova consulta

def test_a_new_appointment_notifies_the_nutritionist_and_the_admin_but_not_who_did_it(client, configured):
    w = configured
    book(client, w, who="reception")
    for who in ("nutri", "admin"):
        data = feed(client, w, who)
        assert data["unread_count"] == 1
        item = data["items"][0]
        assert item["event"] == "appointment_created" and item["kind"] == "created" and item["read"] is False
        assert item["title"] == "Nova consulta agendada"
        assert "Paciente Um" in item["body"] and "Retorno" in item["body"] and "09:00" in item["body"] and "Nutri Um" in item["body"]
        assert item["target_date"] == MONDAY.isoformat() and item["appointment_id"]
    assert feed(client, w, "reception")["items"] == []  # quem agendou não é avisado do próprio ato
    assert feed(client, w, "other")["items"] == []      # outro nutricionista não recebe


def test_admin_booking_notifies_the_reception(client, configured):
    w = configured
    book(client, w, who="admin")
    assert len(feed(client, w, "reception")["items"]) == 1
    assert feed(client, w, "admin")["items"] == []
    assert len(feed(client, w, "nutri")["items"]) == 1


def test_creating_a_patient_notifies_the_first_consultation(client, configured):
    w = configured
    created = client.post("/api/v1/patients", headers=w.headers["reception"], json={
        "full_name": "Camila Nova", "phone": "11987412030", "nutritionist_id": str(w.nutri.membership_id),
        "first_appointment": {"starts_at": iso(MONDAY, 9), "goal": "weight_loss", "notes": "nota clínica sigilosa"}})
    assert created.status_code == 201, created.text
    for who in ("nutri", "admin"):
        body = feed(client, w, who)
        item = body["items"][0]
        assert item["kind"] == "created" and "Camila Nova" in item["body"] and "1ª consulta" in item["body"]
        text_all = str(body)
        assert "nota clínica sigilosa" not in text_all and "weight_loss" not in text_all and "goal" not in text_all


def test_a_failed_booking_creates_no_notification(client, configured):
    w = configured
    book(client, w)
    before = {who: len(feed(client, w, who)["items"]) for who in ("nutri", "admin")}
    denied = client.post("/api/v1/schedule/appointments", headers=w.headers["reception"], json={
        "patient_id": str(w.patient), "professional_id": str(w.nutri.membership_id),
        "appointment_type": "return_consultation", "starts_at": iso(MONDAY, 9)})  # horário ocupado
    assert denied.status_code == 409
    failed_patient = client.post("/api/v1/patients", headers=w.headers["reception"], json={
        "full_name": "Não Criado", "phone": "11987412030", "nutritionist_id": str(w.nutri.membership_id),
        "first_appointment": {"starts_at": iso(MONDAY, 9), "goal": "sports"}})
    assert failed_patient.status_code == 409
    assert {who: len(feed(client, w, who)["items"]) for who in ("nutri", "admin")} == before


def test_unconfigured_professional_creates_no_notification(client, world):
    response = client.post("/api/v1/schedule/appointments", headers=world.headers["reception"], json={
        "patient_id": str(world.patient), "professional_id": str(world.nutri.membership_id),
        "appointment_type": "return_consultation", "starts_at": iso(MONDAY, 9)})
    assert response.status_code == 409
    assert feed(client, world, "admin")["items"] == []


# ------------------------------------------------------------------ preferências

def test_disabled_event_is_not_delivered_and_re_enabling_works(client, configured):
    w = configured
    set_events(client, w, "nutri", appointment_created=False)
    book(client, w, hour=9)
    assert feed(client, w, "nutri")["items"] == []
    assert len(feed(client, w, "admin")["items"]) == 1  # cada um decide por si
    set_events(client, w, "nutri", appointment_created=True)
    book(client, w, hour=11)
    assert len(feed(client, w, "nutri")["items"]) == 1


def test_disabling_does_not_erase_what_already_arrived(client, configured):
    w = configured
    book(client, w)
    set_events(client, w, "nutri", appointment_created=False)
    assert len(feed(client, w, "nutri")["items"]) == 1


def test_cancellation_event_is_independent_of_creation(client, configured):
    w = configured
    set_events(client, w, "admin", appointment_cancelled=False)
    booked = book(client, w)
    client.post(f"/api/v1/schedule/appointments/{booked['id']}/cancel", headers=w.headers["reception"], json={"source": "client"})
    assert [i["kind"] for i in feed(client, w, "admin")["items"]] == ["created"]
    assert sorted(i["kind"] for i in feed(client, w, "nutri")["items"]) == ["cancelled", "created"]


def test_inactive_members_are_not_notified(client, configured):
    w = configured
    client.patch(f"/api/v1/team/{w.reception.membership_id}", headers=w.headers["admin"], json={"active": False})
    book(client, w, who="admin")
    with get_engine().begin() as conn:
        assert conn.execute(text("select count(*) from notifications where membership_id = :m"), {"m": w.reception.membership_id}).scalar() == 0


# ------------------------------------------------------------------ remarcar e cancelar

def test_reschedule_notifies_with_old_and_new_time(client, configured):
    w = configured
    booked = book(client, w, MONDAY, 9)
    response = client.post(f"/api/v1/schedule/appointments/{booked['id']}/reschedule", headers=w.headers["reception"], json={"starts_at": iso(TUESDAY, 10)})
    assert response.status_code == 200
    item = feed(client, w, "nutri")["items"][0]
    assert item["event"] == "appointment_cancelled" and item["kind"] == "rescheduled" and item["title"] == "Consulta remarcada"
    assert " de " in item["body"] and "09:00" in item["body"] and "10:00" in item["body"] and item["target_date"] == TUESDAY.isoformat()
    assert feed(client, w, "reception")["items"] == []


@pytest.mark.parametrize("source, label", [("client", "pelo paciente"), ("internal", "pela clínica")])
def test_cancellation_notifies_with_the_source(client, configured, source, label):
    w = configured
    booked = book(client, w)
    client.post(f"/api/v1/schedule/appointments/{booked['id']}/cancel", headers=w.headers["reception"], json={"source": source})
    item = feed(client, w, "nutri")["items"][0]
    assert item["kind"] == "cancelled" and item["title"] == "Consulta cancelada" and label in item["body"]


def test_cancellation_with_a_hold_notifies_once(client, configured):
    w = configured
    booked = book(client, w)
    client.post(f"/api/v1/schedule/appointments/{booked['id']}/cancel", headers=w.headers["reception"], json={"source": "internal", "keep_slot_unavailable": True})
    assert [i["kind"] for i in feed(client, w, "admin")["items"]] == ["cancelled", "created"]


# ------------------------------------------------------------------ ler e marcar

def test_unread_count_read_one_and_read_all(client, configured):
    w = configured
    book(client, w, hour=9)
    book(client, w, hour=11)
    data = feed(client, w, "nutri")
    assert data["unread_count"] == 2 and [i["read"] for i in data["items"]] == [False, False]
    first = data["items"][0]["id"]
    assert client.post(f"{URL}/{first}/read", headers=w.headers["nutri"]).status_code == 204
    assert client.post(f"{URL}/{first}/read", headers=w.headers["nutri"]).status_code == 204  # idempotente
    data = feed(client, w, "nutri")
    assert data["unread_count"] == 1 and sum(i["read"] for i in data["items"]) == 1
    assert client.post(f"{URL}/read-all", headers=w.headers["nutri"]).status_code == 204
    data = feed(client, w, "nutri")
    assert data["unread_count"] == 0 and all(i["read"] for i in data["items"])
    assert feed(client, w, "admin")["unread_count"] == 2  # os avisos do admin são dele


def test_newest_first_and_limit(client, configured):
    w = configured
    for hour in (9, 10, 11):
        book(client, w, hour=hour)
    bodies = [i["body"] for i in feed(client, w, "nutri")["items"]]
    assert "11:00" in bodies[0] and "09:00" in bodies[-1]
    assert len(client.get(URL, headers=w.headers["nutri"], params={"limit": 2}).json()["items"]) == 2
    assert client.get(URL, headers=w.headers["nutri"], params={"limit": 0}).status_code == 422
    assert client.get(URL, headers=w.headers["nutri"], params={"limit": 51}).status_code == 422


def test_nobody_reads_or_marks_someone_elses_notification(client, configured):
    w = configured
    book(client, w)
    mine = feed(client, w, "nutri")["items"][0]["id"]
    for who in ("admin", "reception", "other"):
        assert client.post(f"{URL}/{mine}/read", headers=w.headers[who]).status_code == 404
    assert feed(client, w, "nutri")["unread_count"] == 1
    assert client.post(f"{URL}/{uuid.uuid4()}/read", headers=w.headers["nutri"]).status_code == 404
    # marcar tudo só afeta os próprios
    client.post(f"{URL}/read-all", headers=w.headers["admin"])
    assert feed(client, w, "nutri")["unread_count"] == 1


def test_notifications_are_isolated_by_clinic(client, configured):
    w = configured
    book(client, w)
    foreign = uuid.uuid4()
    with get_engine().begin() as conn:
        conn.execute(text("insert into clinics (id, name) values (:i, 'Outra')"), {"i": foreign})
    try:
        with get_engine().begin() as conn:
            assert conn.execute(text("select count(*) from notifications where clinic_id = :c"), {"c": foreign}).scalar() == 0
        assert feed(client, w, "admin")["unread_count"] == 1
    finally:
        with get_engine().begin() as conn:
            conn.execute(text("delete from clinics where id = :i"), {"i": foreign})


def test_table_is_locked_for_public_roles(client, world):
    with get_engine().begin() as conn:
        assert conn.execute(text("select relrowsecurity from pg_class where relname = 'notifications'")).scalar() is True
        assert conn.execute(text("select has_table_privilege('anon', 'notifications', 'select') or has_table_privilege('authenticated', 'notifications', 'select')")).scalar() is False


# ------------------------------------------------------------------ resumo diário (sob demanda)

def _actor(w, user):
    with Session(get_engine()) as db:
        return db.get(Membership, user.membership_id)


def _feed_at(w, user, when):
    with Session(get_engine()) as db:
        actor = db.get(Membership, user.membership_id)
        return notifications.list_notifications(db, actor, now=when)


def local(day, hour, minute=0):
    return datetime(day.year, day.month, day.day, hour, minute, tzinfo=TZ)


def test_daily_summary_is_off_by_default(client, configured):
    w = configured
    book(client, w)
    assert _feed_at(w, w.nutri, local(MONDAY, 8)).items[0].event == "appointment_created"
    assert all(i.event != "daily_summary" for i in _feed_at(w, w.nutri, local(MONDAY, 8)).items)


def test_daily_summary_is_created_once_after_0730_when_enabled(client, configured):
    w = configured
    set_events(client, w, "nutri", daily_summary=True)
    book(client, w, MONDAY, 9)
    book(client, w, MONDAY, 14)
    assert not [i for i in _feed_at(w, w.nutri, local(MONDAY, 7, 29)).items if i.event == "daily_summary"]
    data = _feed_at(w, w.nutri, local(MONDAY, 7, 30))
    summary = [i for i in data.items if i.event == "daily_summary"]
    assert len(summary) == 1 and summary[0].title == "Resumo da agenda de hoje"
    assert "2 consultas hoje" in summary[0].body and "09:00" in summary[0].body and "Paciente Um" in summary[0].body
    assert summary[0].target_date == MONDAY
    # Abrir de novo (ou em outro momento do dia) não duplica.
    again = _feed_at(w, w.nutri, local(MONDAY, 15))
    assert len([i for i in again.items if i.event == "daily_summary"]) == 1
    # No dia seguinte nasce outro (se houver consultas).
    book(client, w, TUESDAY, 9)
    tomorrow = _feed_at(w, w.nutri, local(TUESDAY, 8))
    assert len([i for i in tomorrow.items if i.event == "daily_summary"]) == 2


def test_daily_summary_scope_and_counts(client, configured):
    w = configured
    client.put(f"/api/v1/schedule/professionals/{w.other.membership_id}/config", headers=w.headers["other"], json=sh.example_config(w.unit))
    for who in ("nutri", "admin", "reception"):
        set_events(client, w, who, daily_summary=True)
    book(client, w, MONDAY, 9)
    book(client, w, MONDAY, 10, nutri=w.other)
    nutri = [i for i in _feed_at(w, w.nutri, local(MONDAY, 8)).items if i.event == "daily_summary"][0]
    assert "1 consulta hoje." in nutri.body and "clínica" not in nutri.body
    for user in (w.admin, w.reception):
        summary = [i for i in _feed_at(w, user, local(MONDAY, 8)).items if i.event == "daily_summary"][0]
        assert "2 consultas hoje na clínica" in summary.body


def test_daily_summary_is_skipped_without_appointments_and_ignores_cancelled(client, configured):
    w = configured
    set_events(client, w, "nutri", daily_summary=True)
    assert not [i for i in _feed_at(w, w.nutri, local(MONDAY, 9)).items if i.event == "daily_summary"]
    booked = book(client, w)
    client.post(f"/api/v1/schedule/appointments/{booked['id']}/cancel", headers=w.headers["reception"], json={"source": "client"})
    assert not [i for i in _feed_at(w, w.nutri, local(MONDAY, 9)).items if i.event == "daily_summary"]


def test_daily_summary_uses_the_clinic_day(client, configured):
    """23:30 em São Paulo já é o dia seguinte em UTC: o resumo continua sendo do dia local."""
    w = configured
    set_events(client, w, "nutri", daily_summary=True)
    book(client, w, MONDAY, 9)
    utc_late = local(MONDAY, 23, 30).astimezone(datetime.now().astimezone().tzinfo)
    summary = [i for i in _feed_at(w, w.nutri, utc_late).items if i.event == "daily_summary"]
    assert len(summary) == 1 and summary[0].target_date == MONDAY


def test_daily_summary_never_leaks_clinical_data(client, configured):
    w = configured
    set_events(client, w, "admin", daily_summary=True)
    client.post("/api/v1/patients", headers=w.headers["reception"], json={
        "full_name": "Com Objetivo", "phone": "11987412030", "nutritionist_id": str(w.nutri.membership_id),
        "first_appointment": {"starts_at": iso(MONDAY, 9), "goal": "muscle_gain", "notes": "obs clínica"}})
    text_all = str(_feed_at(w, w.admin, local(MONDAY, 8)))
    assert "obs clínica" not in text_all and "muscle_gain" not in text_all
