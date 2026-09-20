"""Utilitários dos testes de integração (Supabase local + Auth/Storage reais)."""

import base64
import hashlib
import hmac
import struct
import time
import uuid
from dataclasses import dataclass

import httpx

from app.core.config import Settings

# PNG 1x1 válido.
TINY_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
)
TINY_JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64
TINY_WEBP = b"RIFF\x24\x00\x00\x00WEBPVP8 " + b"\x00" * 32


@dataclass
class TestUser:
    __test__ = False  # não é uma classe de teste

    email: str
    password: str
    user_id: uuid.UUID
    membership_id: uuid.UUID | None
    role: str | None


def service_headers(settings: Settings) -> dict[str, str]:
    key = settings.supabase_service_role_key
    return {"Authorization": f"Bearer {key}", "apikey": key or "", "Content-Type": "application/json"}


def create_auth_user(settings: Settings, email: str, password: str) -> uuid.UUID:
    response = httpx.post(
        f"{settings.supabase_url}/auth/v1/admin/users",
        headers=service_headers(settings),
        json={"email": email, "password": password, "email_confirm": True},
        timeout=15,
    )
    response.raise_for_status()
    return uuid.UUID(response.json()["id"])


def delete_auth_user(settings: Settings, user_id: uuid.UUID) -> None:
    response = httpx.delete(
        f"{settings.supabase_url}/auth/v1/admin/users/{user_id}",
        headers=_no_body_headers(settings),
        timeout=15,
    )
    assert response.status_code in (200, 204, 404), response.text


def login(settings: Settings, email: str, password: str, user_agent: str | None = None) -> str:
    headers = {"apikey": settings.supabase_anon_key or "", "Content-Type": "application/json"}
    if user_agent:
        headers["User-Agent"] = user_agent
    response = httpx.post(
        f"{settings.supabase_url}/auth/v1/token?grant_type=password",
        headers=headers,
        json={"email": email, "password": password},
        timeout=15,
    )
    response.raise_for_status()
    return response.json()["access_token"]


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _no_body_headers(settings: Settings) -> dict[str, str]:
    # DELETE/GET sem corpo: o Storage rejeita Content-Type: application/json vazio.
    return {k: v for k, v in service_headers(settings).items() if k != "Content-Type"}


def delete_storage_object(settings: Settings, path: str) -> None:
    response = httpx.delete(
        f"{settings.supabase_url}/storage/v1/object/avatars/{path}",
        headers=_no_body_headers(settings),
        timeout=15,
    )
    assert response.status_code in (200, 204, 404), response.text


def storage_object_exists(settings: Settings, path: str) -> bool:
    response = httpx.get(
        f"{settings.supabase_url}/storage/v1/object/info/avatars/{path}",
        headers=_no_body_headers(settings),
        timeout=15,
    )
    return response.status_code == 200


def totp_code(secret: str, at: float | None = None) -> str:
    """Código TOTP (RFC 6238, SHA-1, 6 dígitos, 30s) a partir do segredo base32."""
    key = base64.b32decode(secret.replace(" ", "").upper() + "=" * (-len(secret) % 8))
    counter = int((at if at is not None else time.time()) // 30)
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    value = (struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF) % 1_000_000
    return f"{value:06d}"


def enroll_totp(settings: Settings, access_token: str) -> tuple[str, str]:
    """Cadastra e verifica um fator TOTP para o usuário do token. Retorna (factor_id, secret)."""
    headers = {"apikey": settings.supabase_anon_key or "", "Authorization": f"Bearer {access_token}",
               "Content-Type": "application/json"}
    base = f"{settings.supabase_url}/auth/v1/factors"
    factor = httpx.post(base, headers=headers, json={"factor_type": "totp", "friendly_name": uuid.uuid4().hex[:8]},
                        timeout=15)
    factor.raise_for_status()
    factor_id, secret = factor.json()["id"], factor.json()["totp"]["secret"]
    verify_totp(settings, access_token, factor_id, secret)
    return factor_id, secret


def verify_totp(settings: Settings, access_token: str, factor_id: str, secret: str) -> str:
    """Desafio + verificação. Retorna o novo access token (aal2)."""
    headers = {"apikey": settings.supabase_anon_key or "", "Authorization": f"Bearer {access_token}",
               "Content-Type": "application/json"}
    base = f"{settings.supabase_url}/auth/v1/factors/{factor_id}"
    challenge = httpx.post(f"{base}/challenge", headers=headers, json={}, timeout=15)
    challenge.raise_for_status()
    response = httpx.post(f"{base}/verify", headers=headers,
                          json={"challenge_id": challenge.json()["id"], "code": totp_code(secret)}, timeout=15)
    response.raise_for_status()
    return response.json()["access_token"]
