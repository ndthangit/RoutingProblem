from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status

from src.config.couchbase import CouchbaseClient
from src.dependencies import get_current_user
from src.models.user import User, UserProfileResponse, UserProfileUpdate
from src.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["users"])


def _get_service(request: Request) -> UserService:
    cb: CouchbaseClient = getattr(request.app.state, "couchbase", None)
    if cb is None:
        raise RuntimeError("Couchbase client not available on app.state")
    return UserService(cb)


def _require_current_sub(current_user: User) -> None:
    if not current_user.sub:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current user has no Keycloak subject",
        )


@router.get("/me", response_model=UserProfileResponse)
async def get_my_profile(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    _require_current_sub(current_user)

    service = _get_service(request)
    user = await service.get_user(current_user.sub)
    return UserProfileResponse(exists=user is not None, user=user or current_user)


@router.put("/me", response_model=User)
async def upsert_my_profile(
    payload: UserProfileUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    _require_current_sub(current_user)

    if not payload.firstName.strip() or not payload.lastName.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="First name and last name are required",
        )

    service = _get_service(request)
    return await service.upsert_profile(current_user, payload)
