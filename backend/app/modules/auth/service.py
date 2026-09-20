from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.security import AuthenticatedUser
from app.modules.auth.schemas import SessionOut
from app.modules.auth.user_agent import parse_user_agent

# `auth.sessions` é do Supabase Auth; o backend a acessa com a conexão própria.
# `refreshed_at` é timestamp sem fuso (UTC).
_LIST_SESSIONS = text(
    """
    select id, user_agent, host(ip) as ip, created_at,
           coalesce(refreshed_at at time zone 'UTC', updated_at, created_at) as last_active_at
    from auth.sessions
    where user_id = :uid and (not_after is null or not_after > now())
    order by last_active_at desc
    """
)


def list_sessions(db: Session, user: AuthenticatedUser) -> list[SessionOut]:
    rows = db.execute(_LIST_SESSIONS, {"uid": user.id}).mappings().all()
    sessions = []
    for row in rows:
        agent = parse_user_agent(row["user_agent"])
        sessions.append(
            SessionOut(
                id=row["id"],
                device=agent.device,
                client=agent.client,
                kind=agent.kind,
                ip=row["ip"],
                created_at=row["created_at"],
                last_active_at=row["last_active_at"],
                current=row["id"] == user.session_id,
            )
        )
    return sessions


def revoke_session(db: Session, user: AuthenticatedUser, session_id: UUID) -> None:
    if session_id == user.session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Para encerrar a sessão atual, use Sair da Conta.",
        )
    deleted = db.execute(
        text("delete from auth.sessions where id = :sid and user_id = :uid returning id"),
        {"sid": session_id, "uid": user.id},
    ).first()
    db.commit()
    if deleted is None:
        # Sessão inexistente ou de outro usuário: mesma resposta.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sessão não encontrada.")


def revoke_other_sessions(db: Session, user: AuthenticatedUser) -> None:
    db.execute(
        text("delete from auth.sessions where user_id = :uid and id <> :current"),
        {"uid": user.id, "current": user.session_id},
    )
    db.commit()
