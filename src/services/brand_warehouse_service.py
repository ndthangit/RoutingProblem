from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
import uuid

from couchbase.exceptions import CouchbaseException

from src.config.couchbase import CouchbaseClient
from src.services.routing_service import RoutingService
from src.models.brand_warehouse import BrandWarehouse, WarehouseEvent, BrandWarehouseEventType

BRAND_WAREHOUSE_COLLECTION = "brand_warehouse"
BRAND_WAREHOUSE_EVENT_COLLECTION = "brand_warehouse_event"


def _doc_id(warehouse_id: str) -> str:
    return f"warehouse::{warehouse_id}"


def _event_doc_id(warehouse_id: str, event_id: str) -> str:
    return f"warehouse_event::{warehouse_id}::{event_id}"


class BrandWarehouseService:
    def __init__(self, cb: CouchbaseClient):
        self._cb = cb

    async def _persist_event(self, event: WarehouseEvent) -> None:
        await self._cb.upsert_document(
            _event_doc_id(event.warehouse.id, event.event_id),
            event.to_dict(),
            BRAND_WAREHOUSE_EVENT_COLLECTION,
        )


    async def create_warehouse(self, event: WarehouseEvent) -> BrandWarehouse:
        if event.event_type != BrandWarehouseEventType.WAREHOUSE_REGISTERED:
            raise ValueError(
                f"Invalid eventType: expected {BrandWarehouseEventType.WAREHOUSE_REGISTERED}, got {event.event_type}"
            )

        # Frontend may send only address/name and omit id. Generate it here.
        if not getattr(event.warehouse, "id", None):
            event.warehouse.id = str(uuid.uuid4())

        now = datetime.now(timezone.utc)
        if getattr(event.warehouse, "created_at", None) is None:
            event.warehouse.created_at = now
        event.warehouse.updated_at = now

        # Enrich coordinate from address (geocoding) when missing.
        # Frontend can omit lat/lon; backend will resolve address -> coordinate before persisting.
        if event.warehouse.coordinate is None:
            coord = await RoutingService().geocode_address(event.warehouse.address)
            event.warehouse.coordinate = coord


        await self._cb.upsert_document(
            _doc_id(event.warehouse.id),
            event.warehouse.to_dict(),
            BRAND_WAREHOUSE_COLLECTION,
        )
        await self._persist_event(event)

        return event.warehouse

    async def get_warehouse(self, warehouse_id: str) -> Optional[BrandWarehouse]:
        doc = await self._cb.get_document(_doc_id(warehouse_id), BRAND_WAREHOUSE_COLLECTION)
        if not doc:
            return None
        return BrandWarehouse.model_validate(doc)

    async def list_warehouses(self, *, limit: int = 100, offset: int = 0) -> list[BrandWarehouse]:
        scope_name = self._cb.scope.name if self._cb.scope else "default"
        statement = (
            f"SELECT w.* FROM `{self._cb.bucket.name}`.`{scope_name}`.{BRAND_WAREHOUSE_COLLECTION} w "
            "ORDER BY w.updatedAt DESC "
            "LIMIT $limit OFFSET $offset"
        )

        try:
            result = await self._cb.query(statement, limit=limit, offset=offset)
            rows = list(result)
            return [BrandWarehouse.model_validate(row) for row in rows]
        except CouchbaseException as e:
            print(f"Couchbase query failed: {e}")
            return []

    async def list_warehouses_in_bbox(
        self,
        *,
        min_lat: float,
        min_lon: float,
        max_lat: float,
        max_lon: float,
        limit: int = 5000,
    ) -> list[BrandWarehouse]:
        """List warehouses inside a bounding box.

        Designed for map viewport queries (scale-friendly);
        UI can call repeatedly on move/zoom with debounce.
        """
        scope_name = self._cb.scope.name if self._cb.scope else "default"
        statement = (
            f"SELECT w.* FROM `{self._cb.bucket.name}`.`{scope_name}`.{BRAND_WAREHOUSE_COLLECTION} w "
            "WHERE w.coordinate IS NOT NULL "
            "AND w.coordinate.lat BETWEEN $min_lat AND $max_lat "
            "AND w.coordinate.lon BETWEEN $min_lon AND $max_lon "
            "ORDER BY w.updatedAt DESC "
            "LIMIT $limit"
        )

        try:
            result = await self._cb.query(
                statement,
                min_lat=min_lat,
                max_lat=max_lat,
                min_lon=min_lon,
                max_lon=max_lon,
                limit=limit,
            )
            rows = list(result)
            return [BrandWarehouse.model_validate(row) for row in rows]
        except CouchbaseException as e:
            print(f"Couchbase query failed: {e}")
            return []

    async def update_warehouse(self, event: WarehouseEvent) -> Optional[BrandWarehouse]:
        existing = await self.get_warehouse(event.warehouse.id)
        if existing is None:
            return None

        event.warehouse.created_at = existing.created_at
        event.warehouse.updated_at = datetime.now(timezone.utc)

        await self._cb.upsert_document(
            _doc_id(event.warehouse.id),
            event.warehouse.to_dict(),
            BRAND_WAREHOUSE_COLLECTION,
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
            await self._cb.remove_document(_doc_id(warehouse_id), BRAND_WAREHOUSE_COLLECTION)
            await self._persist_event(event)
            return True
        except CouchbaseException:
            return False

    @staticmethod
    def validate_event_type_for_operation(operation: str, event_type: BrandWarehouseEventType) -> None:
        mapping = {
            "create": BrandWarehouseEventType.WAREHOUSE_REGISTERED,
            "update": BrandWarehouseEventType.WAREHOUSE_UPDATED,
            "delete": BrandWarehouseEventType.WAREHOUSE_DELETED,
        }
        expected = mapping.get(operation)
        if expected is not None and event_type != expected:
            raise ValueError(f"Invalid eventType for {operation}: expected {expected}, got {event_type}")
