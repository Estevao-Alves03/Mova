"""Unidades e consultórios (Configurações, só admin)."""

import uuid

import pytest
from sqlalchemy import text

from app.db.session import get_engine
from app.tests import schedule_helpers as sh
from app.tests.schedule_helpers import iso, next_weekday

URL = "/api/v1/units"
MONDAY = next_weekday(1)


def unit_url(unit_id) -> str:
    return f"{URL}/{unit_id}"


def make_unit(client, w, name="Sede Paulista", **extra):
    response = client.post(URL, headers=w.headers["admin"], json={"name": name, **extra})
    assert response.status_code == 201, response.text
    return response.json()


def link(client, w, unit_id, member=None):
    """O admin vincula o nutricionista à unidade (sem isso ele não configura atendimento nela)."""
    member = member or w.nutri
    response = client.post(f"{unit_url(unit_id)}/members", headers=w.headers["admin"], json={"membership_id": str(member.membership_id)})
    assert response.status_code == 201, response.text
    return response.json()


def make_room(client, w, unit_id, name="Consultório 01"):
    response = client.post(f"{unit_url(unit_id)}/rooms", headers=w.headers["admin"], json={"name": name})
    assert response.status_code == 201, response.text
    return response.json()


# ------------------------------------------------------------------ permissões

def test_only_admin_reaches_the_unit_routes(client, world, make_user, auth_headers):
    unit, room = str(world.unit), str(uuid.uuid4())
    patient = auth_headers(make_user(role="patient"))
    outsider = auth_headers(make_user(role=None))
    for headers in (world.headers["nutri"], world.headers["reception"], patient, outsider):
        assert client.get(URL, headers=headers).status_code == 403
        assert client.post(URL, headers=headers, json={"name": "Nova"}).status_code == 403
        assert client.patch(unit_url(unit), headers=headers, json={"name": "Outra"}).status_code == 403
        assert client.post(f"{unit_url(unit)}/rooms", headers=headers, json={"name": "Sala"}).status_code == 403
        assert client.patch(f"{unit_url(unit)}/rooms/{room}", headers=headers, json={"name": "Sala"}).status_code == 403
    assert client.get(URL).status_code == 401
    assert client.post(URL, json={"name": "Nova"}).status_code == 401


def test_denied_calls_change_nothing(client, world):
    before = client.get(URL, headers=world.headers["admin"]).json()
    client.post(URL, headers=world.headers["reception"], json={"name": "Nova"})
    client.patch(unit_url(world.unit), headers=world.headers["nutri"], json={"active": False})
    assert client.get(URL, headers=world.headers["admin"]).json() == before


# ------------------------------------------------------------------ unidades

def test_list_returns_units_with_rooms_including_inactive(client, world):
    room = make_room(client, world, str(world.unit), "Sala B")
    make_room(client, world, str(world.unit), "Sala A")
    client.patch(f"{unit_url(world.unit)}/rooms/{room['rooms'][0]['id']}", headers=world.headers["admin"], json={"active": False})
    units = client.get(URL, headers=world.headers["admin"]).json()
    assert [u["name"] for u in units] == ["Unidade Teste"]
    assert [(r["name"], r["active"]) for r in units[0]["rooms"]] == [("Sala A", True), ("Sala B", False)]
    assert set(units[0]) == {"id", "name", "address", "phone", "email", "active", "rooms", "members"}


def test_create_unit_normalizes_and_persists(client, world):
    unit = make_unit(client, world, name="  Sede Paulista ", address=" Av. Paulista, 1842 ", phone="(11) 3284-9000", email=" Recepcao@Mova.test ")
    assert unit["name"] == "Sede Paulista" and unit["address"] == "Av. Paulista, 1842"
    assert unit["phone"] == "(11) 3284-9000" and unit["email"] == "recepcao@mova.test"
    assert unit["active"] is True and unit["rooms"] == []
    with get_engine().begin() as conn:
        assert conn.execute(text("select clinic_id from units where id = :i"), {"i": unit["id"]}).scalar() == world.clinic


def test_blank_contact_fields_become_null(client, world):
    unit = make_unit(client, world, address="  ", phone="", email="")
    assert unit["address"] is None and unit["phone"] is None and unit["email"] is None


def test_unit_names_are_unique_per_clinic_ignoring_case(client, world):
    make_unit(client, world, name="Sede")
    for name in ("Sede", "SEDE", "  sede "):
        response = client.post(URL, headers=world.headers["admin"], json={"name": name})
        assert response.status_code == 409 and response.json()["detail"][0]["loc"][-1] == "name"
    other = make_unit(client, world, name="Outra Sede")
    assert client.patch(unit_url(other["id"]), headers=world.headers["admin"], json={"name": "sede"}).status_code == 409
    assert client.patch(unit_url(other["id"]), headers=world.headers["admin"], json={"name": "Outra Sede"}).status_code == 200


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"name": "A"},
        {"name": "x" * 101},
        {"name": "Sede", "phone": "abc"},
        {"name": "Sede", "phone": "123"},
        {"name": "Sede", "email": "sem-arroba"},
        {"name": "Sede", "address": "x" * 201},
        {"name": "Sede", "active": False},
        {"name": "Sede", "clinic_id": str(uuid.uuid4())},
        {"name": "Sede", "id": str(uuid.uuid4())},
    ],
)
def test_invalid_unit_is_rejected(client, world, payload):
    assert client.post(URL, headers=world.headers["admin"], json=payload).status_code == 422


def test_update_unit_partially_and_clear_contact(client, world):
    unit = make_unit(client, world, name="Sede", phone="(11) 3284-9000", address="Rua A")
    response = client.patch(unit_url(unit["id"]), headers=world.headers["admin"], json={"phone": None, "address": "Rua B"})
    assert response.status_code == 200
    body = response.json()
    assert body["phone"] is None and body["address"] == "Rua B" and body["name"] == "Sede"


@pytest.mark.parametrize("payload", [{}, {"name": None}, {"active": None}, {"name": "A"}, {"email": "x"}, {"clinic_id": str(uuid.uuid4())}])
def test_invalid_unit_update_is_rejected(client, world, payload):
    assert client.patch(unit_url(world.unit), headers=world.headers["admin"], json=payload).status_code == 422


def test_unknown_and_foreign_units_are_404(client, world):
    foreign = uuid.uuid4()
    with get_engine().begin() as conn:
        conn.execute(text("insert into clinics (id, name) values (:i, 'Outra')"), {"i": foreign})
    try:
        foreign_unit = sh.insert_unit(foreign, "Alheia")
        for unit in (uuid.uuid4(), foreign_unit):
            assert client.patch(unit_url(unit), headers=world.headers["admin"], json={"name": "Nova"}).status_code == 404
            assert client.post(f"{unit_url(unit)}/rooms", headers=world.headers["admin"], json={"name": "Sala"}).status_code == 404
        with get_engine().begin() as conn:
            assert conn.execute(text("select name from units where id = :i"), {"i": foreign_unit}).scalar() == "Alheia"
        assert "Alheia" not in client.get(URL, headers=world.headers["admin"]).text
    finally:
        with get_engine().begin() as conn:
            conn.execute(text("delete from units where clinic_id = :c"), {"c": foreign})
            conn.execute(text("delete from clinics where id = :c"), {"c": foreign})


def test_same_name_is_allowed_in_another_clinic(client, world):
    foreign = uuid.uuid4()
    with get_engine().begin() as conn:
        conn.execute(text("insert into clinics (id, name) values (:i, 'Outra')"), {"i": foreign})
    try:
        sh.insert_unit(foreign, "Sede")
        make_unit(client, world, name="Sede")
    finally:
        with get_engine().begin() as conn:
            conn.execute(text("delete from units where clinic_id = :c"), {"c": foreign})
            conn.execute(text("delete from clinics where id = :c"), {"c": foreign})


def test_deactivating_and_reactivating_a_unit(client, world):
    unit = make_unit(client, world, name="Extra")
    off = client.patch(unit_url(unit["id"]), headers=world.headers["admin"], json={"active": False}).json()
    assert off["active"] is False
    assert unit["id"] not in {u["id"] for u in client.get("/api/v1/schedule/units", headers=world.headers["reception"]).json()}
    assert client.patch(unit_url(unit["id"]), headers=world.headers["admin"], json={"active": True}).json()["active"] is True
    assert unit["id"] in {u["id"] for u in client.get("/api/v1/schedule/units", headers=world.headers["reception"]).json()}


def test_unit_used_in_a_professional_schedule_cannot_be_deactivated(client, configured):
    w = configured
    response = client.patch(unit_url(w.unit), headers=w.headers["admin"], json={"active": False})
    assert response.status_code == 409 and "agenda" in response.json()["detail"]
    with get_engine().begin() as conn:
        assert conn.execute(text("select active from units where id = :i"), {"i": w.unit}).scalar() is True
    # Depois que o profissional deixa de atender ali, a unidade pode ser desativada.
    other_unit = make_unit(client, w, name="Outra")
    link(client, w, other_unit["id"])
    days = [{"weekday": 1, "start": "08:00", "end": "18:00", "unit_id": other_unit["id"]}]
    client.put(f"/api/v1/schedule/professionals/{w.nutri.membership_id}/config", headers=w.headers["nutri"], json=sh.example_config(w.unit, days=days))
    assert client.patch(unit_url(w.unit), headers=w.headers["admin"], json={"active": False}).status_code == 200


def test_unit_with_future_appointments_cannot_be_deactivated(client, world):
    unit = make_unit(client, world, name="Com consulta")
    link(client, world, unit["id"])
    config_url = f"/api/v1/schedule/professionals/{world.nutri.membership_id}/config"
    at_unit = [{"weekday": 1, "start": "08:00", "end": "18:00", "unit_id": unit["id"]}]
    client.put(config_url, headers=world.headers["nutri"], json=sh.example_config(world.unit, days=at_unit))
    booked = client.post("/api/v1/schedule/appointments", headers=world.headers["reception"], json={
        "patient_id": str(world.patient), "professional_id": str(world.nutri.membership_id),
        "appointment_type": "return_consultation", "starts_at": iso(MONDAY, 9)})
    assert booked.status_code == 201 and booked.json()["unit_id"] == unit["id"]
    # O nutricionista muda de unidade; a consulta futura continua lá e segura a unidade.
    elsewhere = [{"weekday": 1, "start": "08:00", "end": "18:00", "unit_id": str(world.unit)}]
    client.put(config_url, headers=world.headers["nutri"], json=sh.example_config(world.unit, days=elsewhere))
    response = client.patch(unit_url(unit["id"]), headers=world.headers["admin"], json={"active": False})
    assert response.status_code == 409 and "consultas futuras" in response.json()["detail"]
    client.post(f"/api/v1/schedule/appointments/{booked.json()['id']}/cancel", headers=world.headers["reception"], json={"source": "client"})
    assert client.patch(unit_url(unit["id"]), headers=world.headers["admin"], json={"active": False}).status_code == 200


def test_new_unit_can_be_used_in_the_schedule_config(client, world):
    unit = make_unit(client, world, name="Nova Sede")
    link(client, world, unit["id"])
    assert unit["id"] in {u["id"] for u in client.get("/api/v1/schedule/units", headers=world.headers["nutri"]).json()}
    days = [{"weekday": 1, "start": "08:00", "end": "12:00", "unit_id": unit["id"]}]
    response = client.put(f"/api/v1/schedule/professionals/{world.nutri.membership_id}/config", headers=world.headers["nutri"],
                          json=sh.example_config(world.unit, days=days))
    assert response.status_code == 200


# ------------------------------------------------------------------ salas

def test_create_and_list_rooms(client, world):
    unit = make_unit(client, world)
    result = make_room(client, world, unit["id"], "  Consultório 01 ")
    assert [(r["name"], r["active"]) for r in result["rooms"]] == [("Consultório 01", True)]
    with get_engine().begin() as conn:
        assert conn.execute(text("select clinic_id from rooms where unit_id = :u"), {"u": unit["id"]}).scalar() == world.clinic


def test_room_names_are_unique_per_unit_ignoring_case(client, world):
    first, second = make_unit(client, world, name="Unidade A"), make_unit(client, world, name="Unidade B")
    make_room(client, world, first["id"], "Sala 1")
    for name in ("Sala 1", "SALA 1"):
        response = client.post(f"{unit_url(first['id'])}/rooms", headers=world.headers["admin"], json={"name": name})
        assert response.status_code == 409 and response.json()["detail"][0]["loc"][-1] == "name"
    make_room(client, world, second["id"], "Sala 1")  # outra unidade pode repetir


@pytest.mark.parametrize("payload", [{}, {"name": "A"}, {"name": "x" * 101}, {"name": "Sala", "active": False}, {"name": "Sala", "unit_id": str(uuid.uuid4())}])
def test_invalid_room_is_rejected(client, world, payload):
    assert client.post(f"{unit_url(world.unit)}/rooms", headers=world.headers["admin"], json=payload).status_code == 422


def test_rename_deactivate_and_reactivate_room(client, world):
    unit = make_unit(client, world)
    room = make_room(client, world, unit["id"])["rooms"][0]
    url = f"{unit_url(unit['id'])}/rooms/{room['id']}"
    renamed = client.patch(url, headers=world.headers["admin"], json={"name": "Sala Nova"}).json()
    assert renamed["rooms"][0]["name"] == "Sala Nova"
    assert client.patch(url, headers=world.headers["admin"], json={"active": False}).json()["rooms"][0]["active"] is False
    assert client.patch(url, headers=world.headers["admin"], json={"active": True}).json()["rooms"][0]["active"] is True


@pytest.mark.parametrize("payload", [{}, {"name": None}, {"active": None}, {"name": "A"}, {"unit_id": str(uuid.uuid4())}])
def test_invalid_room_update_is_rejected(client, world, payload):
    room = make_room(client, world, str(world.unit))["rooms"][0]
    assert client.patch(f"{unit_url(world.unit)}/rooms/{room['id']}", headers=world.headers["admin"], json=payload).status_code == 422


def test_room_of_another_unit_or_unknown_is_404(client, world):
    first, second = make_unit(client, world, name="Unidade A"), make_unit(client, world, name="Unidade B")
    room = make_room(client, world, first["id"])["rooms"][0]
    assert client.patch(f"{unit_url(second['id'])}/rooms/{room['id']}", headers=world.headers["admin"], json={"name": "Nova"}).status_code == 404
    assert client.patch(f"{unit_url(first['id'])}/rooms/{uuid.uuid4()}", headers=world.headers["admin"], json={"name": "Nova"}).status_code == 404


def test_rooms_need_an_active_unit(client, world):
    unit = make_unit(client, world, name="Inativa")
    room = make_room(client, world, unit["id"])["rooms"][0]
    client.patch(f"{unit_url(unit['id'])}/rooms/{room['id']}", headers=world.headers["admin"], json={"active": False})
    client.patch(unit_url(unit["id"]), headers=world.headers["admin"], json={"active": False})
    assert client.post(f"{unit_url(unit['id'])}/rooms", headers=world.headers["admin"], json={"name": "Nova"}).status_code == 422
    assert client.patch(f"{unit_url(unit['id'])}/rooms/{room['id']}", headers=world.headers["admin"], json={"active": True}).status_code == 409


def test_room_with_future_appointments_cannot_be_deactivated(client, configured):
    w = configured
    room = make_room(client, w, str(w.unit), "Sala Ocupada")["rooms"][0]
    booked = client.post("/api/v1/schedule/appointments", headers=w.headers["reception"], json={
        "patient_id": str(w.patient), "professional_id": str(w.nutri.membership_id),
        "appointment_type": "return_consultation", "starts_at": iso(MONDAY, 9), "room_id": room["id"]})
    assert booked.status_code == 201, booked.text
    url = f"{unit_url(w.unit)}/rooms/{room['id']}"
    response = client.patch(url, headers=w.headers["admin"], json={"active": False})
    assert response.status_code == 409 and "consultas futuras" in response.json()["detail"]
    client.post(f"/api/v1/schedule/appointments/{booked.json()['id']}/cancel", headers=w.headers["reception"], json={"source": "client"})
    assert client.patch(url, headers=w.headers["admin"], json={"active": False}).status_code == 200
