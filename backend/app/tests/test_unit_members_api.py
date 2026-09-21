"""Vínculo de nutricionistas a unidades (feito pelo admin em Configurações > Unidades)."""

import uuid

import pytest
from sqlalchemy import text

from app.db.session import get_engine
from app.tests import schedule_helpers as sh
from app.tests.schedule_helpers import iso, next_weekday
from app.tests.test_units_api import link, make_unit, unit_url

MONDAY = next_weekday(1)


def members_url(unit_id, member=None) -> str:
    return f"{unit_url(unit_id)}/members" + (f"/{member}" if member else "")


def cfg_url(user) -> str:
    return f"/api/v1/schedule/professionals/{user.membership_id}/config"


def days_at(unit_id):
    return [{"weekday": 1, "start": "08:00", "end": "18:00", "unit_id": str(unit_id)}]


# ------------------------------------------------------------------ permissões

def test_only_admin_links_and_unlinks(client, world, make_user, auth_headers):
    unit = make_unit(client, world, name="Nova")
    body = {"membership_id": str(world.nutri.membership_id)}
    patient = auth_headers(make_user(role="patient"))
    for headers in (world.headers["nutri"], world.headers["reception"], patient):
        assert client.post(members_url(unit["id"]), headers=headers, json=body).status_code == 403
        assert client.delete(members_url(unit["id"], world.nutri.membership_id), headers=headers).status_code == 403
    assert client.post(members_url(unit["id"]), json=body).status_code == 401
    assert client.get("/api/v1/units", headers=world.headers["admin"]).json()  # nada foi vinculado
    listed = {u["id"]: u for u in client.get("/api/v1/units", headers=world.headers["admin"]).json()}
    assert listed[unit["id"]]["members"] == []


# ------------------------------------------------------------------ vincular

def test_admin_links_a_nutritionist_and_it_shows_in_the_unit(client, world):
    unit = make_unit(client, world, name="Nova")
    result = link(client, world, unit["id"])
    assert [(m["id"], m["full_name"], m["active"]) for m in result["members"]] == [(str(world.nutri.membership_id), "Nutri Um", True)]
    listed = {u["id"]: u for u in client.get("/api/v1/units", headers=world.headers["admin"]).json()}
    assert [m["id"] for m in listed[unit["id"]]["members"]] == [str(world.nutri.membership_id)]
    assert {m["full_name"] for m in listed[str(world.unit)]["members"]} == {"Nutri Um", "Nutri Dois"}  # fixture já vincula


def test_a_new_unit_starts_without_any_linked_account(client, world):
    """Criar unidade e salas NÃO vincula ninguém automaticamente."""
    unit = make_unit(client, world, name="Nova")
    client.post(f"{unit_url(unit['id'])}/rooms", headers=world.headers["admin"], json={"name": "Sala 1"})
    listed = {u["id"]: u for u in client.get("/api/v1/units", headers=world.headers["admin"]).json()}
    assert listed[unit["id"]]["members"] == []
    for who in ("nutri", "other"):
        ids = {u["id"] for u in client.get("/api/v1/schedule/units", headers=world.headers[who]).json()}
        assert unit["id"] not in ids


def test_duplicate_link_is_a_conflict(client, world):
    unit = make_unit(client, world, name="Nova")
    link(client, world, unit["id"])
    response = client.post(members_url(unit["id"]), headers=world.headers["admin"], json={"membership_id": str(world.nutri.membership_id)})
    assert response.status_code == 409


def test_only_active_nutritionists_of_the_clinic_can_be_linked(client, world, make_user):
    unit = make_unit(client, world, name="Nova")
    inactive = make_user(role="nutritionist", full_name="Inativo")
    with get_engine().begin() as conn:
        conn.execute(text("update memberships set active = false where id = :i"), {"i": inactive.membership_id})
    foreign = uuid.uuid4()
    for member in (world.reception.membership_id, world.admin.membership_id, inactive.membership_id, foreign, uuid.uuid4()):
        response = client.post(members_url(unit["id"]), headers=world.headers["admin"], json={"membership_id": str(member)})
        assert response.status_code == 422, member
        assert response.json()["detail"][0]["loc"][-1] == "membership_id"


def test_inactive_unit_cannot_receive_links_and_foreign_units_are_404(client, world):
    unit = make_unit(client, world, name="Inativa")
    client.patch(unit_url(unit["id"]), headers=world.headers["admin"], json={"active": False})
    body = {"membership_id": str(world.nutri.membership_id)}
    assert client.post(members_url(unit["id"]), headers=world.headers["admin"], json=body).status_code == 409
    assert client.post(members_url(uuid.uuid4()), headers=world.headers["admin"], json=body).status_code == 404
    assert client.delete(members_url(uuid.uuid4(), world.nutri.membership_id), headers=world.headers["admin"]).status_code == 404


@pytest.mark.parametrize("payload", [{}, {"membership_id": "nao-e-uuid"}, {"membership_id": None}, {"membership_id": str(uuid.uuid4()), "role": "admin"}])
def test_invalid_link_payload_is_rejected(client, world, payload):
    unit = make_unit(client, world, name="Nova")
    assert client.post(members_url(unit["id"]), headers=world.headers["admin"], json=payload).status_code == 422


# ------------------------------------------------------------------ efeito na agenda do nutricionista

def test_nutritionist_only_sees_and_uses_linked_units(client, world):
    linked = make_unit(client, world, name="Vinculada")
    unlinked = make_unit(client, world, name="Sem vínculo")
    link(client, world, linked["id"])
    seen = {u["id"] for u in client.get("/api/v1/schedule/units", headers=world.headers["nutri"]).json()}
    assert linked["id"] in seen and unlinked["id"] not in seen and str(world.unit) in seen
    # Reception e admin enxergam todas as unidades ativas.
    for who in ("reception", "admin"):
        everyone = {u["id"] for u in client.get("/api/v1/schedule/units", headers=world.headers[who]).json()}
        assert {linked["id"], unlinked["id"], str(world.unit)} <= everyone
    # A API recusa configurar atendimento em unidade não vinculada, e aceita na vinculada.
    denied = client.put(cfg_url(world.nutri), headers=world.headers["nutri"], json=sh.example_config(world.unit, days=days_at(unlinked["id"])))
    assert denied.status_code == 422 and denied.json()["detail"][0]["loc"][-1] == "days"
    allowed = client.put(cfg_url(world.nutri), headers=world.headers["nutri"], json=sh.example_config(world.unit, days=days_at(linked["id"])))
    assert allowed.status_code == 200


def test_admin_editing_another_professional_also_needs_the_link(client, world):
    unit = make_unit(client, world, name="Só da Nutri Um")
    link(client, world, unit["id"], world.nutri)
    body = sh.example_config(world.unit, days=days_at(unit["id"]))
    assert client.put(cfg_url(world.other), headers=world.headers["admin"], json=body).status_code == 422
    assert client.put(cfg_url(world.nutri), headers=world.headers["admin"], json=body).status_code == 200


def test_nutritionist_without_links_sees_no_unit(client, world, make_user, auth_headers):
    lonely = make_user(role="nutritionist", full_name="Sem unidade")
    headers = auth_headers(lonely)
    assert client.get("/api/v1/schedule/units", headers=headers).json() == []
    response = client.put(cfg_url(lonely), headers=headers, json=sh.example_config(world.unit))
    assert response.status_code == 422


# ------------------------------------------------------------------ desvincular

def test_unlink_removes_the_unit_from_the_nutritionist(client, world):
    unit = make_unit(client, world, name="Nova")
    link(client, world, unit["id"])
    result = client.delete(members_url(unit["id"], world.nutri.membership_id), headers=world.headers["admin"])
    assert result.status_code == 200 and result.json()["members"] == []
    assert unit["id"] not in {u["id"] for u in client.get("/api/v1/schedule/units", headers=world.headers["nutri"]).json()}


def test_cannot_unlink_someone_who_still_attends_there(client, configured):
    w = configured  # a agenda de exemplo atende em w.unit
    response = client.delete(members_url(w.unit, w.nutri.membership_id), headers=w.headers["admin"])
    assert response.status_code == 409 and "agenda" in response.json()["detail"]
    ids = {m["id"] for u in client.get("/api/v1/units", headers=w.headers["admin"]).json() if u["id"] == str(w.unit) for m in u["members"]}
    assert str(w.nutri.membership_id) in ids


def test_cannot_unlink_with_future_appointments_there(client, configured):
    w = configured
    booked = client.post("/api/v1/schedule/appointments", headers=w.headers["reception"], json={
        "patient_id": str(w.patient), "professional_id": str(w.nutri.membership_id),
        "appointment_type": "return_consultation", "starts_at": iso(MONDAY, 9)})
    assert booked.status_code == 201
    other_unit = make_unit(client, w, name="Outra")
    link(client, w, other_unit["id"])
    # A agenda passa para outra unidade; a consulta futura continua na primeira e segura o vínculo.
    client.put(cfg_url(w.nutri), headers=w.headers["nutri"], json=sh.example_config(w.unit, days=days_at(other_unit["id"])))
    response = client.delete(members_url(w.unit, w.nutri.membership_id), headers=w.headers["admin"])
    assert response.status_code == 409 and "consultas futuras" in response.json()["detail"]
    client.post(f"/api/v1/schedule/appointments/{booked.json()['id']}/cancel", headers=w.headers["reception"], json={"source": "client"})
    assert client.delete(members_url(w.unit, w.nutri.membership_id), headers=w.headers["admin"]).status_code == 200


def test_unlinking_an_unlinked_account_is_404(client, world):
    unit = make_unit(client, world, name="Nova")
    assert client.delete(members_url(unit["id"], world.nutri.membership_id), headers=world.headers["admin"]).status_code == 404


def test_deactivating_a_member_keeps_the_link_visible_as_inactive(client, world):
    unit = make_unit(client, world, name="Nova")
    link(client, world, unit["id"])
    client.patch(f"/api/v1/team/{world.nutri.membership_id}", headers=world.headers["admin"], json={"active": False})
    listed = {u["id"]: u for u in client.get("/api/v1/units", headers=world.headers["admin"]).json()}
    assert [(m["full_name"], m["active"]) for m in listed[unit["id"]]["members"]] == [("Nutri Um", False)]
