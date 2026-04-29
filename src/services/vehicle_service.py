from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from couchbase.exceptions import CouchbaseException

from src.config.couchbase import CouchbaseClient
from src.models.vehicle import Vehicle, VehicleEvent, VehicleEventType
from src.services.warehouse_service import WarehouseService

VEHICLE_COLLECTION = "vehicle"
VEHICLE_EVENT_COLLECTION = "vehicle_event"


def _doc_id(vehicle_id: str) -> str:
    return f"vehicle::{vehicle_id}"


def _event_doc_id(vehicle_id: str, event_id: str) -> str:
    return f"vehicle_event::{vehicle_id}::{event_id}"


class VehicleService:
    def __init__(self, cb: CouchbaseClient):
        self._cb = cb

    async def _apply_warehouse_coordinate(self, vehicle: Vehicle) -> None:
        """If vehicle.warehouse_id is present, enforce vehicle.coordinate = warehouse.coordinate."""
        if not getattr(vehicle, "warehouse_id", None):
            return

        warehouse = await WarehouseService(self._cb).get_warehouse(vehicle.warehouse_id)
        if warehouse is None:
            raise ValueError(f"Invalid warehouseId: warehouse '{vehicle.warehouse_id}' not found")
        if warehouse.coordinate is None:
            raise ValueError(
                f"Invalid warehouseId: warehouse '{vehicle.warehouse_id}' has no coordinate; cannot set vehicle coordinate"
            )

        vehicle.coordinate = warehouse.coordinate

    async def _persist_event(self, event: VehicleEvent) -> None:
        await self._cb.upsert_document(
            _event_doc_id(event.vehicle.id, event.event_id),
            event.to_dict(),
            VEHICLE_EVENT_COLLECTION,
        )

    async def create_vehicle(self, event: VehicleEvent) -> Vehicle:
        if event.event_type !=  VehicleEventType.VEHICLE_REGISTERED:
            raise ValueError(f"Invalid eventType: expected {VehicleEventType.VEHICLE_REGISTERED}, got {event.event_type}")

        # Enforce coordinate from managing warehouse
        await self._apply_warehouse_coordinate(event.vehicle)

        # ensure timestamps
        now = datetime.now(timezone.utc)
        if event.vehicle.created_at is None:
            event.vehicle.created_at = now
        event.vehicle.updated_at = now

        await self._cb.upsert_document(_doc_id(event.vehicle.id), event.vehicle.to_dict(), VEHICLE_COLLECTION)
        await self._persist_event(event)
        return event.vehicle

    async def get_vehicle(self, vehicle_id: str) -> Optional[Vehicle]:
        doc = await self._cb.get_document(_doc_id(vehicle_id), VEHICLE_COLLECTION)
        if not doc:
            return None
        return Vehicle.model_validate(doc)

    async def list_vehicles(self, *, limit: int = 100, offset: int = 0) -> list[Vehicle]:
        scope_name = self._cb.scope.name if self._cb.scope else "default"
        statement = (
            f"SELECT v.* FROM `{self._cb.bucket.name}`.`{scope_name}`.{VEHICLE_COLLECTION} v "
            "ORDER BY v.updatedAt DESC "
            "LIMIT $limit OFFSET $offset"
        )

        try:
            result = await self._cb.query(statement, limit=limit, offset=offset)
            rows = list(result)
            return [Vehicle.model_validate(row) for row in rows]
        except CouchbaseException as e:
            print(f"Couchbase query failed: {e}")
            return []

    async def update_vehicle(self, event: VehicleEvent) -> Optional[Vehicle]:
        existing = await self.get_vehicle(event.vehicle.id)
        if existing is None:
            return None

        # Enforce coordinate from managing warehouse (if provided)
        await self._apply_warehouse_coordinate(event.vehicle)

        # keep original created_at, always bump updated_at
        event.vehicle.created_at = existing.created_at
        event.vehicle.updated_at = datetime.now(timezone.utc)

        await self._cb.upsert_document(_doc_id(event.vehicle.id), event.vehicle.to_dict(), VEHICLE_COLLECTION)
        await self._persist_event(event)
        return event.vehicle

    async def delete_vehicle(self, vehicle_id: str, event: VehicleEvent) -> bool:
        existing = await self.get_vehicle(vehicle_id)
        if existing is None:
            return False

        # ensure event has correct snapshot/id
        event.vehicle.id = vehicle_id
        event.vehicle.created_at = existing.created_at
        event.vehicle.updated_at = datetime.now(timezone.utc)

        try:
            await self._cb.remove_document(_doc_id(vehicle_id), VEHICLE_COLLECTION)
            await self._persist_event(event)
            return True
        except CouchbaseException:
            return False

    @staticmethod
    def validate_event_type_for_operation(operation: str, event_type: VehicleEventType) -> None:
        mapping = {
            "create": VehicleEventType.VEHICLE_REGISTERED,
            "update": VehicleEventType.VEHICLE_UPDATED,
            "delete": VehicleEventType.VEHICLE_DELETED,
        }
        expected = mapping.get(operation)
        if expected is not None and event_type != expected:
            raise ValueError(f"Invalid eventType for {operation}: expected {expected}, got {event_type}")
