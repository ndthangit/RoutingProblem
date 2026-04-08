from __future__ import annotations

from datetime import datetime
import uuid
from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, Field, ConfigDict

from src.models.event import EventBase, EventType


class Coordinate(BaseModel):
    """OSRM expects lon,lat. We keep explicit naming to avoid confusion."""

    model_config = ConfigDict(populate_by_name=True)

    lon: float = Field(..., ge=-180, le=180)
    lat: float = Field(..., ge=-90, le=90)

    def to_osrm_str(self) -> str:
        return f"{self.lon},{self.lat}"


class RouteRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    coordinates: list[Coordinate] = Field(..., min_length=2, description="List of coordinates (lon/lat)")
    profile: Literal["driving", "driving-traffic", "walking", "cycling"] = Field(
        default="driving", description="OSRM profile"
    )
    steps: bool = Field(default=False)
    alternatives: bool = Field(default=False)
    overview: Literal["simplified", "full", "false"] = Field(default="simplified")
    geometries: Literal["polyline", "polyline6", "geojson"] = Field(default="geojson")


class RouteLeg(BaseModel):
    distance_m: float = Field(..., alias="distanceM")
    duration_s: float = Field(..., alias="durationS")


class RouteResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    distance_m: float = Field(..., alias="distanceM")
    duration_s: float = Field(..., alias="durationS")
    geometry: dict = Field(..., description="GeoJSON LineString")
    legs: list[RouteLeg] = Field(default_factory=list)


class EtaUpdate(BaseModel):
    """Payload pushed to frontend via WebSocket."""

    model_config = ConfigDict(populate_by_name=True)

    type: Literal["eta.update"] = "eta.update"
    vehicle_id: Optional[str] = Field(default=None, alias="vehicleId")
    route_id: Optional[str] = Field(default=None, alias="routeId")
    distance_m: float = Field(..., alias="distanceM")
    duration_s: float = Field(..., alias="durationS")
    geometry: Optional[dict] = None

class RouteEventType(EventType):
    ROUTE_STARTED = "ROUTE.STARTED"
    ROUTE_ENDED = "ROUTE.ENDED"

class Route(BaseModel):
    model_config = ConfigDict(populate_by_name=True, use_enum_values=True)

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))

    # API field name should be `vehicleId` (camelCase) for compatibility with frontend.
    # Using a non-standard alias breaks parsing and can lead to 422/404 confusion.
    vehicle_id: str = Field(..., alias="vehicleId")
    # Điểm đầu và điểm cuối cố định
    origin: str = Field(..., description="Điểm bắt đầu h")
    origin_coordinate: Optional[Coordinate] = Field(default=None, description="Tọa độ điểm bắt đầu (lon/lat)")
    destination: str = Field(..., description="Điểm điểm kết kthúc")
    destination_coordinate: Optional[Coordinate] = Field(default=None, description="Tọa độ điểm kết thúc (lon/lat)")
    start_time: Optional[datetime] = Field(default=None, alias="startTime")


# ============== 2. CÁC EVENTS ĐẠI DIỆN CHO SỰ DI CHUYỂN ==============

class RouteEvent(EventBase):
    """
    Event ghi nhận mỗi khi đơn hàng được di chuyển, đổi trạng thái, bốc xếp lên xe hoặc nhập kho.
    Đây chính là lịch sử Tracking của đơn hàng.
    """
    event_type: RouteEventType = Field(..., alias="eventType")

    route: Route

    def to_dict(self) -> dict:
        return self.model_dump(mode="json", by_alias=True, exclude_none=True)