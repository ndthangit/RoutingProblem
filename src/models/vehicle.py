from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, ConfigDict

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


class VehicleCreate(VehicleBase):
    id: Optional[str] = None


class VehicleUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    license_plate: Optional[str] = Field(default=None, min_length=1, max_length=32, alias="licensePlate")
    model: Optional[str] = Field(default=None, max_length=128)
    capacity: Optional[int] = Field(default=None, ge=1, le=100)
    status: Optional[VehicleStatus] = None
    driver_id: Optional[str] = Field(default=None, alias="driverId")


class Vehicle(VehicleBase):
    id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), alias="createdAt")
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), alias="updatedAt")

    def to_dict(self) -> dict:
        return self.model_dump(mode="json", by_alias=True, exclude_none=True)


# api model
