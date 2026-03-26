from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from couchbase.exceptions import CouchbaseException

from src.config.couchbase import CouchbaseClient
from src.models.warehouse import Warehouse, WarehouseEvent, WarehouseEventType

WAREHOUSE_COLLECTION = "warehouse"
WAREHOUSE_EVENT_COLLECTION = "warehouse_event"


def _doc_id(warehouse_id: str) -> str:
    return f"warehouse::{warehouse_id}"


def _event_doc_id(warehouse_id: str, event_id: str) -> str:
    return f"warehouse_event::{warehouse_id}::{event_id}"


class WarehouseService:
    def __init__(self, cb: CouchbaseClient):
        self._cb = cb

    async def _persist_event(self, event: WarehouseEvent) -> None:
        await self._cb.upsert_document(
            _event_doc_id(event.warehouse.id, event.event_id),
            event.to_dict(),
            WAREHOUSE_EVENT_COLLECTION,
        )

    async def create_warehouse(self, event: WarehouseEvent) -> Warehouse:
        if event.event_type != WarehouseEventType.WAREHOUSE_REGISTERED:
            raise ValueError(
                f"Invalid eventType: expected {WarehouseEventType.WAREHOUSE_REGISTERED}, got {event.event_type}"
            )

        now = datetime.now(timezone.utc)
        if getattr(event.warehouse, "created_at", None) is None:
            event.warehouse.created_at = now
        event.warehouse.updated_at = now

        await self._cb.upsert_document(
            _doc_id(event.warehouse.id),
            event.warehouse.to_dict(),
            WAREHOUSE_COLLECTION,
        )
        await self._persist_event(event)
        return event.warehouse

    async def get_warehouse(self, warehouse_id: str) -> Optional[Warehouse]:
        doc = await self._cb.get_document(_doc_id(warehouse_id), WAREHOUSE_COLLECTION)
        if not doc:
            return None
        return Warehouse.model_validate(doc)

    async def list_warehouses(self, *, limit: int = 100, offset: int = 0) -> list[Warehouse]:
        scope_name = self._cb.scope.name if self._cb.scope else "default"
        statement = (
            f"SELECT w.* FROM `{self._cb.bucket.name}`.`{scope_name}`.{WAREHOUSE_COLLECTION} w "
            "ORDER BY w.updatedAt DESC "
            "LIMIT $limit OFFSET $offset"
        )

        try:
            result = await self._cb.query(statement, limit=limit, offset=offset)
            rows = list(result)
            return [Warehouse.model_validate(row) for row in rows]
        except CouchbaseException as e:
            print(f"Couchbase query failed: {e}")
            return []

    async def update_warehouse(self, event: WarehouseEvent) -> Optional[Warehouse]:
        existing = await self.get_warehouse(event.warehouse.id)
        if existing is None:
            return None

        event.warehouse.created_at = existing.created_at
        event.warehouse.updated_at = datetime.now(timezone.utc)

        await self._cb.upsert_document(
            _doc_id(event.warehouse.id),
            event.warehouse.to_dict(),
            WAREHOUSE_COLLECTION,
        )
        await self._persist_event(event)
        return event.warehouse

    async def delete_warehouse(self, warehouse_id: str, event: WarehouseEvent) -> bool:
        existing = await self.get_warehouse(warehouse_id)
        if existing is None:
            return False

        event.warehouse.id = warehouse_id
        event.warehouse.created_at = existing.created_at
        event.warehouse.updated_at = datetime.now(timezone.utc)

        try:
            await self._cb.remove_document(_doc_id(warehouse_id), WAREHOUSE_COLLECTION)
            await self._persist_event(event)
            return True
        except CouchbaseException:
            return False

    @staticmethod
    def validate_event_type_for_operation(operation: str, event_type: WarehouseEventType) -> None:
        mapping = {
            "create": WarehouseEventType.WAREHOUSE_REGISTERED,
            "update": WarehouseEventType.WAREHOUSE_UPDATED,
            "delete": WarehouseEventType.WAREHOUSE_DELETED,
        }
        expected = mapping.get(operation)
        if expected is not None and event_type != expected:
            raise ValueError(f"Invalid eventType for {operation}: expected {expected}, got {event_type}")
