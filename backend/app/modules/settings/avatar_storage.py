"""Fotos de perfil no bucket privado `avatars` do Supabase Storage.

Só o backend fala com o Storage (com a service_role). O front recebe URLs
assinadas de curta duração e nunca acessa o bucket diretamente.
"""

import logging
from typing import Annotated

import httpx
from fastapi import Depends, HTTPException, status

from app.core.config import Settings, get_settings

BUCKET = "avatars"
SIGNED_URL_TTL_SECONDS = 3600
_TIMEOUT = httpx.Timeout(10.0)

logger = logging.getLogger(__name__)


class StorageError(Exception):
    pass


class AvatarStorage:
    def __init__(self, settings: Settings) -> None:
        if not settings.supabase_service_role_key:
            raise StorageError("SUPABASE_SERVICE_ROLE_KEY não configurada")
        self._base = f"{settings.supabase_url}/storage/v1"
        key = settings.supabase_service_role_key
        self._headers = {"Authorization": f"Bearer {key}", "apikey": key}

    def upload(self, path: str, data: bytes, content_type: str) -> None:
        try:
            response = httpx.post(
                f"{self._base}/object/{BUCKET}/{path}",
                content=data,
                headers={**self._headers, "Content-Type": content_type, "x-upsert": "false"},
                timeout=_TIMEOUT,
            )
            response.raise_for_status()
        except httpx.HTTPError as error:
            raise StorageError("falha ao enviar a foto") from error

    def delete(self, path: str) -> None:
        try:
            response = httpx.delete(
                f"{self._base}/object/{BUCKET}/{path}", headers=self._headers, timeout=_TIMEOUT
            )
            if response.status_code not in (200, 204, 404):
                response.raise_for_status()
        except httpx.HTTPError as error:
            # Objeto órfão não afeta o usuário; registra para limpeza.
            logger.warning("Falha ao remover objeto %s do Storage: %s", path, error)

    def signed_url(self, path: str) -> str | None:
        try:
            response = httpx.post(
                f"{self._base}/object/sign/{BUCKET}/{path}",
                json={"expiresIn": SIGNED_URL_TTL_SECONDS},
                headers=self._headers,
                timeout=_TIMEOUT,
            )
            response.raise_for_status()
            return f"{self._base}{response.json()['signedURL']}"
        except (httpx.HTTPError, KeyError, ValueError) as error:
            logger.warning("Falha ao assinar URL de %s: %s", path, error)
            return None


def get_avatar_storage(settings: Annotated[Settings, Depends(get_settings)]) -> AvatarStorage:
    try:
        return AvatarStorage(settings)
    except StorageError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Armazenamento de fotos indisponível.",
        ) from error


def get_optional_avatar_storage(
    settings: Annotated[Settings, Depends(get_settings)],
) -> AvatarStorage | None:
    """Para leituras: sem Storage configurado o perfil apenas não tem foto."""
    try:
        return AvatarStorage(settings)
    except StorageError:
        return None
