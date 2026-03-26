from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, ConfigDict

# Giả định import từ các module của bạn
from src.models.event import EventBase, EventType
from src.models.warehouse import Warehouse 


# ============== ENUMS CHO EVENT ==============
class OrderStatus(str, Enum):
    """Trạng thái của đơn hàng tại thời điểm phát sinh Event"""
    CREATED = "CREATED"                    # Vừa tạo đơn
    PICKED_UP = "PICKED_UP"                # Đã lấy hàng từ Origin
    ARRIVED_AT_HUB = "ARRIVED_AT_HUB"      # Đã đến trạm/kho
    DISPATCHED = "DISPATCHED"              # Đã xuất kho, lên xe tải
    OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY"  # Đang trên đường giao cho người nhận
    DELIVERED = "DELIVERED"                # Giao thành công
    FAILED_ATTEMPT = "FAILED_ATTEMPT"      # Giao thất bại
    CANCELLED = "CANCELLED"                # Đã hủy


class OrderEventType(str, Enum):
    ORDER_MOVEMENT = "ORDER.MOVEMENT"
    ORDER_PAYMENT = "ORDER.PAYMENT"
    ORDER_INFO_UPDATED = "ORDER.INFO_UPDATED" # Dùng khi cần sửa lỗi sai thông tin (vd: sai số điện thoại)


# ============== VALUE OBJECTS ==============
class PackageDetails(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    
    description: str = Field(..., max_length=500, description="Mô tả hàng hóa")
    weight_kg: float = Field(..., gt=0, alias="weightKg")
    length_cm: Optional[float] = Field(default=None, gt=0, alias="lengthCm")
    width_cm: Optional[float] = Field(default=None, gt=0, alias="widthCm")
    height_cm: Optional[float] = Field(default=None, gt=0, alias="heightCm")
    declared_value: Optional[float] = Field(default=0, alias="declaredValue")


# ============== 1. ORDER (THỰC THỂ BẤT BIẾN) ==============
class Order(BaseModel):
    """
    Thực thể Order cốt lõi. CHỈ chứa các thông tin cố định (hợp đồng vận chuyển).
    KHÔNG chứa status, KHÔNG chứa current_warehouse hay current_vehicle.
    """
    model_config = ConfigDict(populate_by_name=True, use_enum_values=True)
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tracking_number: str = Field(..., max_length=32, alias="trackingNumber")
    
    # Điểm đầu và điểm cuối cố định
    origin: Warehouse = Field(..., description="Điểm lấy hàng ban đầu")
    destination: Warehouse = Field(..., description="Điểm giao hàng đích")
    
    sender_name: str = Field(..., description="Tên người gửi", alias="senderName")
    receiver_name: str = Field(..., description="Tên người nhận", alias="receiverName")
    
    package: PackageDetails = Field(..., description="Thông tin kiện hàng")
    
    # Thông tin tài chính thỏa thuận ban đầu
    cod_amount: float = Field(default=0, ge=0, alias="codAmount")
    shipping_fee: float = Field(default=0, ge=0, alias="shippingFee")
    
    note: Optional[str] = Field(default=None, description="Ghi chú vận chuyển")
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), alias="createdAt")

    def to_dict(self) -> dict:
        return self.model_dump(mode="json", by_alias=True, exclude_none=True)


# ============== 2. CÁC EVENTS ĐẠI DIỆN CHO SỰ DI CHUYỂN ==============

class OrderMovementEvent(EventBase):
    """
    Event ghi nhận mỗi khi đơn hàng được di chuyển, đổi trạng thái, bốc xếp lên xe hoặc nhập kho.
    Đây chính là lịch sử Tracking của đơn hàng.
    """
    event_type: OrderEventType = Field(default=OrderEventType.ORDER_MOVEMENT, alias="eventType")
    
    # Chỉ lưu ID của order thay vì toàn bộ object Order để tối ưu dung lượng Event Store
    order_id: str = Field(..., description="ID của đơn hàng", alias="orderId")
    
    # Trạng thái mới nhất tại thời điểm event này xảy ra
    status: OrderStatus = Field(..., description="Trạng thái cập nhật")
    
    # Node hiện tại (Đơn hàng đang ở đâu? Điểm xuất phát, HUB, hay Điểm giao?)
    location_id: Optional[str] = Field(default=None, description="ID của Warehouse/Hub hiện tại", alias="locationId")
    
    # Xe nào đang chở? (Nếu đơn hàng đang In Transit)
    vehicle_id: Optional[str] = Field(default=None, description="ID của xe đang chở hàng", alias="vehicleId")
    
    # Trách nhiệm: Ai là người thực hiện hành động này (NV Kho, Tài xế quét mã vạch...)
    actor_id: str = Field(..., description="ID nhân viên hoặc tài xế thao tác", alias="actorId")
    
    # Thời gian quét mã/ghi nhận
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    description: Optional[str] = Field(default=None, description="Mô tả cho khách hàng (vd: Đơn hàng đã đến kho Cầu Giấy)")

    def to_dict(self) -> dict:
        return self.model_dump(mode="json", by_alias=True, exclude_none=True)