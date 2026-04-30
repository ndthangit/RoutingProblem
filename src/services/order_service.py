from __future__ import annotations

from typing import Optional

from couchbase.exceptions import CouchbaseException

from src.config.couchbase import CouchbaseClient
from src.models.order import Order, OrderEvent
from src.models.customer_warehouse import CustomerWarehouseEvent, CustomerWarehouseEventType
from src.services.routing_service import RoutingService
from src.services.customer_warehouse_service import CustomerWarehouseService

ORDER_COLLECTION = "order"
ORDER_EVENT_COLLECTION = "order_event"


def _doc_id(order_id: str) -> str:
    return f"order::{order_id}"


def _event_doc_id(order_id: str, event_id: str) -> str:
    return f"order_event::{order_id}::{event_id}"


class OrderService:
    def __init__(self, cb: CouchbaseClient):
        self._cb = cb

    async def _persist_event(self, event: OrderEvent) -> None:
        await self._cb.upsert_document(
            _event_doc_id(event.order.id, event.event_id),
            event.to_dict(),
            ORDER_EVENT_COLLECTION,
        )

    async def create_order(self, event: OrderEvent) -> Order:
        """Create an order from an event envelope and persist both aggregate + event."""
        # Ensure eventType is the expected one for creating an order.
        if event.event_type != event.event_type.ORDER_CREATED:
            raise ValueError(f"Invalid eventType for create: {event.event_type}")

        # ORIGIN: for order creation, client sends order.origin as a customer_warehouse id.
        # We denormalize origin address + coordinate onto the order.
        cw_service = CustomerWarehouseService(self._cb)
        customer_warehouse = await cw_service.get_customer_warehouse(event.order.origin)
        if customer_warehouse is None:
            raise ValueError(f"Invalid origin: customer warehouse '{event.order.origin}' not found")
        if customer_warehouse.coordinate is None:
            raise ValueError(
                f"Invalid origin: customer warehouse '{customer_warehouse.id}' has no coordinate"
            )

        # Denormalize for routing
        event.order.origin = customer_warehouse.address
        event.order.origin_coordinate = customer_warehouse.coordinate

        # DESTINATION: if client did not pass coordinate, geocode
        if event.order.destination_coordinate is None:
            event.order.destination_coordinate = await RoutingService().geocode_address(event.order.destination)

        order = event.order

        # Persist order + order event
        await self._cb.upsert_document(_doc_id(order.id), order.to_dict(), ORDER_COLLECTION)
        await self._persist_event(event)

        # Emit and apply CustomerWarehouse LOAD update (pendingWeight + pending orders)
        updated_cw = customer_warehouse.model_copy(deep=True)
        updated_cw.pending_weight = (updated_cw.pending_weight or 0.0) + order.package.weight_kg
        updated_cw.total_pending_orders = (updated_cw.total_pending_orders or 0) + 1
        cw_event = CustomerWarehouseEvent(
            eventType=CustomerWarehouseEventType.LOAD_VOLUME_UPDATED,
            customerWarehouse=updated_cw,
            ownerEmail=event.owner_email,
        )
        await cw_service.update_customer_warehouse(cw_event)

        return order

    async def get_order(self, order_id: str) -> Optional[Order]:
        doc = await self._cb.get_document(_doc_id(order_id), ORDER_COLLECTION)
        if not doc:
            return None
        return Order.model_validate(doc)

    async def list_orders(self, *, limit: int = 100, offset: int = 0) -> list[Order]:
        scope_name = self._cb.scope.name if self._cb.scope else "default"
        statement = (
            f"SELECT o.* FROM `{self._cb.bucket.name}`.`{scope_name}`.`{ORDER_COLLECTION}` o "
            "ORDER BY o.createdAt DESC "
            "LIMIT $limit OFFSET $offset"
        )

        try:
            result = await self._cb.query(statement, limit=limit, offset=offset)
            rows = list(result)
            return [Order.model_validate(row) for row in rows]
        except CouchbaseException as e:
            print(f"Couchbase query failed: {e}")
            return []

    async def update_order(self, order_id: str, order: Order) -> Optional[Order]:
        existing = await self.get_order(order_id)
        if existing is None:
            return None

        # Order is intended to be immutable; keep original created_at.
        order.id = order_id
        order.created_at = existing.created_at

        await self._cb.upsert_document(_doc_id(order_id), order.to_dict(), ORDER_COLLECTION)
        return order

    async def delete_order(self, order_id: str) -> bool:
        existing = await self.get_order(order_id)
        if existing is None:
            return False

        try:
            await self._cb.remove_document(_doc_id(order_id), ORDER_COLLECTION)
            return True
        except CouchbaseException:
            return False

    async def append_event(self, event: OrderEvent) -> OrderEvent:
        # Ensure the order exists before writing history.
        existing = await self.get_order(event.order.id)
        if existing is None:
            raise ValueError("Order not found")

        # Keep the stored order immutable fields stable.
        event.order.created_at = existing.created_at
        await self._persist_event(event)
        return event

    async def list_events(self, order_id: str, *, limit: int = 200, offset: int = 0) -> list[OrderEvent]:
        scope_name = self._cb.scope.name if self._cb.scope else "default"
        statement = (
            f"SELECT e.* FROM `{self._cb.bucket.name}`.`{scope_name}`.`{ORDER_EVENT_COLLECTION}` e "
            # New schema stores nested order object. Keep a fallback for old documents if any.
            "WHERE e.order.id = $order_id OR e.orderId = $order_id "
            "ORDER BY e.timestamp DESC "
            "LIMIT $limit OFFSET $offset"
        )

        try:
            result = await self._cb.query(statement, order_id=order_id, limit=limit, offset=offset)
            rows = list(result)
            return [OrderEvent.model_validate(row) for row in rows]
        except CouchbaseException as e:
            print(f"Couchbase query failed: {e}")
            return []
