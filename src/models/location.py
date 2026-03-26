# ============== LOCATION OBJECT ==============
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class Location(BaseModel):
    """Value object đại diện cho một địa điểm vật lý"""
    model_config = ConfigDict(populate_by_name=True)
    
    address: str = Field(..., min_length=5, max_length=255, description="Địa chỉ chi tiết (Số nhà, ngõ, đường...)")
    ward: Optional[str] = Field(default=None, description="Phường/Xã")
    district: Optional[str] = Field(default=None, description="Quận/Huyện")
    province: Optional[str] = Field(default=None, description="Tỉnh/Thành phố")
    country: str = Field(default="VN", description="Mã quốc gia")
    
    # Tọa độ GPS
    latitude: Optional[float] = Field(default=None, ge=-90, le=90, description="Vĩ độ")
    longitude: Optional[float] = Field(default=None, ge=-180, le=180, description="Kinh độ")