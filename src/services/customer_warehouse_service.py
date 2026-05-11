from __future__ import annotations

import math
import uuid
from datetime import datetime, timezone
from typing import Optional

from couchbase.exceptions import CouchbaseException

from src.config.couchbase import CouchbaseClient
from src.models.customer_warehouse import (
    CustomerWarehouse,
    CustomerWarehouseEvent,
    CustomerWarehouseEventType,
)

from src.models.brand_warehouse import BrandWarehouseType

from src.services.routing_service import RoutingService

CUSTOMER_HOUSE_COLLECTION = "customer_warehouse"
CUSTOMER_HOUSE_EVENT_COLLECTION = "customer_warehouse_event"


def _doc_id(customer_warehouse_id: str) -> str:
    # Keep prefix stable for existing documents
    return f"customer_house::{customer_warehouse_id}"


def _event_doc_id(customer_warehouse_id: str, event_id: str) -> str:
    # Keep prefix stable for existing documents
    return f"customer_house_event::{customer_warehouse_id}::{event_id}"


class CustomerWarehouseService:
    def __init__(self, cb: CouchbaseClient):
        self._cb = cb

    async def _list_hubs(self) -> list[dict]:
        """Return raw hub rows with at least id + coordinate.

        We keep this local to avoid cross-service dependencies.
        """
        scope_name = self._cb.scope.name if self._cb.scope else "default"
        statement = (
            f"SELECT w.id, w.coordinate FROM `{self._cb.bucket.name}`.`{scope_name}`.brand_warehouse w "
            "WHERE w.warehouseType = $warehouse_type AND w.coordinate IS NOT NULL"
        )
        try:
            result = await self._cb.query(statement, warehouse_type=BrandWarehouseType.DEPOT.value)
            return list(result)
        except CouchbaseException as e:
            print(f"Couchbase query failed while listing hubs: {e}")
            return []

    @staticmethod
    def _haversine_m(*, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Great-circle distance in meters."""
        r = 6371000.0
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        d_phi = math.radians(lat2 - lat1)
        d_lam = math.radians(lon2 - lon1)

        a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lam / 2) ** 2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return r * c

    async def _resolve_nearest_hub_id(self, customer_warehouse: CustomerWarehouse) -> Optional[str]:
        if customer_warehouse.coordinate is None:
            return None

        hubs = await self._list_hubs()
        if not hubs:
            return None

        best_id: Optional[str] = None
        best_dist: float = float("inf")
        for hub in hubs:
            coord = hub.get("coordinate") or {}
            lat = coord.get("lat")
            lon = coord.get("lon")
            if lat is None or lon is None:
                continue

            d = self._haversine_m(
                lat1=customer_warehouse.coordinate.lat,
                lon1=customer_warehouse.coordinate.lon,
                lat2=float(lat),
                lon2=float(lon),
            )
            if d < best_dist:
                best_dist = d
                best_id = hub.get("id")

        return best_id

    async def _persist_event(self, event: CustomerWarehouseEvent) -> None:
        await self._cb.upsert_document(
            _event_doc_id(event.customer_warehouse.id, event.event_id),
            event.to_dict(),
            CUSTOMER_HOUSE_EVENT_COLLECTION,
        )

    async def create_customer_warehouse(self, event: CustomerWarehouseEvent) -> CustomerWarehouse:
        if event.event_type != CustomerWarehouseEventType.LOCATION_REGISTERED:
            raise ValueError(
                f"Invalid eventType: expected {CustomerWarehouseEventType.LOCATION_REGISTERED}, got {event.event_type}"
            )

        if not getattr(event.customer_warehouse, "id", None):
            event.customer_warehouse.id = str(uuid.uuid4())

        now = datetime.now(timezone.utc)
        if getattr(event.customer_warehouse, "created_at", None) is None:
            event.customer_warehouse.created_at = now
        event.customer_warehouse.updated_at = now

        if event.customer_warehouse.coordinate is None:
            coord = await RoutingService().geocode_address(event.customer_warehouse.address)
            event.customer_warehouse.coordinate = coord

        # Persist owner for later user-scoped queries.
        if getattr(event, "owner_email", None):
            event.customer_warehouse.owner_email = event.owner_email

        # Default hubResponsible: nearest HUB
        if not event.customer_warehouse.hub_responsible:
            event.customer_warehouse.hub_responsible = await self._resolve_nearest_hub_id(event.customer_warehouse)
            # print(event.customer_warehouse.hub_responsible)

        # print(event.customer_warehouse.to_dict())
        await self._cb.upsert_document(
            _doc_id(event.customer_warehouse.id),
            event.customer_warehouse.to_dict(),
            CUSTOMER_HOUSE_COLLECTION,
        )
        await self._persist_event(event)
        return event.customer_warehouse

    async def get_customer_warehouse(self, customer_warehouse_id: str) -> Optional[CustomerWarehouse]:
        doc = await self._cb.get_document(_doc_id(customer_warehouse_id), CUSTOMER_HOUSE_COLLECTION)
        if not doc:
            return None
        return CustomerWarehouse.model_validate(doc)

    async def list_customer_warehouses(self, *, limit: int = 100, offset: int = 0) -> list[CustomerWarehouse]:
        scope_name = self._cb.scope.name if self._cb.scope else "default"
        statement = (
            f"SELECT c.* FROM `{self._cb.bucket.name}`.`{scope_name}`.{CUSTOMER_HOUSE_COLLECTION} c "
            "ORDER BY c.updatedAt DESC "
            "LIMIT $limit OFFSET $offset"
        )

        try:
            result = await self._cb.query(statement, limit=limit, offset=offset)
            rows = list(result)
            return [CustomerWarehouse.model_validate(row) for row in rows]
        except CouchbaseException as e:
            print(f"Couchbase query failed: {e}")
            return []

    async def get_customer_warehouse_by_owner_email(self, owner_email: str) -> Optional[CustomerWarehouse]:
        """Return the most recently updated customer warehouse owned by the given email."""
        scope_name = self._cb.scope.name if self._cb.scope else "default"
        statement = (
            f"SELECT c.* FROM `{self._cb.bucket.name}`.`{scope_name}`.{CUSTOMER_HOUSE_COLLECTION} c "
            "WHERE c.ownerEmail = $owner_email "
            "ORDER BY c.updatedAt DESC "
            "LIMIT 1"
        )

        try:
            result = await self._cb.query(statement, owner_email=owner_email)
            rows = list(result)
            if not rows:
                return None
            return CustomerWarehouse.model_validate(rows[0])
        except CouchbaseException as e:
            print(f"Couchbase query failed while getting customer warehouse by ownerEmail: {e}")
            return None

    async def update_customer_warehouse(self, event: CustomerWarehouseEvent) -> Optional[CustomerWarehouse]:
        existing = await self.get_customer_warehouse(event.customer_warehouse.id)
        if existing is None:
            return None

        # Keep ownership stable (always prefer server-authenticated owner).
        if getattr(event, "owner_email", None):
            event.customer_warehouse.owner_email = event.owner_email
        else:
            event.customer_warehouse.owner_email = getattr(existing, "owner_email", None)

        event.customer_warehouse.created_at = existing.created_at
        event.customer_warehouse.updated_at = datetime.now(timezone.utc)

        # If address changed and coordinate missing, re-geocode.
        if event.customer_warehouse.coordinate is None and event.customer_warehouse.address:
            coord = await RoutingService().geocode_address(event.customer_warehouse.address)
            event.customer_warehouse.coordinate = coord

        # Default hubResponsible: nearest HUB (also useful for legacy docs)
        if not event.customer_warehouse.hub_responsible:
            event.customer_warehouse.hub_responsible = await self._resolve_nearest_hub_id(event.customer_warehouse)

        await self._cb.upsert_document(
            _doc_id(event.customer_warehouse.id),
            event.customer_warehouse.to_dict(),
            CUSTOMER_HOUSE_COLLECTION,
        )
        await self._persist_event(event)
        return event.customer_warehouse

    async def delete_customer_warehouse(self, customer_warehouse_id: str, event: CustomerWarehouseEvent) -> bool:
        existing = await self.get_customer_warehouse(customer_warehouse_id)
        if existing is None:
            return False

        event.customer_warehouse.id = customer_warehouse_id
        event.customer_warehouse.created_at = existing.created_at
        event.customer_warehouse.updated_at = datetime.now(timezone.utc)

        try:
            await self._cb.remove_document(_doc_id(customer_warehouse_id), CUSTOMER_HOUSE_COLLECTION)
            await self._persist_event(event)
            return True
        except CouchbaseException:
            return False

    @staticmethod
    def validate_event_type_for_operation(operation: str, event_type: CustomerWarehouseEventType) -> None:
        mapping = {
            "create": CustomerWarehouseEventType.LOCATION_REGISTERED,
            "update": CustomerWarehouseEventType.LOCATION_UPDATED,
            "delete": CustomerWarehouseEventType.LOCATION_DELETED,
        }
        expected = mapping.get(operation)
        if expected is not None and event_type != expected:
            raise ValueError(f"Invalid eventType for {operation}: expected {expected}, got {event_type}")

