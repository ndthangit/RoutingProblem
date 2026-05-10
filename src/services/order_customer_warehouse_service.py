from __future__ import annotations

from datetime import datetime, timezone

from src.config.couchbase import CouchbaseClient
from src.models.customer_warehouse import CustomerWarehouseEvent, CustomerWarehouseEventType
from src.models.order import Order, OrderEvent, OrderEventType, OrderStatus
from src.services.customer_warehouse_service import CustomerWarehouseService


ORDER_COLLECTION = "order"


def _order_doc_id(order_id: str) -> str:
	return f"order::{order_id}"


class OrderCustomerWarehouseService:
	"""Business side-effects between Order events and CustomerWarehouse aggregates.

	Current responsibility:
	- When an ORDER.UPDATED event sets status to ORDER.PICKED_UP, decrement
	  CustomerWarehouse.pending_weight and CustomerWarehouse.total_pending_orders
	  for the order.origin customer warehouse.
	"""

	def __init__(self, cb: CouchbaseClient):
		self._cb = cb

	@staticmethod
	def _safe_decrement(value: float | int | None, delta: float | int) -> float | int:
		base = 0 if value is None else value
		new_value = base - delta
		# Clamp at 0 to avoid negative pending numbers.
		return 0 if new_value < 0 else new_value

	async def handle_order_updated(self, event: OrderEvent) -> None:
		"""Handle ORDER.UPDATED events.

		Idempotency rule: only apply the decrement when the stored order snapshot
		is NOT already ORDER.PICKED_UP and the incoming event sets it to ORDER_PICKED_UP.
		"""

		if event.event_type != OrderEventType.ORDER_UPDATED:
			return

		incoming_status = Order.normalize_status(getattr(event.order, "status", None))
		if incoming_status != OrderStatus.ORDER_PICKED_UP:
			return

		# Require origin.id to know which customer warehouse to update.
		origin = getattr(event.order, "origin", None)
		origin_id = getattr(origin, "id", None)
		if not origin_id:
			return

		doc = await self._cb.get_document(_order_doc_id(event.order.id), ORDER_COLLECTION)
		existing = Order.model_validate(doc) if doc else None
		if existing is None:
			# Order history event for an order that doesn't exist - ignore.
			return

		existing_status = Order.normalize_status(getattr(existing, "status", None))
		if existing_status == OrderStatus.ORDER_PICKED_UP:
			# Already picked up - don't decrement twice.
			return

		cw_service = CustomerWarehouseService(self._cb)
		cw = await cw_service.get_customer_warehouse(origin_id)
		if cw is None:
			return

		updated_cw = cw.model_copy(deep=True)
		updated_cw.pending_weight = float(
			self._safe_decrement(updated_cw.pending_weight, float(event.order.package.weight_kg))
		)
		updated_cw.total_pending_orders = int(self._safe_decrement(updated_cw.total_pending_orders, 1))
		updated_cw.updated_at = datetime.now(timezone.utc)

		cw_event = CustomerWarehouseEvent(
			eventType=CustomerWarehouseEventType.LOAD_VOLUME_UPDATED,
			customerWarehouse=updated_cw,
			ownerEmail=event.owner_email,
		)
		await cw_service.update_customer_warehouse(cw_event)

		# Persist new order snapshot so later ORDER.UPDATED events are idempotent.
		# Keep immutable fields stable.
		new_order = event.order.model_copy(deep=True)
		new_order.id = existing.id
		new_order.created_at = existing.created_at
		await self._cb.upsert_document(
			_order_doc_id(existing.id),
			new_order.to_dict(),
			ORDER_COLLECTION,
		)

