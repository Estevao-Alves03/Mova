from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.security import (
    AuthenticatedUser,
    AuthUnavailableError,
    InvalidTokenError,
    decode_access_token,
)
from app.db.session import get_db
from app.modules.auth.models import Membership, UserRole

bearer_scheme = HTTPBearer(auto_error=False)

DbSession = Annotated[Session, Depends(get_db)]
AppSettings = Annotated[Settings, Depends(get_settings)]

_UNAUTHORIZED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Não autenticado.",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: DbSession,
    settings: AppSettings,
) -> AuthenticatedUser:
    """401 se não houver token válido ou se a sessão foi encerrada."""
    if credentials is None:
        raise _UNAUTHORIZED
    try:
        user = decode_access_token(credentials.credentials, settings)
    except InvalidTokenError as error:
        raise _UNAUTHORIZED from error
    except AuthUnavailableError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Serviço de autenticação indisponível.",
        ) from error

    # Uma consulta só: a sessão ainda existe? o usuário tem 2FA verificado?
    state = db.execute(
        text(
            """
            select exists (select 1 from auth.sessions where id = :sid and user_id = :uid) as session_alive,
                   exists (select 1 from auth.mfa_factors where user_id = :uid and status = 'verified') as has_mfa
            """
        ),
        {"sid": user.session_id, "uid": user.id},
    ).one()
    # Sessão encerrada (ex.: "desconectar dispositivo") perde acesso na hora,
    # sem esperar o access token expirar.
    if user.session_id is None or not state.session_alive:
        raise _UNAUTHORIZED
    # Com 2FA ativado, só vale token que passou pelo segundo fator (aal2).
    if state.has_mfa and user.aal != "aal2":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticação em dois fatores pendente.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


CurrentUser = Annotated[AuthenticatedUser, Depends(get_current_user)]


def get_membership(user: CurrentUser, db: DbSession) -> Membership:
    """403 se o usuário autenticado não tem membership ativo."""
    membership = db.scalars(
        select(Membership)
        .where(Membership.user_id == user.id, Membership.active.is_(True))
        .order_by(Membership.created_at)
        .limit(1)
    ).first()
    if membership is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sem acesso à clínica.")
    return membership


CurrentMembership = Annotated[Membership, Depends(get_membership)]


def require_roles(*roles: UserRole) -> Callable[[Membership], Membership]:
    """403 para papel não permitido."""

    def dependency(membership: CurrentMembership) -> Membership:
        if membership.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado.")
        return membership

    return dependency
