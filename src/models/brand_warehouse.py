from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import Field

from src.models.event import EventBase
from src.models.routing import Point


class BrandWarehouseStatus(str, Enum):
    ACTIVE = "ACTIVE"              # Đang hoạt động
    INACTIVE = "INACTIVE"          # Tạm ngưng hoạt động
    FULL = "FULL"                  # Quá tải/Đầy công suất (Thường dùng cho kho của hãng)
    MAINTENANCE = "MAINTENANCE"    # Đang bảo trì/sửa chữa
    CLOSED = "CLOSED"              # Đã đóng cửa vĩnh viễn


class BrandWarehouseType(str, Enum):
    # Kho của hãng vận chuyển
    HUB = "HUB"                    # Trung tâm khai thác lớn (phân loại, điều phối liên tỉnh)
    DEPOT = "DEPOT"                # Trạm trung chuyển/Kho vệ tinh (giao nhận tuyến huyện/xã)

class BrandWarehouse(Point):
    brand_warehouse_type: BrandWarehouseType = Field(
        default=BrandWarehouseType.DEPOT,
        description="Loại kho (Của hãng hay của khách)",
        alias="warehouseType"
    )
    status: BrandWarehouseStatus = Field(default=BrandWarehouseStatus.ACTIVE, description="Trạng thái kho")

    # Các trường dành riêng cho kho của hãng vận chuyển
    capacity: Optional[float] = Field(default=None, ge=0, description="Sức chứa tối đa (m2 hoặc tấn)")
    manager_id: Optional[str] = Field(default=None, description="ID của quản lý kho", alias="managerId")

    # Thông tin liên hệ chung
    contact_phone: Optional[str] = Field(default=None, max_length=20, description="Số điện thoại liên hệ tại kho",
                                         alias="contactPhone")

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), alias="createdAt")
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), alias="updatedAt")

    def to_dict(self) -> dict:
        return self.model_dump(mode="json", by_alias=True, exclude_none=True)


# ============== EVENT TYPES ==============
class BrandWarehouseEventType(str, Enum):
    """Các loại event cho BrandWarehouse."""

    WAREHOUSE_REGISTERED = "WAREHOUSE.REGISTERED"
    WAREHOUSE_UPDATED = "WAREHOUSE.UPDATED"
    WAREHOUSE_DELETED = "WAREHOUSE.DELETED"


# ============== EVENT ==============
class WarehouseEvent(EventBase):
    """Event cho BrandWarehouse (giữ payload key là `warehouse` để đồng bộ service/API)."""

    event_type: BrandWarehouseEventType = Field(..., alias="eventType")
    warehouse: BrandWarehouse = Field(..., alias="warehouse")

    def to_dict(self) -> dict:
        return self.model_dump(mode="json", by_alias=True, exclude_none=True)


# Backward-compatible aliases (nếu code cũ còn dùng)
BrandWarehouseEvent = WarehouseEvent
