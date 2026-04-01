from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from couchbase.exceptions import CouchbaseException

from src.config.couchbase import CouchbaseClient
from src.models.order import Order, OrderMovementEvent

ORDER_COLLECTION = "order"
ORDER_MOVEMENT_EVENT_COLLECTION = "order_movement_event"


def _doc_id(order_id: str) -> str:
    return f"order::{order_id}"


def _event_doc_id(order_id: str, event_id: str) -> str:
    return f"order_movement_event::{order_id}::{event_id}"


class OrderService:
    def __init__(self, cb: CouchbaseClient):
        self._cb = cb

    async def _persist_movement_event(self, event: OrderMovementEvent) -> None:
        await self._cb.upsert_document(
            _event_doc_id(event.order_id, event.event_id),
            event.to_dict(),
            ORDER_MOVEMENT_EVENT_COLLECTION,
        )

    async def create_order(self, order: Order) -> Order:

        # print(order)
        await self._cb.upsert_document(_doc_id(order.id), order.to_dict(), ORDER_COLLECTION)
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

    async def append_movement_event(self, event: OrderMovementEvent) -> OrderMovementEvent:
        # Ensure the order exists before writing tracking history.
        existing = await self.get_order(event.order_id)
        if existing is None:
            raise ValueError("Order not found")

        await self._persist_movement_event(event)
        return event

    async def list_movement_events(self, order_id: str, *, limit: int = 200, offset: int = 0) -> list[OrderMovementEvent]:
        scope_name = self._cb.scope.name if self._cb.scope else "default"
        statement = (
            f"SELECT e.* FROM `{self._cb.bucket.name}`.`{scope_name}`.`{ORDER_MOVEMENT_EVENT_COLLECTION}` e "
            "WHERE e.orderId = $order_id "
            "ORDER BY e.timestamp DESC "
            "LIMIT $limit OFFSET $offset"
        )

        try:
            result = await self._cb.query(statement, order_id=order_id, limit=limit, offset=offset)
            rows = list(result)
            return [OrderMovementEvent.model_validate(row) for row in rows]
        except CouchbaseException as e:
            print(f"Couchbase query failed: {e}")
            return []
