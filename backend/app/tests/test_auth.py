"""JWT e acesso: sem token/expirado/inválido = 401; válido sem membership = 403."""

import time
import uuid

import jwt
import pytest

from app.core.config import Settings
from app.core.deps import get_current_user  # noqa: F401  (garante import do módulo)
from app.core.security import InvalidTokenError, decode_access_token
from app.tests import helpers

SECRET = "x" * 40


@pytest.fixture
def hs_settings(settings: Settings) -> Settings:
    """Settings com segredo HS256, só para forjar tokens de teste."""
    return settings.model_copy(update={"supabase_jwt_secret": SECRET})


def _token(hs_settings: Settings, **overrides) -> str:
    claims = {
        "sub": str(uuid.uuid4()),
        "aud": "authenticated",
        "iss": hs_settings.auth_issuer,
        "exp": int(time.time()) + 600,
        "session_id": str(uuid.uuid4()),
    }
    claims.update(overrides)
    return jwt.encode({k: v for k, v in claims.items() if v is not None}, SECRET, algorithm="HS256")


@pytest.mark.parametrize("path", ["/api/v1/profile", "/api/v1/auth/sessions"])
def test_without_token_is_401(client, path):
    response = client.get(path)
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_malformed_token_is_401(client):
    assert client.get("/api/v1/profile", headers=helpers.bearer("abc.def.ghi")).status_code == 401


def test_valid_jwt_without_membership_is_403(client, settings, make_user, auth_headers):
    user = make_user(role=None)
    assert client.get("/api/v1/profile", headers=auth_headers(user)).status_code == 403


def test_inactive_membership_is_403(client, settings, make_user, auth_headers):
    from sqlalchemy import text

    from app.db.session import get_engine

    user = make_user(role="nutritionist")
    with get_engine().begin() as conn:
        conn.execute(text("update memberships set active = false where id = :id"), {"id": user.membership_id})
    assert client.get("/api/v1/profile", headers=auth_headers(user)).status_code == 403


def test_expired_token_is_rejected(hs_settings):
    with pytest.raises(InvalidTokenError):
        decode_access_token(_token(hs_settings, exp=int(time.time()) - 10), hs_settings)


def test_wrong_audience_is_rejected(hs_settings):
    with pytest.raises(InvalidTokenError):
        decode_access_token(_token(hs_settings, aud="anon"), hs_settings)


def test_wrong_issuer_is_rejected(hs_settings):
    with pytest.raises(InvalidTokenError):
        decode_access_token(_token(hs_settings, iss="https://evil.example/auth/v1"), hs_settings)


def test_missing_expiration_is_rejected(hs_settings):
    with pytest.raises(InvalidTokenError):
        decode_access_token(_token(hs_settings, exp=None), hs_settings)


def test_bad_signature_is_rejected(hs_settings):
    forged = jwt.encode(
        {"sub": str(uuid.uuid4()), "aud": "authenticated", "iss": hs_settings.auth_issuer,
         "exp": int(time.time()) + 600},
        "another-secret-with-more-than-32-bytes!!", algorithm="HS256",
    )
    with pytest.raises(InvalidTokenError):
        decode_access_token(forged, hs_settings)


def test_hs256_is_rejected_when_no_secret_is_configured(settings, hs_settings):
    # Projeto com JWKS: um HS256 forjado nunca pode ser aceito.
    assert settings.supabase_jwt_secret is None
    with pytest.raises(InvalidTokenError):
        decode_access_token(_token(hs_settings), settings)


def test_alg_none_is_rejected(hs_settings):
    unsigned = jwt.encode({"sub": str(uuid.uuid4()), "aud": "authenticated", "iss": hs_settings.auth_issuer,
                           "exp": int(time.time()) + 600}, key=None, algorithm="none")
    with pytest.raises(InvalidTokenError):
        decode_access_token(unsigned, hs_settings)


def test_role_is_never_read_from_the_token(client, settings, make_user, auth_headers):
    """user_metadata/app_metadata com role='admin' não dá acesso: vale o membership."""
    user = make_user(role="receptionist")
    profile = client.get("/api/v1/profile", headers=auth_headers(user)).json()
    assert profile["role"] == "receptionist"


def test_revoked_session_loses_access_immediately(client, settings, make_user):
    user = make_user()
    token_a = helpers.login(settings, user.email, user.password)
    token_b = helpers.login(settings, user.email, user.password)
    sessions = client.get("/api/v1/auth/sessions", headers=helpers.bearer(token_b)).json()
    other = next(s for s in sessions if not s["current"])

    assert client.get("/api/v1/profile", headers=helpers.bearer(token_a)).status_code == 200
    assert client.delete(f"/api/v1/auth/sessions/{other['id']}", headers=helpers.bearer(token_b)).status_code == 204
    assert client.get("/api/v1/profile", headers=helpers.bearer(token_a)).status_code == 401
    assert client.get("/api/v1/profile", headers=helpers.bearer(token_b)).status_code == 200


def test_with_2fa_enabled_a_password_only_token_is_rejected(client, settings, make_user):
    """2FA não é decorativo: token aal1 (só senha) perde acesso; aal2 (com código) acessa."""
    user = make_user()
    first = helpers.login(settings, user.email, user.password)
    assert client.get("/api/v1/profile", headers=helpers.bearer(first)).status_code == 200  # ainda sem 2FA

    factor_id, secret = helpers.enroll_totp(settings, first)

    password_only = helpers.login(settings, user.email, user.password)
    denied = client.get("/api/v1/profile", headers=helpers.bearer(password_only))
    assert denied.status_code == 401
    assert "dois fatores" in denied.json()["detail"]

    second_factor = helpers.verify_totp(settings, password_only, factor_id, secret)
    assert client.get("/api/v1/profile", headers=helpers.bearer(second_factor)).status_code == 200
    assert client.get("/api/v1/auth/sessions", headers=helpers.bearer(second_factor)).status_code == 200


def test_unverified_factor_does_not_block_access(client, settings, make_user):
    import httpx

    user = make_user()
    token = helpers.login(settings, user.email, user.password)
    httpx.post(
        f"{settings.supabase_url}/auth/v1/factors",
        headers={"apikey": settings.supabase_anon_key, "Authorization": f"Bearer {token}"},
        json={"factor_type": "totp", "friendly_name": "pendente"}, timeout=15,
    ).raise_for_status()
    assert client.get("/api/v1/profile", headers=helpers.bearer(helpers.login(settings, user.email, user.password))).status_code == 200
