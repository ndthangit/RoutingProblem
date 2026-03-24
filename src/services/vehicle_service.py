from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from couchbase.exceptions import CouchbaseException

from src.config.couchbase import CouchbaseClient
from src.models.vehicle import Vehicle, VehicleEvent, VehicleEventType

VEHICLE_COLLECTION = "vehicle"
VEHICLE_EVENT_COLLECTION = "vehicle_event"


def _doc_id(vehicle_id: str) -> str:
    return f"vehicle::{vehicle_id}"


def _event_doc_id(vehicle_id: str, event_id: str) -> str:
    return f"vehicle_event::{vehicle_id}::{event_id}"


class VehicleService:
    def __init__(self, cb: CouchbaseClient):
        self._cb = cb

    async def _persist_event(self, event: VehicleEvent) -> None:
        await self._cb.upsert_document(
            _event_doc_id(event.vehicle.id, event.event_id),
            event.to_dict(),
            VEHICLE_EVENT_COLLECTION,
        )

    async def create_vehicle(self, event: VehicleEvent) -> Vehicle:
        if event.event_type !=  VehicleEventType.VEHICLE_REGISTERED:
            raise ValueError(f"Invalid eventType: expected {VehicleEventType.VEHICLE_REGISTERED}, got {event.event_type}")

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

        if event.vehicle.id != event.vehicle.id:
            # If client sent mismatched ids, prefer path param.
            event.vehicle.id = event.vehicle.id

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
