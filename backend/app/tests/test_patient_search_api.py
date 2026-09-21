"""Busca principal (campo do topo): `GET /patients/search` por nome, telefone e e-mail."""

import uuid

import pytest
from sqlalchemy import text

from app.db.session import get_engine
from app.tests import schedule_helpers as sh

URL = "/api/v1/patients/search"


def add(w, name, phone=None, email=None, owner=None, clinic=None):
    patient = sh.insert_patient(clinic or w.clinic, owner if owner is not None else w.nutri.membership_id, name)
    with get_engine().begin() as conn:
        conn.execute(text("update patients set phone = :p, email = :e where id = :i"), {"p": phone, "e": email, "i": patient})
    return patient


def search(client, w, q, who="reception", **params):
    return client.get(URL, headers=w.headers[who], params={"q": q, **params})


def names(response):
    assert response.status_code == 200, response.text
    return [item["full_name"] for item in response.json()]


@pytest.fixture
def people(world):
    add(world, "Camila Vasconcellos", "(11) 98741-2030", "camila.vasconcellos@email.com")
    add(world, "Mariana Siqueira", "(21) 97777-1234", "mari.siqueira@gmail.com")
    add(world, "José Ângelo Pereira", "(31) 3284-9000", None)
    add(world, "João Camilo", None, "joao@uol.com.br")
    return world


# ------------------------------------------------------------------ permissões e escopo

def test_search_requires_a_staff_role(client, world, make_user, auth_headers):
    assert client.get(URL, params={"q": "ab"}).status_code == 401
    for user in (make_user(role="patient"), make_user(role=None)):
        assert client.get(URL, headers=auth_headers(user), params={"q": "ab"}).status_code == 403


def test_every_staff_role_can_search(client, people):
    for who in ("reception", "admin", "nutri"):
        assert "Camila Vasconcellos" in names(search(client, people, "camila", who))


def test_nutritionist_only_finds_own_patients(client, people):
    add(people, "Camila da Outra", owner=people.other.membership_id)
    own = names(search(client, people, "camila", "nutri"))
    assert "Camila da Outra" not in own and "Camila Vasconcellos" in own
    assert names(search(client, people, "camila", "other")) == ["Camila da Outra"]
    assert "Camila da Outra" in names(search(client, people, "camila", "admin"))


def test_results_are_isolated_by_clinic_and_hide_deleted(client, people):
    foreign = uuid.uuid4()
    with get_engine().begin() as conn:
        conn.execute(text("insert into clinics (id, name) values (:i, 'Outra')"), {"i": foreign})
    try:
        add(people, "Camila de Outra Clínica", clinic=foreign, owner=None)
        removed = add(people, "Camila Removida")
        with get_engine().begin() as conn:
            conn.execute(text("update patients set deleted_at = now() where id = :i"), {"i": removed})
        found = names(search(client, people, "camila", "admin"))
        assert "Camila de Outra Clínica" not in found and "Camila Removida" not in found
    finally:
        with get_engine().begin() as conn:
            conn.execute(text("delete from patients where clinic_id = :i"), {"i": foreign})
            conn.execute(text("delete from clinics where id = :i"), {"i": foreign})


def test_search_never_returns_clinical_data(client, configured):
    w = configured
    client.post("/api/v1/patients", headers=w.headers["reception"], json={
        "full_name": "Com Objetivo Secreto", "phone": "11987412030", "nutritionist_id": str(w.nutri.membership_id),
        "first_appointment": {"starts_at": sh.iso(sh.next_weekday(1), 9), "goal": "muscle_gain", "notes": "nota clínica"}})
    for who in ("reception", "admin", "nutri"):
        body = search(client, w, "objetivo", who).text
        assert "Com Objetivo Secreto" in body
        assert "goal" not in body and "muscle_gain" not in body and "nota clínica" not in body and "situation" not in body


def test_result_shape(client, people):
    item = search(client, people, "camila v").json()[0]
    assert set(item) == {"id", "full_name", "birth_date", "sex", "phone", "email"}
    assert item["phone"] == "(11) 98741-2030" and item["email"] == "camila.vasconcellos@email.com"


# ------------------------------------------------------------------ por nome

@pytest.mark.parametrize("q", ["camila", "CAMILA", "Camila Vasc", "vasconcellos", "asconc", "  camila   vasconcellos  "])
def test_name_matches_ignoring_case_and_partial_words(client, people, q):
    assert "Camila Vasconcellos" in names(search(client, people, q))


@pytest.mark.parametrize("q", ["jose", "JOSÉ", "angelo", "ângelo", "jose angelo", "joão", "joao"])
def test_name_matches_ignoring_accents(client, people, q):
    found = names(search(client, people, q))
    assert ("José Ângelo Pereira" in found) or ("João Camilo" in found)


def test_accents_are_ignored_in_both_directions(client, people):
    assert names(search(client, people, "jose angelo")) == ["José Ângelo Pereira"]
    assert names(search(client, people, "josé ângelo")) == ["José Ângelo Pereira"]
    assert names(search(client, people, "joao")) == ["João Camilo"]


def test_names_starting_with_the_term_come_first(client, world):
    for name in ("Ana Maria", "Maria Clara", "Fernanda Maria", "Mariana Lima"):
        add(world, name)
    assert names(search(client, world, "maria")) == ["Maria Clara", "Mariana Lima", "Ana Maria", "Fernanda Maria"]


# ------------------------------------------------------------------ por telefone

@pytest.mark.parametrize("q", ["11987412030", "(11) 98741-2030", "98741", "98741-2030", "11 98741", "2030", "(11) 9874"])
def test_phone_matches_by_digits_regardless_of_formatting(client, people, q):
    assert names(search(client, people, q)) == ["Camila Vasconcellos"]


def test_landline_and_other_area_codes(client, people):
    assert names(search(client, people, "3284-9000")) == ["José Ângelo Pereira"]
    assert names(search(client, people, "(21)")) == ["Mariana Siqueira"]


def test_a_name_is_never_matched_through_the_phone(client, world):
    add(world, "Fulano", phone="(11) 91234-5678")
    assert names(search(client, world, "fu")) == ["Fulano"]
    assert names(search(client, world, "ab")) == []


# ------------------------------------------------------------------ por e-mail

@pytest.mark.parametrize("q", ["camila.vasconcellos@email.com", "CAMILA.VASCONCELLOS@EMAIL.COM", "@email.com", "vasconcellos@", "email.com"])
def test_email_matches_full_or_partial_ignoring_case(client, people, q):
    assert "Camila Vasconcellos" in names(search(client, people, q))


def test_email_domain_search_finds_every_owner(client, people):
    assert names(search(client, people, "@gmail")) == ["Mariana Siqueira"]
    assert names(search(client, people, "uol.com")) == ["João Camilo"]


def test_email_inside_the_name_term_also_matches_names_and_emails(client, people):
    found = names(search(client, people, "camil"))
    assert set(found) == {"Camila Vasconcellos", "João Camilo"}


# ------------------------------------------------------------------ robustez

@pytest.mark.parametrize("q", ["a", "", " "])
def test_too_short_terms_are_rejected(client, people, q):
    assert search(client, people, q).status_code == 422


def test_padding_does_not_count_towards_the_minimum(client, people):
    response = search(client, people, "  a ")
    assert response.status_code == 200 and response.json() == []


def test_term_and_limit_bounds(client, world):
    assert search(client, world, "x" * 101).status_code == 422
    assert search(client, world, "ab", limit=0).status_code == 422
    assert search(client, world, "ab", limit=21).status_code == 422
    assert client.get(URL, headers=world.headers["admin"]).status_code == 422  # sem q


def test_limit_caps_the_results(client, world):
    for index in range(12):
        add(world, f"Teste {index:02d}")
    assert len(names(search(client, world, "teste"))) == 8
    assert len(names(search(client, world, "teste", limit=3))) == 3
    assert len(names(search(client, world, "teste", limit=20))) == 12


@pytest.mark.parametrize("q", ["%%", "__", "%_", "\\\\", "a%", "%a", "100%"])
def test_like_wildcards_are_literal(client, world, q):
    add(world, "Alguém Comum", "(11) 98741-2030", "alguem@email.com")
    assert names(search(client, world, q)) == []


def test_literal_special_characters_still_match(client, world):
    add(world, "Ana 100% Paciente")
    add(world, "Bia_Souza")
    assert names(search(client, world, "100%")) == ["Ana 100% Paciente"]
    assert names(search(client, world, "a_s")) == ["Bia_Souza"]


@pytest.mark.parametrize("q", ["'; drop table patients; --", "\" or 1=1 --", "a' or '1'='1", "<script>alert(1)</script>"])
def test_hostile_input_is_treated_as_text(client, world, q):
    add(world, "Paciente Normal")
    assert names(search(client, world, q)) == []
    assert names(search(client, world, "normal")) == ["Paciente Normal"]  # a tabela segue intacta


def test_no_match_returns_an_empty_list(client, people):
    response = search(client, people, "zzzzzz")
    assert response.status_code == 200 and response.json() == []


def test_patients_list_now_carries_the_email(client, people):
    item = next(i for i in client.get("/api/v1/patients", headers=people.headers["reception"]).json() if i["full_name"] == "Camila Vasconcellos")
    assert item["email"] == "camila.vasconcellos@email.com"
