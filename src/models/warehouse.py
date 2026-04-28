from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from src.models.event import EventBase, EventType
from src.models.routing import Coordinate

class WarehouseStatus(str, Enum):
    ACTIVE = "ACTIVE"              # Đang hoạt động
    INACTIVE = "INACTIVE"          # Tạm ngưng hoạt động
    FULL = "FULL"                  # Quá tải/Đầy công suất (Thường dùng cho kho của hãng)
    MAINTENANCE = "MAINTENANCE"    # Đang bảo trì/sửa chữa
    CLOSED = "CLOSED"              # Đã đóng cửa vĩnh viễn


class WarehouseType(str, Enum):
    # Kho của hãng vận chuyển
    HUB = "HUB"                    # Trung tâm khai thác lớn (phân loại, điều phối liên tỉnh)
    DEPOT = "DEPOT"                # Trạm trung chuyển/Kho vệ tinh (giao nhận tuyến huyện/xã)

class WarehouseBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True, use_enum_values=True)
    
    name: str = Field(..., min_length=1, max_length=128, description="Tên kho/Điểm tập kết")
    address: str = Field(..., min_length=5, max_length=255, description="Địa chỉ đầy đủ")

    # Dạng object (lon/lat) để dùng trực tiếp cho routing engines (OSRM/RapidAPI)
    coordinate: Optional[Coordinate] = Field(default=None, description="Tọa độ (lon/lat)")

    
    warehouse_type: WarehouseType = Field(
        default=WarehouseType.DEPOT, 
        description="Loại kho (Của hãng hay của khách)", 
        alias="warehouseType"
    )
    status: WarehouseStatus = Field(default=WarehouseStatus.ACTIVE, description="Trạng thái kho")


    # Các trường dành riêng cho kho của hãng vận chuyển
    capacity: Optional[float] = Field(default=None, ge=0, description="Sức chứa tối đa (m2 hoặc tấn)")
    manager_id: Optional[str] = Field(default=None, description="ID của quản lý kho", alias="managerId")
    
    # Các trường dành riêng cho kho của khách hàng
    customer_id: Optional[str] = Field(default=None, description="ID của khách hàng (nếu là kho khách hàng)", alias="customerId")
    
    # Thông tin liên hệ chung
    contact_phone: Optional[str] = Field(default=None, max_length=20, description="Số điện thoại liên hệ tại kho", alias="contactPhone")




class Warehouse(WarehouseBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), alias="createdAt")
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), alias="updatedAt")

    def to_dict(self) -> dict:
        return self.model_dump(mode="json", by_alias=True, exclude_none=True)


# ============== EVENT TYPES ==============
class WarehouseEventType(EventType):
    """Các loại event cho warehouse"""
    WAREHOUSE_REGISTERED = "WAREHOUSE.REGISTERED"
    WAREHOUSE_UPDATED = "WAREHOUSE.UPDATED"
    WAREHOUSE_STATUS_CHANGED = "WAREHOUSE.STATUS.CHANGED"
    WAREHOUSE_CAPACITY_FULL = "WAREHOUSE.CAPACITY.FULL"
    WAREHOUSE_MANAGER_ASSIGNED = "WAREHOUSE.MANAGER.ASSIGNED"
    WAREHOUSE_DELETED = "WAREHOUSE.DELETED"


# ============== EVENT ==============
class WarehouseEvent(EventBase):
    """Base class cho tất cả warehouse events"""
    event_type: WarehouseEventType = Field(..., alias="eventType")
    warehouse: Warehouse

    def to_dict(self) -> dict:
        return self.model_dump(mode="json", by_alias=True, exclude_none=True)