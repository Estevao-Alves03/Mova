import uuid
from collections.abc import Callable, Iterator

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.core.config import Settings, get_settings
from app.db.session import get_engine
from app.main import app
from app.tests import helpers
from app.tests.helpers import TestUser


@pytest.fixture(scope="session")
def settings() -> Settings:
    settings = get_settings()
    try:
        httpx.get(f"{settings.supabase_url}/auth/v1/health", timeout=5).raise_for_status()
    except httpx.HTTPError:
        pytest.exit(
            "Supabase local indisponível. Rode `npx supabase start` (raiz do repositório) "
            "e confira backend/.env (ver .env.example).",
            returncode=2,
        )
    assert settings.supabase_service_role_key and settings.supabase_anon_key, (
        "Defina SUPABASE_SERVICE_ROLE_KEY e SUPABASE_ANON_KEY em backend/.env"
    )
    return settings


@pytest.fixture(scope="session")
def client(settings: Settings) -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def clinic() -> Iterator[uuid.UUID]:
    """Clínica descartável: cada teste é isolado e não toca nos dados do seed."""
    clinic_id = uuid.uuid4()
    with get_engine().begin() as conn:
        conn.execute(
            text("insert into clinics (id, name) values (:id, 'Clínica de Teste')"), {"id": clinic_id}
        )
    yield clinic_id


@pytest.fixture
def make_user(settings: Settings, clinic: uuid.UUID) -> Iterator[Callable[..., TestUser]]:
    created: list[TestUser] = []

    def factory(role: str | None = "nutritionist", full_name: str = "Usuário de Teste", **fields) -> TestUser:
        email = f"teste-{uuid.uuid4().hex[:10]}@mova.test"
        password = f"Senha-{uuid.uuid4().hex[:10]}"
        user_id = helpers.create_auth_user(settings, email, password)
        membership_id = None
        if role is not None:
            membership_id = uuid.uuid4()
            columns = {"phone": None, "crn": None, "crn_state": None, "specialty": None, "bio": None, **fields}
            with get_engine().begin() as conn:
                conn.execute(
                    text(
                        """
                        insert into memberships (id, clinic_id, user_id, role, full_name, phone, crn,
                                                 crn_state, specialty, bio)
                        values (:id, :clinic, :user, cast(:role as user_role), :name, :phone, :crn,
                                :crn_state, :specialty, :bio)
                        """
                    ),
                    {"id": membership_id, "clinic": clinic, "user": user_id, "role": role,
                     "name": full_name, **columns},
                )
        user = TestUser(email, password, user_id, membership_id, role)
        created.append(user)
        return user

    yield factory

    with get_engine().begin() as conn:
        paths = conn.execute(
            text("select avatar_path from memberships where clinic_id = :c and avatar_path is not null"),
            {"c": clinic},
        ).scalars().all()
        conn.execute(text("delete from appointments where clinic_id = :c"), {"c": clinic})
        conn.execute(text("delete from patients where clinic_id = :c"), {"c": clinic})
        conn.execute(text("delete from professional_availability where clinic_id = :c"), {"c": clinic})
        conn.execute(text("delete from memberships where clinic_id = :c"), {"c": clinic})
        conn.execute(text("delete from rooms where clinic_id = :c"), {"c": clinic})
        conn.execute(text("delete from units where clinic_id = :c"), {"c": clinic})
        conn.execute(text("delete from clinics where id = :c"), {"c": clinic})
    for path in paths:
        helpers.delete_storage_object(settings, path)
    for user in created:
        helpers.delete_auth_user(settings, user.user_id)


@pytest.fixture
def auth_headers(settings: Settings) -> Callable[[TestUser], dict[str, str]]:
    def build(user: TestUser) -> dict[str, str]:
        return helpers.bearer(helpers.login(settings, user.email, user.password))

    return build


# ---------------------------------------------------------------------------
# Agenda: um "mundo" com nutricionista, outro nutricionista, recepção, admin,
# unidade e paciente, todos na mesma clínica descartável.
# ---------------------------------------------------------------------------

from dataclasses import dataclass, field  # noqa: E402

from app.tests import schedule_helpers as sh  # noqa: E402


@dataclass
class World:
    clinic: uuid.UUID
    unit: uuid.UUID
    patient: uuid.UUID
    nutri: TestUser
    other: TestUser
    reception: TestUser
    admin: TestUser
    headers: dict[str, dict[str, str]] = field(default_factory=dict)


@pytest.fixture
def world(clinic, make_user, auth_headers) -> World:
    nutri = make_user(role="nutritionist", full_name="Nutri Um")
    other = make_user(role="nutritionist", full_name="Nutri Dois")
    reception = make_user(role="receptionist", full_name="Recepção")
    admin = make_user(role="admin", full_name="Admin")
    unit = sh.insert_unit(clinic)
    patient = sh.insert_patient(clinic, nutri.membership_id, "Paciente Um")
    return World(
        clinic=clinic, unit=unit, patient=patient, nutri=nutri, other=other, reception=reception, admin=admin,
        headers={name: auth_headers(user) for name, user in
                 {"nutri": nutri, "other": other, "reception": reception, "admin": admin}.items()},
    )


@pytest.fixture
def configured(client, world) -> World:
    """Nutricionista com a agenda do exemplo já configurada."""
    response = client.put(
        f"/api/v1/schedule/professionals/{world.nutri.membership_id}/config",
        headers=world.headers["nutri"], json=sh.example_config(world.unit),
    )
    assert response.status_code == 200, response.text
    return world
