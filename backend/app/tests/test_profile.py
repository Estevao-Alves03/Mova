import uuid

import pytest
from sqlalchemy import text

from app.db.session import get_engine

URL = "/api/v1/profile"


def _insert_patient(clinic, nutritionist_id, name="Paciente Teste"):
    patient_id = uuid.uuid4()
    with get_engine().begin() as conn:
        conn.execute(
            text("insert into patients (id, clinic_id, nutritionist_id, full_name) values (:i, :c, :n, :name)"),
            {"i": patient_id, "c": clinic, "n": nutritionist_id, "name": name},
        )
    return patient_id


def _insert_appointment(clinic, patient_id, professional_id, status, hour):
    with get_engine().begin() as conn:
        unit_id = conn.execute(
            text("insert into units (id, clinic_id, name) values (gen_random_uuid(), :c, :n) returning id"),
            {"c": clinic, "n": f"U-{uuid.uuid4().hex[:6]}"},
        ).scalar_one()
        conn.execute(
            text(
                """
                insert into appointments (id, clinic_id, patient_id, professional_id, unit_id, starts_at, ends_at, status, appointment_type)
                values (gen_random_uuid(), :c, :p, :prof, :u,
                        date '2030-01-01' + make_interval(hours => :h),
                        date '2030-01-01' + make_interval(hours => :h + 1), cast(:s as appointment_status), 'return_consultation')
                """
            ),
            {"c": clinic, "p": patient_id, "prof": professional_id, "u": unit_id, "h": hour, "s": status},
        )


def test_read_own_profile(client, make_user, auth_headers):
    user = make_user(full_name="Dra. Teste", phone="(11) 91234-5678", crn="CRN-3 12345",
                     crn_state="São Paulo (CRN-3)", specialty="Clínica", bio="Bio de teste")
    body = client.get(URL, headers=auth_headers(user)).json()
    assert body["full_name"] == "Dra. Teste"
    assert body["email"] == user.email
    assert body["role"] == "nutritionist"
    assert body["crn"] == "CRN-3 12345"
    assert body["specialty"] == "Clínica"
    assert body["has_professional_fields"] is True
    assert "São Paulo (CRN-3)" in body["crn_state_options"]
    assert body["avatar_url"] is None
    assert body["active"] is True


def test_account_summary_counts_only_own_data(client, clinic, make_user, auth_headers):
    a = make_user(full_name="Nutri A")
    b = make_user(full_name="Nutri B")
    own = [_insert_patient(clinic, a.membership_id, f"A{i}") for i in range(3)]
    other = _insert_patient(clinic, b.membership_id, "B0")
    _insert_appointment(clinic, own[0], a.membership_id, "completed", 8)
    _insert_appointment(clinic, own[1], a.membership_id, "completed", 9)
    _insert_appointment(clinic, own[2], a.membership_id, "cancelled", 10)   # não conta
    _insert_appointment(clinic, own[2], a.membership_id, "no_show", 11)     # não conta
    _insert_appointment(clinic, other, b.membership_id, "completed", 8)     # de outro profissional

    summary_a = client.get(URL, headers=auth_headers(a)).json()["account_summary"]
    summary_b = client.get(URL, headers=auth_headers(b)).json()["account_summary"]
    assert summary_a == {"active_patients": 3, "new_patients_this_month": 3, "total_appointments": 2}
    assert summary_b == {"active_patients": 1, "new_patients_this_month": 1, "total_appointments": 1}


def test_account_summary_ignores_deleted_patients(client, clinic, make_user, auth_headers):
    a = make_user()
    patient_id = _insert_patient(clinic, a.membership_id)
    with get_engine().begin() as conn:
        conn.execute(text("update patients set deleted_at = now() where id = :i"), {"i": patient_id})
    assert client.get(URL, headers=auth_headers(a)).json()["account_summary"]["active_patients"] == 0


def test_only_nutritionists_get_account_summary(client, make_user, auth_headers):
    for role in ("receptionist", "admin"):
        body = client.get(URL, headers=auth_headers(make_user(role=role))).json()
        assert body["account_summary"] is None


def test_update_profile_normalizes_and_persists(client, make_user, auth_headers):
    user = make_user()
    headers = auth_headers(user)
    response = client.patch(URL, headers=headers, json={
        "full_name": "  Dra.   Maria   Souza ", "phone": "11912345678", "crn": " crn-3 48291 ",
        "crn_state": "São Paulo (CRN-3)", "bio": "  Nutrição esportiva.  ",
    })
    assert response.status_code == 200, response.text
    body = client.get(URL, headers=headers).json()
    assert body["full_name"] == "Dra. Maria Souza"
    assert body["phone"] == "(11) 91234-5678"
    assert body["crn"] == "CRN-3 48291"
    assert body["bio"] == "Nutrição esportiva."


def test_landline_phone_format(client, make_user, auth_headers):
    headers = auth_headers(make_user())
    assert client.patch(URL, headers=headers, json={"phone": "1132559012"}).json()["phone"] == "(11) 3255-9012"


def test_patch_is_partial(client, make_user, auth_headers):
    user = make_user(phone="(11) 91111-2222", bio="Original")
    headers = auth_headers(user)
    body = client.patch(URL, headers=headers, json={"full_name": "Novo Nome"}).json()
    assert body["full_name"] == "Novo Nome"
    assert body["phone"] == "(11) 91111-2222"
    assert body["bio"] == "Original"


def test_blank_values_clear_optional_fields(client, make_user, auth_headers):
    user = make_user(phone="(11) 91111-2222", bio="Original", crn="CRN-3 12345", crn_state="São Paulo (CRN-3)")
    body = client.patch(URL, headers=auth_headers(user),
                        json={"phone": "", "bio": "   ", "crn": "", "crn_state": ""}).json()
    assert body["phone"] is None and body["bio"] is None and body["crn"] is None and body["crn_state"] is None


def test_full_name_cannot_be_cleared(client, make_user, auth_headers):
    headers = auth_headers(make_user())
    assert client.patch(URL, headers=headers, json={"full_name": None}).status_code == 422
    assert client.patch(URL, headers=headers, json={"full_name": "  "}).status_code == 422


@pytest.mark.parametrize("field", ["role", "clinic_id", "user_id", "active", "avatar_path", "id", "email", "specialty"])
def test_protected_fields_cannot_be_changed(client, make_user, auth_headers, field):
    user = make_user(role="nutritionist", full_name="Intacto")
    headers = auth_headers(user)
    value = "admin" if field == "role" else (False if field == "active" else str(uuid.uuid4()))
    response = client.patch(URL, headers=headers, json={field: value, "full_name": "Hacker"})
    assert response.status_code == 422
    body = client.get(URL, headers=headers).json()
    assert body["full_name"] == "Intacto" and body["role"] == "nutritionist" and body["active"] is True


@pytest.mark.parametrize(
    ("payload", "field"),
    [
        ({"phone": "123"}, "phone"),
        ({"phone": "11812345678"}, "phone"),           # celular deve começar com 9
        ({"phone": "0112345678"}, "phone"),            # DDD não começa com 0
        ({"crn": "48291"}, "crn"),
        ({"crn": "CRN-3-48291"}, "crn"),
        ({"crn": "CRN-3 12"}, "crn"),
        ({"crn_state": "Atlântida (CRN-99)"}, "crn_state"),
        ({"bio": "x" * 351}, "bio"),
        ({"full_name": "A"}, "full_name"),
        ({"full_name": "N" * 121}, "full_name"),
    ],
)
def test_validation_errors_point_to_the_field(client, make_user, auth_headers, payload, field):
    response = client.patch(URL, headers=auth_headers(make_user()), json=payload)
    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"][-1] == field


def test_bio_accepts_exactly_350_chars(client, make_user, auth_headers):
    assert client.patch(URL, headers=auth_headers(make_user()), json={"bio": "x" * 350}).status_code == 200


def test_crn_must_match_the_state_region(client, make_user, auth_headers):
    headers = auth_headers(make_user())
    response = client.patch(URL, headers=headers, json={"crn": "CRN-3 48291", "crn_state": "Minas Gerais (CRN-9)"})
    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"][-1] == "crn_state"
    # Não gravou nada parcialmente.
    assert client.get(URL, headers=headers).json()["crn"] is None


def test_mismatch_is_also_checked_against_stored_values(client, make_user, auth_headers):
    user = make_user(crn="CRN-3 12345", crn_state="São Paulo (CRN-3)")
    response = client.patch(URL, headers=auth_headers(user), json={"crn_state": "Paraná (CRN-8)"})
    assert response.status_code == 422


def test_receptionist_cannot_set_professional_fields(client, make_user, auth_headers):
    user = make_user(role="receptionist")
    headers = auth_headers(user)
    for payload in ({"crn": "CRN-3 12345"}, {"crn_state": "São Paulo (CRN-3)"}, {"bio": "Oi"}):
        assert client.patch(URL, headers=headers, json=payload).status_code == 422
    ok = client.patch(URL, headers=headers, json={"full_name": "Maria Recepção", "phone": "1132559012"})
    assert ok.status_code == 200
    body = ok.json()
    assert body["has_professional_fields"] is False and body["crn_state_options"] == []


def test_update_only_affects_the_authenticated_user(client, make_user, auth_headers):
    a, b = make_user(full_name="Usuário A"), make_user(full_name="Usuário B")
    client.patch(URL, headers=auth_headers(a), json={"full_name": "A Alterado", "phone": "11912345678"})
    body_b = client.get(URL, headers=auth_headers(b)).json()
    assert body_b["full_name"] == "Usuário B" and body_b["phone"] is None
