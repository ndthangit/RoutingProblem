import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import Field
from src.models.event import EventBase

from src.models.routing import Point

class CustomerWarehouseStatus(str, Enum):
    ACTIVE = "ACTIVE"              # Đang hoạt động
    INACTIVE = "INACTIVE"          # Tạm ngưng hoạt động
    FULL = "FULL"                  # Quá tải/Đầy công suất (Thường dùng cho kho của hãng)
    MAINTENANCE = "MAINTENANCE"    # Đang bảo trì/sửa chữa
    CLOSED = "CLOSED"              # Đã đóng cửa vĩnh viễn


class CustomerWarehouse(Point):
    # --- THÔNG TIN NGƯỜI ĐẠI DIỆN ---
    representative_name: str = Field(..., description="Tên người đại diện tại kho", alias="representativeName")
    contact_phone: str = Field(..., alias="contactPhone")

    # --- THÔNG TIN VẬN TẢI (Khối lượng hàng cần vận chuyển đi) ---
    pending_weight: float = Field(default=0.0, ge=0, description="Tổng khối lượng hàng đang chờ lấy (kg)",
                                  alias="pendingWeight")

    total_pending_orders: int = Field(default=0, ge=0, description="Số lượng đơn hàng cần lấy",
                                      alias="totalPendingOrders")

    status: CustomerWarehouseStatus = Field(default=CustomerWarehouseStatus.ACTIVE)

    hub_responsible: Optional[str] = Field(
        default=None,
        alias="hubResponsible",
        description="ID của HUB phụ trách lấy hàng tại kho khách hàng (mặc định: HUB gần nhất)",
    )
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), alias="createdAt")
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), alias="updatedAt")

    def to_dict(self) -> dict:
        return self.model_dump(mode="json", by_alias=True, exclude_none=True)


class CustomerWarehouseEventType(str, Enum):
    # Event khi tạo kho mới
    LOCATION_REGISTERED = "CUSTOMER_LOCATION.REGISTERED"

    # Event quan trọng: Khi khối lượng hàng tại kho thay đổi (để xe tải biết đường đến lấy)
    LOAD_VOLUME_UPDATED = "CUSTOMER_LOCATION.LOAD_UPDATED"

    # Event khi cập nhật thông tin người đại diện
    REPRESENTATIVE_UPDATED = "CUSTOMER_LOCATION.REPRESENTATIVE_UPDATED"

    # CRUD events (để đồng bộ pattern với warehouse/driver/...)
    LOCATION_UPDATED = "CUSTOMER_LOCATION.UPDATED"
    LOCATION_DELETED = "CUSTOMER_LOCATION.DELETED"


class CustomerWarehouseEvent(EventBase):
    """Event envelope cho CRUD & các sự kiện business của CustomerWarehouse."""

    # NOTE: EventBase đang dùng snake_case field (event_id/timestamp/owner_email)
    # nhưng serialize ra JSON theo alias trong EventBase (nếu có).
    event_type: CustomerWarehouseEventType = Field(
        default=CustomerWarehouseEventType.LOCATION_REGISTERED,
        alias="eventType",
    )
    # Canonical payload key
    customer_warehouse: CustomerWarehouse = Field(..., alias="customerWarehouse")


    def to_dict(self) -> dict:
        return self.model_dump(mode="json", by_alias=True, exclude_none=True)



