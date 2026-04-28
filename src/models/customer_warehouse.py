import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field
from src.models.event import EventBase
from src.models.routing import Coordinate
from src.models.warehouse import WarehouseStatus


class CustomerWarehouseBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True, use_enum_values=True)
    name: str = Field(..., description="Tên kho khách hàng (VD: Kho tổng kho sỉ)")

    # Địa điểm & Liên hệ
    address: str = Field(...)
    coordinate: Optional[Coordinate] = Field(default=None)

    # --- THÔNG TIN NGƯỜI ĐẠI DIỆN ---
    representative_name: str = Field(..., description="Tên người đại diện tại kho", alias="representativeName")
    contact_phone: str = Field(..., alias="contactPhone")

    # --- THÔNG TIN VẬN TẢI (Khối lượng hàng cần vận chuyển đi) ---
    pending_weight: float = Field(default=0.0, ge=0, description="Tổng khối lượng hàng đang chờ lấy (kg)",
                                  alias="pendingWeight")

    total_pending_orders: int = Field(default=0, ge=0, description="Số lượng đơn hàng cần lấy",
                                      alias="totalPendingOrders")

    status: WarehouseStatus = Field(default=WarehouseStatus.ACTIVE)

    hub_responsible: Optional[str] = Field(
        default=None,
        alias="hubResponsible",
        description="ID của HUB phụ trách lấy hàng tại kho khách hàng (mặc định: HUB gần nhất)",
    )

class CustomerWarehouse(CustomerWarehouseBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
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



