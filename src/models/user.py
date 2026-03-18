from typing import Optional, Any

from pydantic import BaseModel, Field
from datetime import datetime, timezone


class User(BaseModel):
    """
    Application user.

    Also serves as the authenticated principal stored in request.scope["user"]
    by the Keycloak middleware.

    Notes
    -----
    - The "new" shape mirrors Keycloak Admin REST user objects.
    - Backward-compat: `name` (derived) and `timestamp` (alias of createdAt)
      are kept for older code paths.
    """

    # --- Keycloak identity ---
    sub: str = ""  # Keycloak subject / user id
    username: str = ""
    email: str = ""

    # --- Profile ---
    firstName: str = ""
    lastName: str = ""
    phone: Optional[str] = None

    # --- Status ---
    enabled: bool = True
    emailVerified: bool = False

    # --- Creation time (Keycloak uses epoch milliseconds) ---
    createdTimestamp: int = 0
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Keycloak attributes: often dict[str, list[str]]; keep it flexible.
    attributes: dict[str, Any] = Field(default_factory=dict)

    # ---------------------------------------------------------------------
    # Backward-compatible fields
    # ---------------------------------------------------------------------
    @property
    def name(self) -> str:
        full = (f"{self.firstName} {self.lastName}").strip()
        return full or self.username

    @property
    def timestamp(self) -> datetime:
        # Previous model used `timestamp` with local now(); map to createdAt.
        return self.createdAt

    def to_dict(self) -> dict:
        """Serialize using the new wire format (plus derived compat fields)."""
        return {
            "sub": self.sub,
            "username": self.username,
            "email": self.email,
            "firstName": self.firstName,
            "lastName": self.lastName,
            "phone": self.phone,
            "enabled": self.enabled,
            "emailVerified": self.emailVerified,
            "createdTimestamp": self.createdTimestamp,
            "createdAt": self.createdAt.isoformat(),
            "attributes": self.attributes,

        }
