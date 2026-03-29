from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field, ConfigDict


class Coordinate(BaseModel):
    """OSRM expects lon,lat. We keep explicit naming to avoid confusion."""

    model_config = ConfigDict(populate_by_name=True)

    lon: float = Field(..., ge=-180, le=180)
    lat: float = Field(..., ge=-90, le=90)

    def to_osrm_str(self) -> str:
        return f"{self.lon},{self.lat}"


class RouteRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    coordinates: list[Coordinate] = Field(..., min_length=2, description="List of coordinates (lon/lat)")
    profile: Literal["driving", "driving-traffic", "walking", "cycling"] = Field(
        default="driving", description="OSRM profile"
    )
    steps: bool = Field(default=False)
    alternatives: bool = Field(default=False)
    overview: Literal["simplified", "full", "false"] = Field(default="simplified")
    geometries: Literal["polyline", "polyline6", "geojson"] = Field(default="geojson")


class RouteLeg(BaseModel):
    distance_m: float = Field(..., alias="distanceM")
    duration_s: float = Field(..., alias="durationS")


class RouteResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    distance_m: float = Field(..., alias="distanceM")
    duration_s: float = Field(..., alias="durationS")
    geometry: dict = Field(..., description="GeoJSON LineString")
    legs: list[RouteLeg] = Field(default_factory=list)


class EtaUpdate(BaseModel):
    """Payload pushed to frontend via WebSocket."""

    model_config = ConfigDict(populate_by_name=True)

    type: Literal["eta.update"] = "eta.update"
    vehicle_id: Optional[str] = Field(default=None, alias="vehicleId")
    route_id: Optional[str] = Field(default=None, alias="routeId")
    distance_m: float = Field(..., alias="distanceM")
    duration_s: float = Field(..., alias="durationS")
    geometry: Optional[dict] = None

