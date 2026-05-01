from __future__ import annotations

from datetime import datetime
import uuid
from enum import Enum
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, ConfigDict, AliasChoices

from src.models.event import EventBase


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


class Point(BaseModel):
    """Shared base for models that represent a physical location."""

    model_config = ConfigDict(populate_by_name=True, use_enum_values=True)

    id : str = Field(default_factory=lambda: str(uuid.uuid4()), description="ID điểm")

    name: str = Field(default=None, description="Tên điểm")
    address: str = Field(..., description="Địa chỉ")

    # Dạng object (lon/lat) để dùng trực tiếp cho routing engines (OSRM/RapidAPI)
    coordinate: Optional[Coordinate] = Field(default=None, description="Tọa độ (lon/lat)")

class RouteStatus(str, Enum):
    PLANNED = "PLANNED"           # Đã lên lịch nhưng chưa chạy
    IN_PROGRESS = "IN_PROGRESS"   # Đang di chuyển
    COMPLETED = "COMPLETED"       # Đã hoàn thành
    CANCELLED = "CANCELLED"       # Bị hủy

class RouteEventType(str, Enum):
    ROUTE_STARTED = "ROUTE.STARTED"
    WAYPOINT_REACHED = "ROUTE.WAYPOINT_REACHED" # Bổ sung thêm sự kiện tới trạm
    ROUTE_ENDED = "ROUTE.ENDED"
    STATUS_CHANGED = "ROUTE.STATUS_CHANGED"


class RouteType(str, Enum):
    """Kiểu route để phân biệt route thường và route được sinh tự động từ Schedule."""

    AD_HOC = "AD_HOC"
    ONCE_PER_WEEK = "ONCE_PER_WEEK"


class Route(BaseModel):
    model_config = ConfigDict(populate_by_name=True, use_enum_values=True)

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))

    # API field name should be `vehicleId` (camelCase) for compatibility with frontend.
    # Using a non-standard alias breaks parsing and can lead to 422/404 confusion.
    vehicle_id: str = Field(..., alias="vehicleId")
    # Điểm đầu và điểm cuối cố định
    origin: Point = Field(..., description="Điểm bắt đầu")
    destination: Point = Field(..., description="Điểm kết kthúc")

    start_time: Optional[datetime] = Field(default=None, alias="startTime")
    end_time: Optional[datetime] = Field(default=None, alias="endTime")
    # New: route type (camelCase on API)
    route_type: RouteType = Field(default=RouteType.AD_HOC, alias="routeType")


    # Prefer camelCase on API; accept legacy `route_status` from older stored documents.
    route_status: RouteStatus = Field(
        default=RouteStatus.PLANNED,
        validation_alias=AliasChoices("routeStatus", "route_status"),
        serialization_alias="routeStatus",
    )
    
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

class ScheduleType(str, Enum):
    ONCE_PER_WEEK = "ONCE_PER_WEEK"
    DAILY = "DAILY"
    TEMPERATURE_TRIGGER = "TEMPERATURE_TRIGGER"


class Schedule(BaseModel):
    """
    Kế hoạch mẫu: Dùng cho Cronjob/Worker đọc để tự động sinh ra Route.
    """
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(default_factory=lambda: f"template::{uuid.uuid4()}")
    origin: str = Field(..., description="Tên/Địa chỉ điểm bắt đầu")
    destination: str = Field(..., description="Tên/Địa chỉ điểm kết thúc")


    # Cấu hình tự động
    schedule_type: ScheduleType = Field(..., alias="scheduleType")
    schedule_config: dict[str, Any] = Field(
        default_factory=dict,
        validation_alias=AliasChoices("scheduleConfig", "schedule_config"),
        serialization_alias="scheduleConfig",
        description="Lưu cấu hình JSON (vd: vehicleId, day_of_week: 1)",
    )
    note: Optional[str] = Field(default=None, description="Ghi chú")

    is_active: bool = Field(default=True, alias="isActive")
    last_generated_at: Optional[datetime] = Field(default=None, alias="lastGeneratedAt")
    
class ScheduleEventType(str, Enum):
    SCHEDULE_CREATED = "SCHEDULE.CREATED"
    SCHEDULE_UPDATED = "SCHEDULE.UPDATED"


class ScheduleEvent(EventBase):
    """
    Event ghi nhận mỗi khi đơn hàng được di chuyển, đổi trạng thái, bốc xếp lên xe hoặc nhập kho.
    Đây chính là lịch sử Tracking của đơn hàng.
    """
    event_type: ScheduleEventType = Field(..., alias="eventType")
    schedule: Schedule

    def to_dict(self) -> dict:
        return self.model_dump(mode="json", by_alias=True, exclude_none=True)
    
    

