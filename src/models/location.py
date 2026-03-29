from __future__ import annotations
from pydantic import BaseModel, Field

class Location(BaseModel):
    latitude: float = Field(..., example=34.052235)
    longitude: float = Field(..., example=-118.243683)
