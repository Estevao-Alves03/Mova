from typing import Annotated

from fastapi import APIRouter, Depends, File, UploadFile

from app.core.deps import CurrentMembership, CurrentUser, DbSession
from app.modules.settings import service
from app.modules.settings.avatar_storage import (
    AvatarStorage,
    get_avatar_storage,
    get_optional_avatar_storage,
)
from app.modules.settings.schemas import ProfileOut, ProfileUpdate

router = APIRouter(prefix="/profile", tags=["profile"])

Storage = Annotated[AvatarStorage, Depends(get_avatar_storage)]
OptionalStorage = Annotated[AvatarStorage | None, Depends(get_optional_avatar_storage)]


@router.get("", response_model=ProfileOut)
def read_profile(
    user: CurrentUser, membership: CurrentMembership, db: DbSession, storage: OptionalStorage
) -> ProfileOut:
    return service.build_profile(db, membership, user, storage)


@router.patch("", response_model=ProfileOut)
def update_profile(
    payload: ProfileUpdate,
    user: CurrentUser,
    membership: CurrentMembership,
    db: DbSession,
    storage: OptionalStorage,
) -> ProfileOut:
    service.update_profile(db, membership, payload)
    return service.build_profile(db, membership, user, storage)


@router.post("/avatar", response_model=ProfileOut)
def upload_avatar(
    user: CurrentUser,
    membership: CurrentMembership,
    db: DbSession,
    storage: Storage,
    file: Annotated[UploadFile, File()],
) -> ProfileOut:
    service.set_avatar(db, membership, file, storage)
    return service.build_profile(db, membership, user, storage)


@router.delete("/avatar", response_model=ProfileOut)
def delete_avatar(
    user: CurrentUser, membership: CurrentMembership, db: DbSession, storage: Storage
) -> ProfileOut:
    service.remove_avatar(db, membership, storage)
    return service.build_profile(db, membership, user, storage)
