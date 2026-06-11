from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Optional

from couchbase.exceptions import CouchbaseException

from src.config.couchbase import CouchbaseClient
from src.models.order_event_kafka import list_order_events_from_kafka
from src.models.order import Order, OrderEvent, OrderEventType
from src.models.customer_warehouse import CustomerWarehouseEvent, CustomerWarehouseEventType
from src.models.routing import Point
from src.services.routing_service import RoutingService
from src.services.customer_warehouse_service import CustomerWarehouseService
from src.services.order_customer_warehouse_service import OrderCustomerWarehouseService
from src.services.order_point_service import OrderPointService

ORDER_COLLECTION = "order"


def _doc_id(order_id: str) -> str:
    return f"order::{order_id}"


class OrderService:
    def __init__(self, cb: CouchbaseClient):
        self._cb = cb

    @staticmethod
    def _merge_order_update(existing: Order, incoming: Order) -> Order:
        """Apply editable order fields while preserving server-managed route metadata."""
        updated = incoming.model_copy(deep=True)
        updated.id = existing.id
        updated.created_at = existing.created_at
        updated.updated_at = datetime.now(timezone.utc)

        if updated.routes is None:
            updated.routes = existing.routes

        return updated

    @staticmethod
    def _is_same_point(left: Point, right: Point) -> bool:
        if left.id and right.id and left.id == right.id:
            return True

        if left.coordinate is not None and right.coordinate is not None:
            if left.coordinate.lat == right.coordinate.lat and left.coordinate.lon == right.coordinate.lon:
                return True

        return left.address == right.address and left.name == right.name

    async def _apply_customer_warehouse_load(
        self,
        cw_service: CustomerWarehouseService,
        customer_warehouse,
        order: Order,
        event: OrderEvent,
    ) -> None:
        updated_cw = customer_warehouse.model_copy(deep=True)
        updated_cw.pending_weight = (updated_cw.pending_weight or 0.0) + order.package.weight_kg
        updated_cw.total_pending_orders = (updated_cw.total_pending_orders or 0) + 1
        cw_event = CustomerWarehouseEvent(
            eventType=CustomerWarehouseEventType.LOAD_VOLUME_UPDATED,
            customerWarehouse=updated_cw,
            ownerEmail=event.owner_email,
        )
        await cw_service.update_customer_warehouse(cw_event)

    async def create_order(self, event: OrderEvent) -> Order:
        """Create an order from an event envelope and persist the aggregate."""
        # Ensure eventType is the expected one for creating an order.
        if event.event_type != OrderEventType.ORDER_CREATED:
            raise ValueError(f"Invalid eventType for create: {event.event_type}")

        existing = await self.get_order(event.order.id)
        if existing is not None:
            return existing

        cw_service = CustomerWarehouseService(self._cb)
        routing_service = RoutingService()

        # ---------------- ORIGIN ----------------
        # New schema: order.origin is a Point.
        # Backward-compat: some clients may still send origin as a string (customer_warehouse id or free-text).
        if isinstance(event.order.origin, str):  # type: ignore[unreachable]
            # Treat as customer warehouse id (old behavior)
            event.order.origin = Point(address=event.order.origin)

        # ---------------- DESTINATION ----------------
        # New schema: order.destination is a Point.
        # Backward-compat: if a client still sends destination as a string.
        if isinstance(event.order.destination, str):  # type: ignore[unreachable]
            event.order.destination = Point(address=event.order.destination)

        origin_id = getattr(event.order.origin, "id", None) if event.order.origin else None
        customer_warehouse_task = (
            asyncio.create_task(cw_service.get_customer_warehouse(origin_id)) if origin_id else None
        )
        origin_geocode_task = (
            asyncio.create_task(routing_service.geocode_address(event.order.origin.address))
            if not origin_id and event.order.origin.coordinate is None
            else None
        )
        destination_geocode_task = (
            asyncio.create_task(routing_service.geocode_address(event.order.destination.address))
            if event.order.destination.coordinate is None
            else None
        )
        background_tasks = [
            task
            for task in (customer_warehouse_task, origin_geocode_task, destination_geocode_task)
            if task is not None
        ]

        customer_warehouse = None
        try:
            # If origin.id looks like a customer_warehouse id, resolve and denormalize it.
            if customer_warehouse_task is not None:
                try:
                    customer_warehouse = await customer_warehouse_task
                except Exception:
                    customer_warehouse = None

            if customer_warehouse is not None:
                if customer_warehouse.coordinate is None:
                    raise ValueError(
                        f"Invalid origin: customer warehouse '{customer_warehouse.id}' has no coordinate"
                    )
                event.order.origin.address = customer_warehouse.address
                event.order.origin.coordinate = customer_warehouse.coordinate
            elif event.order.origin.coordinate is None:
                if origin_geocode_task is not None:
                    event.order.origin.coordinate = await origin_geocode_task
                else:
                    event.order.origin.coordinate = await routing_service.geocode_address(event.order.origin.address)

            if destination_geocode_task is not None:
                event.order.destination.coordinate = await destination_geocode_task
        except Exception:
            for task in background_tasks:
                if not task.done():
                    task.cancel()
            await asyncio.gather(*background_tasks, return_exceptions=True)
            raise

        order = event.order
        order.routes = await OrderPointService(self._cb).build_order_points(
            order,
            customer_warehouse=customer_warehouse,
        )

        # Persist the aggregate first; then fan out independent side-effects.
        await self._cb.upsert_document(_doc_id(order.id), order.to_dict(), ORDER_COLLECTION)

        post_persist_tasks = []
        if customer_warehouse is not None:
            post_persist_tasks.append(
                self._apply_customer_warehouse_load(cw_service, customer_warehouse, order, event)
            )
        if post_persist_tasks:
            await asyncio.gather(*post_persist_tasks)

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

    @classmethod
    def _is_ready_for_delivery_from_depot(cls, order: Order, depot: Point) -> bool:
        if not order.routes:
            return False

        current_index = order.route_state or 0
        next_index = current_index + 1
        if current_index < 0 or next_index >= len(order.routes):
            return False

        current_point = order.routes[current_index]
        next_point = order.routes[next_index]
        return cls._is_same_point(current_point, depot) and cls._is_same_point(next_point, order.destination)

    async def list_delivery_ready_orders_for_depot(self, depot: Point) -> list[Order]:
        """Return orders currently at `depot` whose next route point is the buyer destination."""
        scope_name = self._cb.scope.name if self._cb.scope else "default"
        statement = (
            f"SELECT o.* FROM `{self._cb.bucket.name}`.`{scope_name}`.`{ORDER_COLLECTION}` o "
            "WHERE o.routes IS NOT MISSING "
            "AND o.destination IS NOT MISSING "
            "AND ARRAY_LENGTH(o.routes) > IFMISSINGORNULL(o.route_state, 0) + 1 "
            "ORDER BY o.createdAt ASC"
        )

        try:
            result = await self._cb.query(statement)
            rows = list(result)
        except CouchbaseException as e:
            print(f"Couchbase query failed while listing delivery-ready orders: {e}")
            return []

        orders: list[Order] = []
        for row in rows:
            try:
                order = Order.model_validate(row)
            except Exception:
                continue

            if self._is_ready_for_delivery_from_depot(order, depot):
                orders.append(order)

        return orders

    async def increment_route_state_for_consecutive_points(self, first: Point, second: Point) -> int:
        """Advance orders whose current/next route points match this pair."""
        scope_name = self._cb.scope.name if self._cb.scope else "default"
        statement = (
            f"SELECT o.* FROM `{self._cb.bucket.name}`.`{scope_name}`.`{ORDER_COLLECTION}` o "
            "WHERE o.routes IS NOT MISSING "
            "AND ARRAY_LENGTH(o.routes) > IFMISSINGORNULL(o.route_state, 0) + 1"
        )

        try:
            result = await self._cb.query(statement)
            rows = list(result)
        except CouchbaseException as e:
            print(f"Couchbase query failed while updating order route_state: {e}")
            return 0

        updated_count = 0
        now = datetime.now(timezone.utc)
        for row in rows:
            try:
                order = Order.model_validate(row)
            except Exception:
                continue

            if not order.routes:
                continue

            current_index = order.route_state or 0
            next_index = current_index + 1
            if current_index < 0 or next_index >= len(order.routes):
                continue

            current_point = order.routes[current_index]
            next_point = order.routes[next_index]
            is_forward_match = self._is_same_point(current_point, first) and self._is_same_point(next_point, second)
            is_reverse_match = self._is_same_point(current_point, second) and self._is_same_point(next_point, first)
            if not (is_forward_match or is_reverse_match):
                continue

            order.route_state = next_index
            order.updated_at = now
            await self._cb.upsert_document(_doc_id(order.id), order.to_dict(), ORDER_COLLECTION)
            updated_count += 1

        return updated_count

    async def apply_event(self, event: OrderEvent) -> OrderEvent:
        if event.event_type == OrderEventType.ORDER_CREATED:
            await self.create_order(event)
            return event

        existing = await self.get_order(event.order.id)
        if event.event_type == OrderEventType.ORDER_DELETED and existing is None:
            return event

        if existing is None:
            raise ValueError("Order not found")

        if event.event_type == OrderEventType.ORDER_UPDATED:
            event.order = self._merge_order_update(existing, event.order)

            # Apply side-effects for specific updates (e.g. PICKED_UP decrements pending load).
            await OrderCustomerWarehouseService(self._cb).handle_order_updated(event)

            await self._cb.upsert_document(
                _doc_id(event.order.id),
                event.order.to_dict(),
                ORDER_COLLECTION,
            )
            return event

        if event.event_type == OrderEventType.ORDER_DELETED:
            event.order.created_at = existing.created_at
            await self._cb.remove_document(_doc_id(event.order.id), ORDER_COLLECTION)
            return event

        raise ValueError(f"Unsupported order eventType: {event.event_type}")

    async def list_events(self, order_id: str, *, limit: int = 200, offset: int = 0) -> list[OrderEvent]:
        return await asyncio.to_thread(
            list_order_events_from_kafka,
            order_id,
            limit=limit,
            offset=offset,
        )
