from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, ConfigDict

from src.models.event import EventBase, EventType
from src.models.routing import Coordinate


class VehicleStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    MAINTENANCE = "MAINTENANCE"
    RESERVED = "RESERVED"
    EXPIRED_DOCUMENTS = "EXPIRED_DOCUMENTS"


class VehicleType(str, Enum):
    SEDAN = "SEDAN"
    SUV = "SUV"
    TRUCK = "TRUCK"
    VAN = "VAN"
    BUS = "BUS"
    MOTORCYCLE = "MOTORCYCLE"


class VehicleBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True, use_enum_values=True)
    license_plate: str = Field(..., min_length=1, max_length=32, description="Biển số xe", alias="licensePlate")
    model: Optional[str] = Field(default=None, max_length=128, description="Model xe")
    brand: Optional[str] = Field(default=None, max_length=64, description="Hãng xe")
    year: Optional[int] = Field(default=None, ge=1900, le=datetime.now().year, description="Năm sản xuất")
    color: Optional[str] = Field(default=None, max_length=32, description="Màu xe")
    capacity: Optional[int] = Field(default=None, ge=1, description="Trọng tải xe(kg)")
    vehicle_type: VehicleType = Field(default=VehicleType.SEDAN, description="Loại xe", alias="vehicleType")
    status: VehicleStatus = Field(default=VehicleStatus.ACTIVE, description="Trạng thái xe")
    driver_id: Optional[str] = Field(default=None, alias="driverId")

    warehouse_id: Optional[str] = Field(
        default=None,
        alias="warehouseId",
        description="ID của kho quản lý vehicle này",
    )
    # Dạng object (lon/lat) để dùng trực tiếp cho routing engines (OSRM/RapidAPI)
    coordinate: Optional[Coordinate] = Field(default=None, description="Tọa độ (lon/lat)")


class Vehicle(VehicleBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> dict:
        return self.model_dump(mode="json", by_alias=True, exclude_none=True)

# api model

# ============== EVENT TYPES ==============
class VehicleEventType(EventType):
    """Các loại event cho vehicle"""
    VEHICLE_REGISTERED = "VEHICLE.REGISTERED"
    VEHICLE_UPDATED = "VEHICLE.UPDATED"
    VEHICLE_DRIVER_ASSIGNED = "VEHICLE.DRIVER.ASSIGNED"
    VEHICLE_DRIVER_UNASSIGNED = "VEHICLE.DRIVER.UNASSIGNED"
    VEHICLE_STATUS_CHANGED = "VEHICLE.STATUS.CHANGED"
    VEHICLE_MAINTENANCE_SCHEDULED = "VEHICLE.MAINTENANCE.SCHEDULED"
    VEHICLE_MAINTENANCE_COMPLETED = "VEHICLE.MAINTENANCE.COMPLETED"
    VEHICLE_DOCUMENTS_EXPIRED = "VEHICLE.DOCUMENTS.EXPIRED"
    VEHICLE_DOCUMENTS_RENEWED = "VEHICLE.DOCUMENTS.RENEWED"
    VEHICLE_DELETED = "VEHICLE.DELETED"
    VEHICLE_INSPECTION_REQUIRED = "VEHICLE.INSPECTION.REQUIRED"

# ============== EVENT ==============
class VehicleEvent(EventBase):
    """Base class cho tất cả vehicle events"""
    event_type: VehicleEventType = Field(..., alias="eventType")
    vehicle: Vehicle


    def to_dict(self) -> dict:
        return self.model_dump(mode="json", by_alias=True, exclude_none=True)

