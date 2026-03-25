from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from couchbase.exceptions import CouchbaseException

from src.config.couchbase import CouchbaseClient
from src.models.driver import Driver, DriverEvent, DriverEventType

DRIVER_COLLECTION = "driver"
DRIVER_EVENT_COLLECTION = "driver_event"


def _doc_id(driver_id: str) -> str:
    return f"driver::{driver_id}"


def _event_doc_id(driver_id: str, event_id: str) -> str:
    return f"driver_event::{driver_id}::{event_id}"


class DriverService:
    def __init__(self, cb: CouchbaseClient):
        self._cb = cb

    async def _persist_event(self, event: DriverEvent) -> None:
        await self._cb.upsert_document(
            _event_doc_id(event.driver.id, event.event_id),
            event.to_dict(),
            DRIVER_EVENT_COLLECTION,
        )

    async def create_driver(self, event: DriverEvent) -> Driver:
        if event.event_type != DriverEventType.DRIVER_HIRED:
            raise ValueError(
                f"Invalid eventType: expected {DriverEventType.DRIVER_HIRED}, got {event.event_type}"
            )

        now = datetime.now(timezone.utc)
        # Ensure timestamps
        if getattr(event.driver, "created_at", None) is None:
            event.driver.created_at = now
        event.driver.updated_at = now

        await self._cb.upsert_document(_doc_id(event.driver.id), event.driver.to_dict(), DRIVER_COLLECTION)
        await self._persist_event(event)
        return event.driver

    async def get_driver(self, driver_id: str) -> Optional[Driver]:
        doc = await self._cb.get_document(_doc_id(driver_id), DRIVER_COLLECTION)
        if not doc:
            return None
        return Driver.model_validate(doc)

    async def list_drivers(self, *, limit: int = 100, offset: int = 0) -> list[Driver]:
        scope_name = self._cb.scope.name if self._cb.scope else "default"
        statement = (
            f"SELECT d.* FROM `{self._cb.bucket.name}`.`{scope_name}`.{DRIVER_COLLECTION} d "
            "ORDER BY d.updatedAt DESC "
            "LIMIT $limit OFFSET $offset"
        )

        try:
            result = await self._cb.query(statement, limit=limit, offset=offset)
            rows = list(result)
            return [Driver.model_validate(row) for row in rows]
        except CouchbaseException as e:
            print(f"Couchbase query failed: {e}")
            return []

    async def update_driver(self, event: DriverEvent) -> Optional[Driver]:
        existing = await self.get_driver(event.driver.id)
        if existing is None:
            return None

        # keep original created_at, always bump updated_at
        event.driver.created_at = existing.created_at
        event.driver.updated_at = datetime.now(timezone.utc)

        await self._cb.upsert_document(_doc_id(event.driver.id), event.driver.to_dict(), DRIVER_COLLECTION)
        await self._persist_event(event)
        return event.driver

    async def delete_driver(self, driver_id: str, event: DriverEvent) -> bool:
        existing = await self.get_driver(driver_id)
        if existing is None:
            return False

        # ensure event has correct snapshot/id
        event.driver.id = driver_id
        event.driver.created_at = existing.created_at
        event.driver.updated_at = datetime.now(timezone.utc)

        try:
            await self._cb.remove_document(_doc_id(driver_id), DRIVER_COLLECTION)
            await self._persist_event(event)
            return True
        except CouchbaseException:
            return False

    @staticmethod
    def validate_event_type_for_operation(operation: str, event_type: DriverEventType) -> None:
        mapping = {
            "create": DriverEventType.DRIVER_HIRED,
            "update": DriverEventType.DRIVER_UPDATED,
            "delete": DriverEventType.DRIVER_TERMINATED,
        }
        expected = mapping.get(operation)
        if expected is not None and event_type != expected:
            raise ValueError(f"Invalid eventType for {operation}: expected {expected}, got {event_type}")

