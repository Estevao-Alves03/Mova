"""Criação e remoção de usuários no Supabase Auth (API admin, só com a service_role).

Só o backend fala com a API admin: o front nunca recebe a chave e nunca cria usuário direto.
"""

import logging
import secrets
from typing import Annotated
from uuid import UUID

import httpx
from fastapi import Depends, HTTPException, status

from app.core.config import Settings, get_settings

_TIMEOUT = httpx.Timeout(10.0)

logger = logging.getLogger(__name__)


class AuthAdminError(Exception):
    """Falha ao falar com o Supabase Auth."""


class EmailAlreadyRegistered(Exception):
    pass


def generate_temporary_password() -> str:
    """12 caracteres em 3 grupos (ex.: `Kq7m-Vd3x-Tn8p`), sem caracteres ambíguos (0/O, 1/l/I)."""
    upper, lower, digits = "ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789"
    chars = [secrets.choice(upper), secrets.choice(lower), secrets.choice(digits)]
    chars += [secrets.choice(upper + lower + digits) for _ in range(9)]
    secrets.SystemRandom().shuffle(chars)
    raw = "".join(chars)
    return f"{raw[:4]}-{raw[4:8]}-{raw[8:]}"


class AuthAdmin:
    def __init__(self, settings: Settings) -> None:
        if not settings.supabase_service_role_key:
            raise AuthAdminError("SUPABASE_SERVICE_ROLE_KEY não configurada")
        self._base = f"{settings.supabase_url}/auth/v1/admin/users"
        key = settings.supabase_service_role_key
        self._headers = {"Authorization": f"Bearer {key}", "apikey": key}

    def create_user(self, email: str, password: str) -> UUID:
        try:
            response = httpx.post(
                self._base,
                json={"email": email, "password": password, "email_confirm": True},
                headers=self._headers,
                timeout=_TIMEOUT,
            )
        except httpx.HTTPError as error:
            raise AuthAdminError("falha ao criar o usuário") from error
        if response.status_code in (200, 201):
            return UUID(response.json()["id"])
        body = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
        if response.status_code in (409, 422) and body.get("error_code") in ("email_exists", "user_already_exists"):
            raise EmailAlreadyRegistered
        logger.warning("Supabase Auth recusou a criação de usuário: %s %s", response.status_code, body.get("error_code"))
        raise AuthAdminError("o Supabase Auth recusou a criação do usuário")

    def delete_user(self, user_id: UUID) -> None:
        """Compensação quando o cadastro no banco falha depois de criar o usuário."""
        try:
            response = httpx.delete(f"{self._base}/{user_id}", headers=self._headers, timeout=_TIMEOUT)
            if response.status_code not in (200, 204, 404):
                response.raise_for_status()
        except httpx.HTTPError as error:
            logger.error("Usuário %s ficou órfão no Supabase Auth: %s", user_id, error)


def get_auth_admin(settings: Annotated[Settings, Depends(get_settings)]) -> AuthAdmin:
    try:
        return AuthAdmin(settings)
    except AuthAdminError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Criação de usuários indisponível."
        ) from error
