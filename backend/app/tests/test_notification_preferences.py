import pytest
from sqlalchemy import text

from app.db.session import get_engine

URL = "/api/v1/notification-preferences"
PATIENT_URL = "/api/v1/me/notification-preferences"

EVENTS = {
    "admin": ["appointment_created", "appointment_cancelled", "appointment_confirmed", "reevaluation_due", "daily_summary"],
    "receptionist": ["appointment_created", "appointment_cancelled", "appointment_confirmed", "daily_summary"],
    "nutritionist": ["appointment_created", "appointment_cancelled", "reevaluation_due", "daily_summary"],
}
SOUNDS = {
    "admin": ["new_appointment", "upcoming_appointment", "reception_checkin"],
    "receptionist": ["new_appointment", "reception_checkin"],
    "nutritionist": ["new_appointment", "upcoming_appointment"],
}


def test_requires_authentication(client):
    assert client.get(URL).status_code == 401
    assert client.put(URL, json={}).status_code == 401
    assert client.get(PATIENT_URL).status_code == 401


def test_without_membership_is_403(client, make_user, auth_headers):
    headers = auth_headers(make_user(role=None))
    assert client.get(URL, headers=headers).status_code == 403


@pytest.mark.parametrize("role", ["admin", "receptionist", "nutritionist"])
def test_catalog_and_defaults_depend_on_the_role(client, make_user, auth_headers, role):
    body = client.get(URL, headers=auth_headers(make_user(role=role))).json()
    assert body["catalog"]["events"] == EVENTS[role]
    assert [slot["id"] for slot in body["catalog"]["sounds"]] == SOUNDS[role]
    assert list(body["preferences"]["events"]) == EVENTS[role]
    assert list(body["preferences"]["sounds"]) == SOUNDS[role]
    assert body["preferences"] == body["defaults"]  # nada gravado ainda
    assert body["preferences"]["events"]["daily_summary"] is False
    assert body["preferences"]["quiet_hours"] == {"enabled": True, "start": "08:00", "end": "19:00", "days": "weekdays"}
    assert body["catalog"]["silence_during_appointment"] is (role != "receptionist")


def test_update_persists_and_is_partial(client, make_user, auth_headers):
    headers = auth_headers(make_user(role="nutritionist"))
    first = client.put(URL, headers=headers, json={"events": {"appointment_created": False}, "sounds_enabled": False})
    assert first.status_code == 200, first.text
    assert first.json()["preferences"]["events"]["appointment_created"] is False

    second = client.put(URL, headers=headers, json={"sounds": {"new_appointment": {"sound": "serene_harp", "volume": 30}}})
    assert second.status_code == 200
    saved = client.get(URL, headers=headers).json()["preferences"]
    assert saved["sounds_enabled"] is False                          # da 1ª chamada
    assert saved["events"]["appointment_created"] is False           # da 1ª chamada
    assert saved["events"]["reevaluation_due"] is True               # intacto (padrão)
    assert saved["sounds"]["new_appointment"] == {"sound": "serene_harp", "volume": 30}
    assert saved["sounds"]["upcoming_appointment"]["volume"] == 85   # intacto (padrão)
    # os padrões continuam os do papel
    assert client.get(URL, headers=headers).json()["defaults"]["events"]["appointment_created"] is True


def test_quiet_hours_are_saved(client, make_user, auth_headers):
    headers = auth_headers(make_user(role="receptionist"))
    quiet = {"enabled": False, "start": "07:30", "end": "20:15", "days": "every_day"}
    assert client.put(URL, headers=headers, json={"quiet_hours": quiet}).status_code == 200
    assert client.get(URL, headers=headers).json()["preferences"]["quiet_hours"] == quiet


def test_restoring_defaults_by_sending_them_back(client, make_user, auth_headers):
    headers = auth_headers(make_user(role="admin"))
    client.put(URL, headers=headers, json={"events": {"daily_summary": True}, "sounds_enabled": False})
    body = client.get(URL, headers=headers).json()
    client.put(URL, headers=headers, json=body["defaults"])
    assert client.get(URL, headers=headers).json()["preferences"] == body["defaults"]


def test_put_is_idempotent_and_keeps_one_row(client, make_user, auth_headers):
    user = make_user(role="admin")
    headers = auth_headers(user)
    for _ in range(3):
        assert client.put(URL, headers=headers, json={"events": {"daily_summary": True}}).status_code == 200
    with get_engine().begin() as conn:
        count = conn.execute(
            text("select count(*) from notification_preferences where membership_id = :m"), {"m": user.membership_id}
        ).scalar()
    assert count == 1


@pytest.mark.parametrize(
    ("payload", "field"),
    [
        ({"events": {"reevaluation_due": True}}, "events"),                        # recepção não tem esse evento
        ({"events": {"evento_que_nao_existe": True}}, "events"),
        ({"sounds": {"upcoming_appointment": {"sound": "pulsing_alert", "volume": 50}}}, "sounds"),  # recepção não tem
        ({"sounds": {"new_appointment": {"sound": "pulsing_alert", "volume": 50}}}, "sounds"),       # som de outro alerta
        ({"sounds": {"new_appointment": {"sound": "silent", "volume": 101}}}, "volume"),
        ({"sounds": {"new_appointment": {"sound": "silent", "volume": -1}}}, "volume"),
        ({"silence_during_appointment": True}, "silence_during_appointment"),      # recepção não atende
        ({"quiet_hours": {"enabled": True, "start": "25:00", "end": "19:00", "days": "weekdays"}}, "start"),
        ({"quiet_hours": {"enabled": True, "start": "8:00", "end": "19:00", "days": "weekdays"}}, "start"),
        ({"quiet_hours": {"enabled": True, "start": "08:00", "end": "19:00", "days": "domingos"}}, "days"),
        ({"events": {"appointment_created": "sim"}}, "appointment_created"),
    ],
)
def test_validation_errors_point_to_the_field(client, make_user, auth_headers, payload, field):
    response = client.put(URL, headers=auth_headers(make_user(role="receptionist")), json=payload)
    assert response.status_code == 422, response.text
    assert response.json()["detail"][0]["loc"][-1] == field


def test_rejected_update_saves_nothing(client, make_user, auth_headers):
    headers = auth_headers(make_user(role="receptionist"))
    response = client.put(URL, headers=headers, json={"events": {"appointment_created": False, "reevaluation_due": True}})
    assert response.status_code == 422
    assert client.get(URL, headers=headers).json()["preferences"]["events"]["appointment_created"] is True


@pytest.mark.parametrize("field", ["membership_id", "role", "clinic_id", "user_id", "id"])
def test_cannot_target_another_membership_or_change_identity(client, make_user, auth_headers, field):
    other = make_user(role="nutritionist")
    headers = auth_headers(make_user(role="receptionist"))
    response = client.put(URL, headers=headers, json={field: str(other.membership_id), "events": {"daily_summary": True}})
    assert response.status_code == 422


def test_users_only_see_and_change_their_own_preferences(client, make_user, auth_headers):
    a, b = make_user(role="nutritionist"), make_user(role="nutritionist")
    headers_a, headers_b = auth_headers(a), auth_headers(b)
    client.put(URL, headers=headers_a, json={"events": {"appointment_created": False}, "sounds": {"new_appointment": {"sound": "silent", "volume": 5}}})

    prefs_b = client.get(URL, headers=headers_b).json()["preferences"]
    assert prefs_b["events"]["appointment_created"] is True
    assert prefs_b["sounds"]["new_appointment"]["volume"] == 70

    client.put(URL, headers=headers_b, json={"events": {"daily_summary": True}})
    prefs_a = client.get(URL, headers=headers_a).json()["preferences"]
    assert prefs_a["events"]["daily_summary"] is False
    assert prefs_a["events"]["appointment_created"] is False


def test_staff_and_patient_routes_are_separate(client, make_user, auth_headers):
    staff = auth_headers(make_user(role="receptionist"))
    patient = auth_headers(make_user(role="patient"))
    assert client.get(URL, headers=patient).status_code == 403
    assert client.put(URL, headers=patient, json={}).status_code == 403
    assert client.get(PATIENT_URL, headers=staff).status_code == 403
    assert client.put(PATIENT_URL, headers=staff, json={}).status_code == 403


def test_patient_configures_own_preferences_on_me_route(client, make_user, auth_headers):
    headers = auth_headers(make_user(role="patient"))
    body = client.get(PATIENT_URL, headers=headers).json()
    assert body["catalog"]["events"] == ["appointment_reminder", "appointment_changed"]
    assert body["catalog"]["sounds"] == [] and body["catalog"]["silence_during_appointment"] is False
    assert body["preferences"]["sounds_enabled"] is False

    assert client.put(PATIENT_URL, headers=headers, json={"events": {"appointment_reminder": False}}).status_code == 200
    assert client.get(PATIENT_URL, headers=headers).json()["preferences"]["events"]["appointment_reminder"] is False
    # o paciente não tem sons nem eventos da equipe
    assert client.put(PATIENT_URL, headers=headers, json={"sounds_enabled": True}).status_code == 422
    assert client.put(PATIENT_URL, headers=headers, json={"events": {"appointment_created": True}}).status_code == 422


def test_removing_the_membership_removes_the_preferences(client, make_user, auth_headers):
    user = make_user(role="admin")
    client.put(URL, headers=auth_headers(user), json={"events": {"daily_summary": True}})
    with get_engine().begin() as conn:
        conn.execute(text("delete from memberships where id = :m"), {"m": user.membership_id})
        left = conn.execute(text("select count(*) from notification_preferences where membership_id = :m"), {"m": user.membership_id}).scalar()
    assert left == 0


def test_table_is_locked_down_for_public_roles():
    with get_engine().begin() as conn:
        rls = conn.execute(text("select rowsecurity from pg_tables where tablename = 'notification_preferences'")).scalar()
        anon = conn.execute(text("select has_table_privilege('anon', 'public.notification_preferences', 'select')")).scalar()
        authenticated = conn.execute(text("select has_table_privilege('authenticated', 'public.notification_preferences', 'select')")).scalar()
    assert rls is True and anon is False and authenticated is False
