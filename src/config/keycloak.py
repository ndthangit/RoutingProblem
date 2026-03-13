"""
Keycloak middleware configuration.

KeycloakConfiguration is built from app settings and the async map_user
function converts the raw token claims into a User that the middleware
stores in request.scope["user"] for every authenticated request.
"""

import logging
from typing import Any

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
    claims=["sub", "email", "name", "preferred_username"],
    # Set False so requests are not rejected when optional claims are absent
    reject_on_missing_claim=False,
    # True  → verify SSL cert (recommended in production)
    # False → skip (useful in local/dev with HTTP Keycloak)
    # str   → path to CA bundle, e.g. "/etc/ssl/certs/ca.pem"
    verify=False,
)


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
    return User(
        sub=userinfo.get("sub", ""),
        email=userinfo.get("email", ""),
        name=userinfo.get("name") or userinfo.get("preferred_username", ""),
    )
