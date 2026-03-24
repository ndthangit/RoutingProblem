import uuid
from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, Field


class EventType(str, Enum):
    pass

class EventBase(BaseModel):
    event_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    owner_email: str = Field(..., alias="ownerEmail")
    event_type: EventType = Field(..., alias="eventType")






