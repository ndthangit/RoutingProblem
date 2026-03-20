from __future__ import annotations

from datetime import datetime, timezone, timedelta
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field

from src.models.user import User


class DriverStatus(str, Enum):
    """High-level operational status for a driver."""

    OFFLINE = "OFFLINE"  # no heartbeat / not connected
    OFF_DUTY = "OFF_DUTY"  # online but not accepting jobs
    AVAILABLE = "AVAILABLE"  # can accept jobs
    BUSY = "BUSY"  # has an active job/trip
    SUSPENDED = "SUSPENDED"  # disabled/suspended by admin


class DriverAvailabilityMode(str, Enum):
    OFF_DUTY = "OFF_DUTY"
    ON_DUTY = "ON_DUTY"


class DriverLocation(BaseModel):
    lat: float
    lon: float


class Driver(User):
    """Driver object derived from User, with fields to infer driver status."""

    # Guard/role marker (useful when mapping from a generic User)
    isDriver: bool = True

    # Admin/ops controls
    suspended: bool = False

    # Presence / duty
    availabilityMode: DriverAvailabilityMode = DriverAvailabilityMode.OFF_DUTY
    lastSeenAt: Optional[datetime] = None  # heartbeat time

    # Workload
    activeTaskId: Optional[str] = None  # trip/order currently assigned/accepted

    # Telemetry
    currentLocation: Optional[DriverLocation] = None
    locationUpdatedAt: Optional[datetime] = None

    # Vehicle (optional but often needed)
    vehicleId: Optional[str] = None

    # Keep flexible extra data (in addition to User.attributes)
    driverAttributes: dict[str, Any] = Field(default_factory=dict)

    def is_online(self, *, now: Optional[datetime] = None, ttl_seconds: int = 90) -> bool:
        """Return True if lastSeenAt is within ttl_seconds of now."""
        if self.lastSeenAt is None:
            return False
        now = now or datetime.now(timezone.utc)
        # lastSeenAt might be naive if coming from older code; treat as UTC.
        last_seen = self.lastSeenAt
        if last_seen.tzinfo is None:
            last_seen = last_seen.replace(tzinfo=timezone.utc)
        return (now - last_seen) <= timedelta(seconds=ttl_seconds)

    def get_status(self, *, now: Optional[datetime] = None, online_ttl_seconds: int = 90) -> DriverStatus:
        """Compute driver status from fields.

        Rules (simple and predictable):
        - suspended or not enabled => SUSPENDED
        - not online (heartbeat stale) => OFFLINE
        - availabilityMode == OFF_DUTY => OFF_DUTY
        - activeTaskId set => BUSY
        - else => AVAILABLE
        """
        if self.suspended or not self.enabled:
            return DriverStatus.SUSPENDED

        if not self.is_online(now=now, ttl_seconds=online_ttl_seconds):
            return DriverStatus.OFFLINE

        if self.availabilityMode == DriverAvailabilityMode.OFF_DUTY:
            return DriverStatus.OFF_DUTY

        if self.activeTaskId:
            return DriverStatus.BUSY

        return DriverStatus.AVAILABLE

    @property
    def status(self) -> DriverStatus:
        # Default computation with default TTL.
        return self.get_status()

    def to_dict(self) -> dict:
        base = super().to_dict()
        base.update(
            {
                "isDriver": self.isDriver,
                "suspended": self.suspended,
                "availabilityMode": self.availabilityMode,
                "lastSeenAt": self.lastSeenAt.isoformat() if self.lastSeenAt else None,
                "activeTaskId": self.activeTaskId,
                "currentLocation": self.currentLocation.model_dump() if self.currentLocation else None,
                "locationUpdatedAt": self.locationUpdatedAt.isoformat() if self.locationUpdatedAt else None,
                "vehicleId": self.vehicleId,
                "driverAttributes": self.driverAttributes,
                "status": self.status,
            }
        )
        return base

