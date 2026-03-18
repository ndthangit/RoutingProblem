"""
Keycloak middleware configuration.

KeycloakConfiguration is built from app settings and the async map_user
function converts the raw token claims into a User that the middleware
stores in request.scope["user"] for every authenticated request.
"""

import logging
from typing import Any
from datetime import datetime, timezone

from fastapi_keycloak_middleware import KeycloakConfiguration

from src.config.config import settings
from src.models.user import User

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Keycloak middleware configuration
# ---------------------------------------------------------------------------
keycloak_config = KeycloakConfiguration(
    url=settings.KEYCLOAK_URL + "/auth/",
    realm=settings.KEYCLOAK_REALM,
    client_id=settings.KEYCLOAK_CLIENT_ID,
    client_secret=settings.KEYCLOAK_CLIENT_SECRET,
    # Claims that will be extracted from the token and passed to map_user
    # Note: not all of these exist in standard OIDC tokens; we keep them
    # optional and derive fallbacks inside map_user.
    claims=[
        "sub",
        "email",
        "preferred_username",
        "username",
        "given_name",
        "family_name",
        "name",
        "email_verified",
        "phone_number",
        # custom claims (if your KC mappers add them)
        "attributes",
        "createdTimestamp",
        "createdAt",
        "enabled",
        "emailVerified",
    ],
    # Set False so requests are not rejected when optional claims are absent
    reject_on_missing_claim=False,
    # True  → verify SSL cert (recommended in production)
    # False → skip (useful in local/dev with HTTP Keycloak)
    # str   → path to CA bundle, e.g. "/etc/ssl/certs/ca.pem"
    verify=False,
)


def _parse_created_at(userinfo: dict[str, Any]) -> datetime:
    """Best-effort parse createdAt from token claims."""
    raw = userinfo.get("createdAt")
    if isinstance(raw, datetime):
        return raw
    if isinstance(raw, str) and raw:
        try:
            # ISO 8601
            return datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except Exception:
            pass

    # Fallback: createdTimestamp (ms)
    ts_ms = userinfo.get("createdTimestamp") or 0
    try:
        ts_ms_int = int(ts_ms)
    except Exception:
        ts_ms_int = 0

    if ts_ms_int > 0:
        return datetime.fromtimestamp(ts_ms_int / 1000, tz=timezone.utc)

    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# User mapper
# ---------------------------------------------------------------------------
async def map_user(userinfo: dict[str, Any]) -> User:
    """
    Map Keycloak token claims to the User model that is stored in
    request.scope["user"] by the middleware.

    Extend this function to:
    - Verify / create the user in Couchbase
    - Attach roles or additional profile data
    """
    logger.debug("Mapping Keycloak userinfo for sub=%s", userinfo.get("sub"))

    # Username can live in different places depending on KC mappers.
    username = (
        userinfo.get("username")
        or userinfo.get("preferred_username")
        or ""
    )

    # Names in standard OIDC are `given_name`/`family_name`.
    first_name = userinfo.get("firstName") or userinfo.get("given_name") or ""
    last_name = userinfo.get("lastName") or userinfo.get("family_name") or ""

    # Phone is often `phone_number` in OIDC; can also be custom.
    phone = userinfo.get("phone") or userinfo.get("phone_number")

    # Email verified in OIDC is `email_verified`.
    email_verified = userinfo.get("emailVerified")
    if email_verified is None:
        email_verified = userinfo.get("email_verified", False)

    # enabled is not normally in tokens; keep default True.
    enabled = userinfo.get("enabled", True)

    created_ts_ms = userinfo.get("createdTimestamp") or 0
    try:
        created_ts_ms = int(created_ts_ms)
    except Exception:
        created_ts_ms = 0

    attributes = userinfo.get("attributes")
    if not isinstance(attributes, dict):
        attributes = {}

    created_at = _parse_created_at(userinfo)

    return User(
        sub=userinfo.get("sub", ""),
        username=username,
        email=userinfo.get("email", ""),
        firstName=first_name,
        lastName=last_name,
        phone=phone,
        enabled=bool(enabled),
        emailVerified=bool(email_verified),
        createdTimestamp=created_ts_ms,
        createdAt=created_at,
        attributes=attributes,
    )
