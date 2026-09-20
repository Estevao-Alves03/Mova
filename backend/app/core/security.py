"""Validação do JWT emitido pelo Supabase Auth.

Assinatura, `exp`, `aud=authenticated` e `iss` são obrigatórios. A chave vem do
JWKS do projeto (ES256/RS256); o segredo HS256 só é usado se configurado
(chave legada). O papel do usuário NUNCA vem do token: vem de `memberships`.
"""

from dataclasses import dataclass
from functools import lru_cache
from uuid import UUID

import jwt
from jwt import PyJWKClient

from app.core.config import Settings


class InvalidTokenError(Exception):
    """Token inválido ou expirado (assinatura, expiração, audiência, emissor...)."""


class AuthUnavailableError(Exception):
    """Não foi possível obter as chaves de validação (JWKS indisponível)."""


@dataclass(frozen=True)
class AuthenticatedUser:
    id: UUID
    email: str | None
    session_id: UUID | None
    aal: str | None


@lru_cache
def _jwks_client(url: str) -> PyJWKClient:
    return PyJWKClient(url, cache_keys=True, lifespan=3600, timeout=5)


def _parse_uuid(value: object) -> UUID:
    try:
        return UUID(str(value))
    except ValueError as error:
        raise InvalidTokenError("identificador inválido") from error


def decode_access_token(token: str, settings: Settings) -> AuthenticatedUser:
    try:
        algorithm = jwt.get_unverified_header(token).get("alg")
        if algorithm in ("ES256", "RS256"):
            key: object = _jwks_client(settings.jwks_url).get_signing_key_from_jwt(token).key
        elif algorithm == "HS256" and settings.supabase_jwt_secret:
            key = settings.supabase_jwt_secret
        else:
            raise InvalidTokenError("algoritmo não permitido")

        claims = jwt.decode(
            token,
            key,  # type: ignore[arg-type]
            algorithms=[algorithm],
            audience="authenticated",
            issuer=settings.auth_issuer,
            options={"require": ["exp", "sub", "aud", "iss"]},
        )
    except jwt.PyJWKClientConnectionError as error:
        raise AuthUnavailableError from error
    except jwt.PyJWTError as error:
        raise InvalidTokenError(str(error)) from error

    session_id = claims.get("session_id")
    return AuthenticatedUser(
        id=_parse_uuid(claims["sub"]),
        email=claims.get("email"),
        session_id=_parse_uuid(session_id) if session_id else None,
        aal=claims.get("aal"),
    )
