"""Equipe e acesso (Configurações, só admin): listar, criar com senha temporária, editar e desativar."""

import re
import uuid

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import get_engine
from app.modules.auth.models import Membership
from app.modules.settings import team_service
from app.modules.settings.team_schemas import MemberUpdate
from app.tests import helpers

URL = "/api/v1/team"
PASSWORD_FORMAT = re.compile(r"^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$")


def new_email() -> str:
    return f"Novo.{uuid.uuid4().hex[:8]}@Mova.test"


def create(client, w, role="receptionist", name="Fulano de Tal", email=None, who="admin"):
    return client.post(URL, headers=w.headers[who], json={"full_name": name, "email": email or new_email(), "role": role})


# ------------------------------------------------------------------ permissões

def test_only_admin_reaches_the_team_routes(client, world, make_user, auth_headers):
    member = str(world.nutri.membership_id)
    body = {"full_name": "Fulano", "email": new_email(), "role": "receptionist"}
    patient = auth_headers(make_user(role="patient"))
    outsider = auth_headers(make_user(role=None))
    for headers in (world.headers["nutri"], world.headers["reception"], patient, outsider):
        assert client.get(URL, headers=headers).status_code == 403
        assert client.post(URL, headers=headers, json=body).status_code == 403
        assert client.patch(f"{URL}/{member}", headers=headers, json={"full_name": "Outro"}).status_code == 403
    assert client.get(URL).status_code == 401
    assert client.post(URL, json=body).status_code == 401
    assert client.patch(f"{URL}/{member}", json={"full_name": "x"}).status_code == 401


def test_denied_calls_change_nothing(client, world):
    before = client.get(URL, headers=world.headers["admin"]).json()
    client.post(URL, headers=world.headers["reception"], json={"full_name": "Fulano", "email": new_email(), "role": "admin"})
    client.patch(f"{URL}/{world.nutri.membership_id}", headers=world.headers["nutri"], json={"role": "admin"})
    assert client.get(URL, headers=world.headers["admin"]).json() == before


# ------------------------------------------------------------------ listar

def test_list_shows_only_this_clinics_staff(client, world, make_user):
    make_user(role="patient", full_name="Paciente Portal")
    foreign_clinic = uuid.uuid4()
    with get_engine().begin() as conn:
        conn.execute(text("insert into clinics (id, name) values (:i, 'Outra')"), {"i": foreign_clinic})
        foreign_user = conn.execute(text("select id from auth.users where id = :u"), {"u": world.other.user_id}).scalar()
    assert foreign_user  # só para garantir que o usuário existe; o membership alheio é criado abaixo
    other_member = uuid.uuid4()
    other_user = helpers_user_for_clinic(foreign_clinic, other_member)
    try:
        members = client.get(URL, headers=world.headers["admin"]).json()
        assert {m["full_name"] for m in members} == {"Nutri Um", "Nutri Dois", "Recepção", "Admin"}
        me = [m for m in members if m["is_you"]]
        assert len(me) == 1 and me[0]["role"] == "admin"
        assert all(set(m) == {"id", "full_name", "email", "role", "crn", "active", "status", "last_sign_in_at", "is_you"} for m in members)
        assert all(m["status"] == "active" for m in members)  # todos já entraram
        assert client.patch(f"{URL}/{other_member}", headers=world.headers["admin"], json={"active": False}).status_code == 404
    finally:
        with get_engine().begin() as conn:
            conn.execute(text("delete from memberships where clinic_id = :c"), {"c": foreign_clinic})
            conn.execute(text("delete from clinics where id = :c"), {"c": foreign_clinic})
            conn.execute(text("delete from auth.users where id = :u"), {"u": other_user})


def helpers_user_for_clinic(clinic_id, membership_id):
    user_id = uuid.uuid4()
    with get_engine().begin() as conn:
        conn.execute(
            text("insert into auth.users (id, instance_id, aud, role, email) values "
                 "(:u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', :e)"),
            {"u": user_id, "e": f"alheio-{user_id.hex[:8]}@mova.test"},
        )
        conn.execute(
            text("insert into memberships (id, clinic_id, user_id, role, full_name) values (:i, :c, :u, 'receptionist', 'Alheia')"),
            {"i": membership_id, "c": clinic_id, "u": user_id},
        )
    return user_id


# ------------------------------------------------------------------ criar

def test_create_member_returns_a_temporary_password_that_works(client, world, settings):
    email = new_email()
    response = create(client, world, role="nutritionist", name="  Juliana Martins ", email=email)
    assert response.status_code == 201, response.text
    body = response.json()
    assert PASSWORD_FORMAT.match(body["temporary_password"])
    member = body["member"]
    assert member["full_name"] == "Juliana Martins" and member["email"] == email.lower()
    assert member["role"] == "nutritionist" and member["active"] is True
    assert member["status"] == "invited" and member["last_sign_in_at"] is None and member["is_you"] is False

    # A senha temporária realmente abre o acesso, com o papel definido pelo admin (nunca pelo token).
    token = helpers.login(settings, email.lower(), body["temporary_password"])
    mine = client.get("/api/v1/profile", headers=helpers.bearer(token)).json()
    assert mine["role"] == "nutritionist" and mine["full_name"] == "Juliana Martins"
    assert client.get(URL, headers=helpers.bearer(token)).status_code == 403  # sem poderes de admin

    listed = {m["id"]: m for m in client.get(URL, headers=world.headers["admin"]).json()}
    assert listed[member["id"]]["status"] == "active"  # já fez o primeiro acesso


def test_password_is_returned_only_once_and_never_listed(client, world):
    body = create(client, world).json()
    listing = client.get(URL, headers=world.headers["admin"])
    assert body["temporary_password"] not in listing.text
    assert "password" not in listing.text.lower()


def test_each_member_gets_a_different_password(client, world):
    passwords = {create(client, world).json()["temporary_password"] for _ in range(3)}
    assert len(passwords) == 3


@pytest.mark.parametrize("role", ["admin", "nutritionist", "receptionist"])
def test_admin_can_create_every_staff_role(client, world, role):
    assert create(client, world, role=role).json()["member"]["role"] == role


def test_duplicate_email_is_rejected_without_linking_the_account(client, world):
    existing = client.get(URL, headers=world.headers["admin"]).json()
    email = next(m["email"] for m in existing if m["full_name"] == "Nutri Um")
    for variant in (email, email.upper()):
        response = create(client, world, email=variant)
        assert response.status_code == 409
        assert response.json()["detail"][0]["loc"][-1] == "email"
    assert len(client.get(URL, headers=world.headers["admin"]).json()) == len(existing)


@pytest.mark.parametrize(
    "payload",
    [
        {"full_name": "A", "email": "a@b.co", "role": "admin"},
        {"full_name": "x" * 121, "email": "a@b.co", "role": "admin"},
        {"full_name": "Fulano", "email": "sem-arroba", "role": "admin"},
        {"full_name": "Fulano", "email": "a@b", "role": "admin"},
        {"full_name": "Fulano", "email": "a b@c.co", "role": "admin"},
        {"full_name": "Fulano", "email": "a@b.co", "role": "patient"},
        {"full_name": "Fulano", "email": "a@b.co", "role": "super"},
        {"full_name": "Fulano", "email": "a@b.co"},
        {"email": "a@b.co", "role": "admin"},
        {"full_name": "Fulano", "email": "a@b.co", "role": "admin", "active": False},
        {"full_name": "Fulano", "email": "a@b.co", "role": "admin", "clinic_id": str(uuid.uuid4())},
        {"full_name": "Fulano", "email": "a@b.co", "role": "admin", "password": "Senha-forte-1"},
    ],
)
def test_invalid_create_is_rejected(client, world, payload):
    assert client.post(URL, headers=world.headers["admin"], json=payload).status_code == 422


def test_created_member_belongs_to_the_admins_clinic(client, world):
    member_id = create(client, world).json()["member"]["id"]
    with get_engine().begin() as conn:
        assert conn.execute(text("select clinic_id from memberships where id = :i"), {"i": member_id}).scalar() == world.clinic


# ------------------------------------------------------------------ editar

def test_admin_renames_and_changes_role(client, world):
    target = str(world.reception.membership_id)
    response = client.patch(f"{URL}/{target}", headers=world.headers["admin"], json={"full_name": "  Mariana F.  ", "role": "admin"})
    assert response.status_code == 200, response.text
    assert response.json()["full_name"] == "Mariana F." and response.json()["role"] == "admin"
    # O papel novo vale de imediato (vem do banco, não do token).
    assert client.get(URL, headers=world.headers["reception"]).status_code == 200


def test_deactivating_blocks_access_immediately_and_reactivating_restores_it(client, world):
    target = str(world.reception.membership_id)
    assert client.get("/api/v1/profile", headers=world.headers["reception"]).status_code == 200
    off = client.patch(f"{URL}/{target}", headers=world.headers["admin"], json={"active": False})
    assert off.status_code == 200 and off.json()["status"] == "inactive" and off.json()["active"] is False
    assert client.get("/api/v1/profile", headers=world.headers["reception"]).status_code == 403  # mesmo token
    on = client.patch(f"{URL}/{target}", headers=world.headers["admin"], json={"active": True})
    assert on.json()["status"] == "active"
    assert client.get("/api/v1/profile", headers=world.headers["reception"]).status_code == 200


def test_deactivating_keeps_the_history(client, world):
    client.patch(f"{URL}/{world.nutri.membership_id}", headers=world.headers["admin"], json={"active": False})
    with get_engine().begin() as conn:
        assert conn.execute(text("select count(*) from memberships where id = :i"), {"i": world.nutri.membership_id}).scalar() == 1
        assert conn.execute(text("select nutritionist_id from patients where id = :p"), {"p": world.patient}).scalar() == world.nutri.membership_id
    professionals = client.get("/api/v1/schedule/professionals", headers=world.headers["reception"]).json()
    assert str(world.nutri.membership_id) not in {p["id"] for p in professionals}


def test_admin_cannot_change_own_role_or_deactivate_self(client, world):
    me = str(world.admin.membership_id)
    for body in ({"active": False}, {"role": "receptionist"}):
        response = client.patch(f"{URL}/{me}", headers=world.headers["admin"], json=body)
        assert response.status_code == 409, body
    assert client.patch(f"{URL}/{me}", headers=world.headers["admin"], json={"full_name": "Novo Nome"}).status_code == 200
    assert client.patch(f"{URL}/{me}", headers=world.headers["admin"], json={"role": "admin", "active": True}).status_code == 200


def test_clinic_never_ends_up_without_an_active_admin(client, world):
    second = create(client, world, role="admin").json()["member"]["id"]
    assert client.patch(f"{URL}/{second}", headers=world.headers["admin"], json={"active": False}).status_code == 200
    assert client.patch(f"{URL}/{second}", headers=world.headers["admin"], json={"active": True}).status_code == 200
    # A primeira admin sai; a segunda é a última ativa e ninguém consegue removê-la.
    first = str(world.admin.membership_id)
    assert client.patch(f"{URL}/{first}", headers=world.headers["admin"], json={"role": "receptionist"}).status_code == 409  # self
    with get_engine().begin() as conn:
        conn.execute(text("update memberships set active = false where id = :i"), {"i": first})
    with Session(get_engine()) as db:
        actor = db.get(Membership, uuid.UUID(first))
        with pytest.raises(Exception) as caught:
            team_service.update_member(db, actor, uuid.UUID(second), MemberUpdate(active=False))
        assert getattr(caught.value, "status_code", None) == 409
        assert "ao menos um administrador" in caught.value.detail
        with pytest.raises(Exception) as demote:
            team_service.update_member(db, actor, uuid.UUID(second), MemberUpdate(role="receptionist"))
        assert getattr(demote.value, "status_code", None) == 409


def test_nutritionist_with_patients_cannot_change_role(client, world):
    response = client.patch(f"{URL}/{world.nutri.membership_id}", headers=world.headers["admin"], json={"role": "receptionist"})
    assert response.status_code == 409
    with get_engine().begin() as conn:
        assert conn.execute(text("select role from memberships where id = :i"), {"i": world.nutri.membership_id}).scalar() == "nutritionist"
    # Sem pacientes nem consultas futuras a função pode mudar.
    assert client.patch(f"{URL}/{world.other.membership_id}", headers=world.headers["admin"], json={"role": "receptionist"}).status_code == 200


def test_unknown_foreign_and_patient_members_are_404(client, world, make_user):
    patient_member = make_user(role="patient").membership_id
    for member in (uuid.uuid4(), patient_member):
        assert client.patch(f"{URL}/{member}", headers=world.headers["admin"], json={"active": False}).status_code == 404


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"full_name": None},
        {"role": None},
        {"active": None},
        {"role": "patient"},
        {"full_name": "A"},
        {"email": "novo@mova.test"},
        {"clinic_id": str(uuid.uuid4())},
        {"user_id": str(uuid.uuid4())},
        {"crn": "CRN-3 1"},
    ],
)
def test_invalid_update_is_rejected(client, world, payload):
    assert client.patch(f"{URL}/{world.reception.membership_id}", headers=world.headers["admin"], json=payload).status_code == 422
