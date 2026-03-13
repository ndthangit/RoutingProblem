
from typing import Optional

from pydantic import BaseModel, Field
from datetime import datetime


class User(BaseModel):
    """
    Application user.  Also serves as the authenticated principal stored in
    request.scope["user"] by the Keycloak middleware.
    """
    sub: str = ""                   # Keycloak subject (unique user ID)
    email: str
    name: str = ""                  # full name or preferred_username
    phone: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.now)

    def to_dict(self) -> dict:
        return {
            "type": "user",
            "sub": self.sub,
            "email": self.email,
            "name": self.name,
            "phone": self.phone,
            "timestamp": self.timestamp.isoformat(),
        }
