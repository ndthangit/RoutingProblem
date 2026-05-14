from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, ConfigDict, AliasChoices, model_validator

from src.models import Point
from src.models.event import EventBase, EventType
from src.models.routing import Coordinate


class PlanStatus(str, Enum):
    PLANNED = "PLANNED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

class Plan(BaseModel):
    """Movement plan for a vehicle: origin -> (points)* -> destination.

    - `points`: where the vehicle will pause.
    - `route_ids`: references to routes between consecutive points.
    """

    model_config = ConfigDict(populate_by_name=True, use_enum_values=True)

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))

    vehicle_id: str = Field(..., alias="vehicleId")

    # Prefer camelCase on API; accept legacy snake_case if a stored doc exists.
    status: PlanStatus = Field(
        default=PlanStatus.PLANNED,
        validation_alias=AliasChoices("status", "planStatus", "plan_status"),
        serialization_alias="status",
    )

    origin: str = Field(..., description="Điểm bắt đầu")
    origin_coordinate: Optional[Coordinate] = Field(default=None, alias="originCoordinate")

    destination: str = Field(..., description="Điểm kết thúc")
    destination_coordinate: Optional[Coordinate] = Field(default=None, alias="destinationCoordinate")

    start_time: Optional[datetime] = Field(default=None, alias="startTime")
    end_time: Optional[datetime] = Field(default=None, alias="endTime")

    points: list[Point] = Field(default_factory=list, description="Danh sách điểm dừng", alias="points")
    route_ids: list[str] = Field(default_factory=list, alias="routeIds")

    note: Optional[str] = Field(default=None)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), alias="createdAt")
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), alias="updatedAt")

    @model_validator(mode="before")
    @classmethod
    def _coerce_route_ids(cls, data):
        if not isinstance(data, dict):
            return data
        if "routeIds" in data or "route_ids" in data:
            return data
        routes = data.get("routes")
        if isinstance(routes, list):
            route_ids: list[str] = []
            for route in routes:
                if isinstance(route, dict) and route.get("id"):
                    route_ids.append(str(route["id"]))
                elif hasattr(route, "id"):
                    route_ids.append(str(route.id))
            if route_ids:
                data = {**data, "routeIds": route_ids}
        return data

    def to_dict(self) -> dict:
        return self.model_dump(mode="json", by_alias=True, exclude_none=True)


# ============== EVENT TYPES ==============
class PlanEventType(EventType):
    """Các loại event cho pln"""
    PLAN_CREATED = "PLAN.CREATED"
    PLAN_UPDATED = "PLAN.UPDATED"
    PLAN_STATUS_CHANGED = "PLAN.STATUS.CHANGED"
    PLAN_DELETED = "PLAN.DELETED"


# ============== EVENT ==============
class PlanEvent(EventBase):
    """Base class cho tất cả vehicle events"""
    event_type: PlanEventType = Field(..., alias="eventType")
    plan: Plan


    def to_dict(self) -> dict:
        return self.model_dump(mode="json", by_alias=True, exclude_none=True)
