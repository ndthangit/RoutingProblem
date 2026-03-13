"""
FastAPI dependencies.

get_current_user
  – Retrieves the AuthUser stored in request.scope["user"] by the
    fastapi-keycloak-middleware after it validates the Bearer JWT.
  – Raises HTTP 401 if the middleware did not populate the user (e.g. the
    route is called without a valid token).

get_current_user_email  (convenience wrapper)
  – Returns only the email string for endpoints that only need the email.
"""

import logging

from fastapi import Depends, HTTPException, Request, status

from models.user import User

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Primary dependency
# ---------------------------------------------------------------------------
async def get_current_user(request: Request) -> User:
    """
    Return the User placed in request.scope["user"] by the Keycloak
    middleware.  Raises HTTP 401 when no user is present.
    """
    user: User | None = request.scope.get("user")
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


# ---------------------------------------------------------------------------
# Convenience helper
# ---------------------------------------------------------------------------
async def get_current_user_email(user: User = Depends(get_current_user)) -> str:
    """Return only the email of the authenticated user."""
    return user.email
