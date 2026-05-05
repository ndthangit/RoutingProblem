from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field, ConfigDict

from src.models.event import EventBase, EventType
from src.models.user import User

class DriverType(str, Enum):
    """Loại hình tài xế"""
    TRUCK_DRIVER = "TRUCK_DRIVER"   # Tài xế xe tải nội bộ (Full-time)
    SEASONAL = "SEASONAL"           # Shipper thời vụ / Freelancer

class DriverStatus(str, Enum):
    """Trạng thái của tài xế"""
    ACTIVE = "ACTIVE"           # Đang hoạt động
    INACTIVE = "INACTIVE"       # Không hoạt động
    ON_DUTY = "ON_DUTY"         # Đang làm việc
    OFF_DUTY = "OFF_DUTY"       # Nghỉ làm
    ON_LEAVE = "ON_LEAVE"       # Đang nghỉ phép
    SUSPENDED = "SUSPENDED"     # Bị treo hợp đồng
    TERMINATED = "TERMINATED"   # Đã chấm dứt hợp đồng


class DriverLicenseClass(str, Enum):
    """Hạng bằng lái xe"""
    A1 = "A1"   # Xe máy dưới 175cc
    A2 = "A2"   # Xe máy trên 175cc
    B1 = "B1"   # Ô tô số tự động
    B2 = "B2"   # Ô tô số sàn
    C = "C"     # Xe tải
    D = "D"     # Xe khách 16-30 chỗ
    E = "E"     # Xe khách trên 30 chỗ
    F = "F"     # Rơ moóc


class DriverBase(BaseModel):
    """Base model cho Driver với các thông tin đặc thù"""
    # Thông tin tuyển dụng
    employee_code: str = Field(..., min_length=1, max_length=50, description="Mã nhân viên", alias="employeeCode")
    hire_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="Ngày tuyển dụng",
                                alias="hireDate")
    status: DriverStatus = Field(default=DriverStatus.ACTIVE, description="Trạng thái tài xế")
    driver_type: DriverType = Field(default=DriverType.TRUCK_DRIVER, description="Loại hình tài xế", alias="driverType")

    # Thông tin bằng lái
    license_number: str = Field(..., min_length=8, max_length=20, description="Số bằng lái", alias="licenseNumber")
    license_class: List[DriverLicenseClass] = Field(..., description="Hạng bằng lái", alias="licenseClass")
    license_issue_date: datetime = Field(..., description="Ngày cấp bằng", alias="licenseIssueDate")
    license_expiry_date: datetime = Field(..., description="Ngày hết hạn bằng", alias="licenseExpiryDate")

    # Thông tin liên hệ khẩn cấp
    emergency_contact_name: Optional[str] = Field(default=None, max_length=128, description="Tên liên hệ khẩn cấp",
                                                  alias="emergencyContactName")
    emergency_contact_phone: Optional[str] = Field(default=None, max_length=20, description="SĐT liên hệ khẩn cấp",
                                                   alias="emergencyContactPhone")
    emergency_contact_relation: Optional[str] = Field(default=None, max_length=50, description="Mối quan hệ",
                                                      alias="emergencyContactRelation")

    # Thông tin nghề nghiệp
    years_of_experience: int = Field(default=0, ge=0, description="Số năm kinh nghiệm", alias="yearsOfExperience")
    total_trips: int = Field(default=0, ge=0, description="Tổng số chuyến đã thực hiện", alias="totalTrips")
    rating: float = Field(default=5.0, ge=0, le=5, description="Đánh giá trung bình (1-5)")

    # Xe đang phụ trách
    assigned_vehicle_id: Optional[str] = Field(default=None, description="ID xe đang phụ trách",
                                               alias="assignedVehicleId")

    # Kho phụ trách (BrandWarehouse)
    warehouse_id: Optional[str] = Field(
        default=None,
        description="ID kho (BrandWarehouse) mà tài xế thuộc về / phụ trách",
        alias="warehouseId",
    )

    # Hợp đồng
    contract_number: Optional[str] = Field(default=None, max_length=50, description="Số hợp đồng lao động",
                                           alias="contractNumber")
    contract_start_date: Optional[datetime] = Field(default=None, description="Ngày bắt đầu hợp đồng",
                                                    alias="contractStartDate")
    contract_end_date: Optional[datetime] = Field(default=None, description="Ngày kết thúc hợp đồng",
                                                  alias="contractEndDate")

    # Hồ sơ sức khỏe
    health_check_date: Optional[datetime] = Field(default=None, description="Ngày khám sức khỏe gần nhất",
                                                  alias="healthCheckDate")
    health_check_expiry: Optional[datetime] = Field(default=None, description="Hạn khám sức khỏe",
                                                    alias="healthCheckExpiry")
    medical_conditions: Optional[str] = Field(default=None, description="Tình trạng sức khỏe đặc biệt",
                                              alias="medicalConditions")


class Driver(User, DriverBase):
    """
    Đối tượng tài xế - Kế thừa từ User và DriverBase

    Driver là một User đã được tuyển dụng và có các thông tin đặc thù
    như bằng lái, hợp đồng, xe phụ trách, v.v.
    """

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="ID tài xế")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="Thời điểm tạo",
                                 alias="createdAt")
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="Thời điểm cập nhật",
                                 alias="updatedAt")

    def to_dict(self) -> dict:
        """Serialize driver object"""
        return self.model_dump(mode="json", by_alias=True, exclude_none=True)

    @property
    def is_license_valid(self) -> bool:
        """Kiểm tra bằng lái còn hiệu lực"""
        return datetime.now(timezone.utc) < self.license_expiry_date

    @property
    def is_health_check_valid(self) -> bool:
        """Kiểm tra giấy khám sức khỏe còn hiệu lực"""
        if self.health_check_expiry:
            return datetime.now(timezone.utc) < self.health_check_expiry
        return False

    @property
    def is_available_for_trip(self) -> bool:
        """Kiểm tra tài xế có sẵn sàng cho chuyến đi không"""
        return (
                self.status == DriverStatus.ON_DUTY
                and self.is_license_valid
                and self.assigned_vehicle_id is not None
                and self.enabled
        )


# ============== EVENT TYPES ==============
class DriverEventType(EventType):
    """Các loại event cho driver"""
    DRIVER_HIRED = "DRIVER.HIRED"  # Tuyển dụng tài xế
    DRIVER_UPDATED = "DRIVER.UPDATED"  # Cập nhật thông tin
    DRIVER_STATUS_CHANGED = "DRIVER.STATUS.CHANGED"  # Thay đổi trạng thái
    DRIVER_ACTIVATED = "DRIVER.ACTIVATED"  # Kích hoạt
    DRIVER_DEACTIVATED = "DRIVER.DEACTIVATED"  # Vô hiệu hóa
    DRIVER_SUSPENDED = "DRIVER.SUSPENDED"  # Treo hợp đồng
    DRIVER_TERMINATED = "DRIVER.TERMINATED"  # Chấm dứt hợp đồng

    # Sự kiện liên quan đến bằng lái
    DRIVER_LICENSE_UPDATED = "DRIVER.LICENSE.UPDATED"  # Cập nhật bằng lái
    DRIVER_LICENSE_EXPIRING = "DRIVER.LICENSE.EXPIRING"  # Bằng lái sắp hết hạn
    DRIVER_LICENSE_EXPIRED = "DRIVER.LICENSE.EXPIRED"  # Bằng lái đã hết hạn

    # Sự kiện liên quan đến sức khỏe
    DRIVER_HEALTH_CHECK_UPDATED = "DRIVER.HEALTH_CHECK.UPDATED"  # Cập nhật khám sức khỏe
    DRIVER_HEALTH_CHECK_EXPIRING = "DRIVER.HEALTH_CHECK.EXPIRING"  # Sức khỏe sắp hết hạn

    # Sự kiện liên quan đến xe
    DRIVER_VEHICLE_ASSIGNED = "DRIVER.VEHICLE.ASSIGNED"  # Được phân công xe
    DRIVER_VEHICLE_UNASSIGNED = "DRIVER.VEHICLE.UNASSIGNED"  # Bị thu hồi xe

    # Sự kiện liên quan đến chuyến đi
    DRIVER_TRIP_STARTED = "DRIVER.TRIP.STARTED"  # Bắt đầu chuyến
    DRIVER_TRIP_COMPLETED = "DRIVER.TRIP.COMPLETED"  # Hoàn thành chuyến
    DRIVER_TRIP_CANCELLED = "DRIVER.TRIP.CANCELLED"  # Hủy chuyến

    # Sự kiện liên quan đến đánh giá
    DRIVER_RATED = "DRIVER.RATED"  # Được đánh giá
    DRIVER_ACHIEVEMENT_EARNED = "DRIVER.ACHIEVEMENT.EARNED"  # Đạt thành tích


# ============== EVENT ==============
class DriverEvent(EventBase):
    """Base class cho tất cả driver events"""
    model_config = ConfigDict(populate_by_name=True)
    event_type: DriverEventType = Field(..., alias="eventType")
    driver: Driver

    def to_dict(self) -> dict:
        """Serialize driver event"""
        return self.model_dump(mode="json", by_alias=True, exclude_none=True)
