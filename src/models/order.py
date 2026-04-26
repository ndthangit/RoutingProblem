from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, ConfigDict

# Giả định import từ các module của bạn
from src.models.event import EventBase
from src.models.routing import Coordinate

class OrderEventType(str, Enum):
    ORDER_CREATED = "ORDER.CREATED"
    ORDER_PICKED_UP = "ORDER.PICKED_UP"

    ORDER_ARRIVED_AT_HUB = "ORDER.ARRIVED_AT_HUB"
    ORDER_DISPATCHED = "ORDER.DISPATCHED"
    ORDER_OUT_FOR_DELIVERY = "ORDER.OUT_FOR_DELIVERY"
    ORDER_DELIVERED = "ORDER.DELIVERED"

    ORDER_PAYMENT_RECEIVED = "ORDER.PAYMENT_RECEIVED"
    ORDER_FAILED_ATTEMPT = "ORDER.FAILED_ATTEMPT"
    ORDER_CANCELLED = "ORDER.CANCELLED"




# ============== VALUE OBJECTS ==============
class PackageDetails(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    
    description: str = Field(..., max_length=500, description="Mô tả hàng hóa")
    weight_kg: float = Field(..., gt=0, alias="weightKg")

    declared_value: Optional[float] = Field(default=0, alias="declaredValue")


# ============== 1. ORDER (THỰC THỂ BẤT BIẾN) ==============
class Order(BaseModel):
    """
    Thực thể Order cốt lõi. CHỈ chứa các thông tin cố định (hợp đồng vận chuyển).
    KHÔNG chứa status, KHÔNG chứa current_warehouse hay current_vehicle.
    """
    model_config = ConfigDict(populate_by_name=True, use_enum_values=True)
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    sender_name: str = Field(..., description="Tên người gửi", alias="senderName")
    receiver_name: str = Field(..., description="Tên người nhận", alias="receiverName")

    # Điểm đầu và điểm cuối cố định
    origin: str = Field(..., description="Điểm lấy hàng ban đầu")

    origin_coordinate: Optional[Coordinate] = Field(default=None, description="Tọa độ lấy hàng (lon/lat)")
    destination: str = Field(..., description="Điểm giao hàng đích")

    destination_coordinate: Optional[Coordinate] = Field(default=None, description="Tọa độ nhận hàng (lon/lat)")
    
    package: PackageDetails = Field(..., description="Thông tin kiện hàng")
    
    # Thông tin tài chính thỏa thuận ban đầu
    cod_amount: float = Field(default=0, ge=0, alias="codAmount")
    shipping_fee: float = Field(default=0, ge=0, alias="shippingFee")
    
    note: Optional[str] = Field(default=None, description="Ghi chú vận chuyển")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), alias="createdAt")
    vehicle_id: Optional[str] = Field(default=None, description="ID của xe đang chở hàng", alias="vehicleId")

    route_id: Optional[str]= Field(default=None, description="ID của Route", alias="routeId")

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