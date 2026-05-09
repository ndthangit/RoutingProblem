from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, ConfigDict

# Giả định import từ các module của bạn
from src.models.event import EventBase, EventType
from src.models.routing import Point


class OrderEventType(EventType):
    ORDER_CREATED = "ORDER.CREATED"
    ORDER_UPDATED = "ORDER.UPDATED"
    ORDER_DELETED = "ORDER.DELETED"


# ============== VALUE OBJECTS ==============
class PackageDetails(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    
    description: str = Field(..., max_length=500, description="Mô tả hàng hóa")
    weight_kg: float = Field(..., gt=0, alias="weightKg")

    declared_value: Optional[float] = Field(default=0, alias="declaredValue")

class OrderStatus(str, Enum):
    ORDER_CREATED = "ORDER.CREATED"
    ORDER_PICKED_UP = "ORDER.PICKED_UP"
    ORDER_DELIVERED = "ORDER.DELIVERED"

    ORDER_PAYMENT_RECEIVED = "ORDER.PAYMENT_RECEIVED"
    ORDER_FAILED_ATTEMPT = "ORDER.FAILED_ATTEMPT"
    ORDER_CANCELLED = "ORDER.CANCELLED"


# ============== 1. ORDER (THỰC THỂ BẤT BIẾN) ==============
class Order(BaseModel):
    """
    Thực thể Order cốt lõi. CHỈ chứa các thông tin cố định (hợp đồng vận chuyển).
    Có chứa `status` (trạng thái hiện tại) để client dễ hiển thị.
    """
    model_config = ConfigDict(populate_by_name=True, use_enum_values=True)
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    sender_name: str = Field(..., description="Tên người gửi", alias="senderName")
    receiver_name: str = Field(..., description="Tên người nhận", alias="receiverName")

    # Điểm đầu và điểm cuối cố định
    origin: Point = Field(..., description="Điểm lấy hàng ban đầu")
    destination: Point = Field(..., description="Điểm giao hàng đích")

    package: PackageDetails = Field(..., description="Thông tin kiện hàng")

    # Current status of the order (authoritative snapshot).
    # Keep enum values in storage/JSON (see model_config.use_enum_values=True).
    status: OrderStatus = Field(default=OrderStatus.ORDER_CREATED, description="Trạng thái đơn hàng")

    # Thông tin tài chính thỏa thuận ban đầu
    cod_amount: float = Field(default=0, ge=0, alias="codAmount")
    shipping_fee: float = Field(default=0, ge=0, alias="shippingFee")
    
    note: Optional[str] = Field(default=None, description="Ghi chú vận chuyển")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), alias="createdAt")
    vehicle_id: Optional[str] = Field(default=None, description="ID của xe đang chở hàng", alias="vehicleId")

    route_id: Optional[str]= Field(default=None, description="ID của Route", alias="routeId")

    @staticmethod
    def normalize_status(value: str | OrderStatus | None) -> OrderStatus:
        """Backward-compat: older documents may miss `status` or store it as plain string."""
        if value is None:
            return OrderStatus.ORDER_CREATED
        if isinstance(value, OrderStatus):
            return value
        try:
            return OrderStatus(value)
        except Exception:
            return OrderStatus.ORDER_CREATED

    def to_dict(self) -> dict:
        return self.model_dump(mode="json", by_alias=True, exclude_none=True)


# ============== 2. CÁC EVENTS ĐẠI DIỆN CHO SỰ DI CHUYỂN ==============

class OrderEvent(EventBase):
    """
    Event ghi nhận mỗi khi đơn hàng được di chuyển, đổi trạng thái, bốc xếp lên xe hoặc nhập kho.
    Đây chính là lịch sử Tracking của đơn hàng.
    """
    event_type: OrderEventType = Field(default=OrderEventType.ORDER_CREATED, alias="eventType")
    
    order: Order

    def to_dict(self) -> dict:
        return self.model_dump(mode="json", by_alias=True, exclude_none=True)