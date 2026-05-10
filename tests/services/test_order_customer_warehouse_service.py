import uuid
from unittest.mock import AsyncMock

import pytest

from src.models.customer_warehouse import CustomerWarehouse
from src.models.order import Order, OrderEvent, OrderEventType, OrderStatus, PackageDetails
from src.models.routing import Coordinate, Point
from src.services.customer_warehouse_service import (
    CUSTOMER_HOUSE_COLLECTION,
    CUSTOMER_HOUSE_EVENT_COLLECTION,
)
from src.services.order_service import ORDER_COLLECTION, ORDER_EVENT_COLLECTION, OrderService


@pytest.mark.asyncio
async def test_append_order_updated_picked_up_decrements_customer_warehouse_pending_metrics():
    cb = AsyncMock()

    # Seed existing order snapshot (status not picked up yet)
    order_id = str(uuid.uuid4())
    origin_id = str(uuid.uuid4())
    weight = 12.5

    existing_order = Order(
        id=order_id,
        senderName="S",
        receiverName="R",
        origin=Point(id=origin_id, address="A", coordinate=Coordinate(lat=10.0, lon=106.0)),
        destination=Point(address="B", coordinate=Coordinate(lat=11.0, lon=107.0)),
        package=PackageDetails(description="Box", weightKg=weight),
        status=OrderStatus.ORDER_CREATED,
    )

    # Seed existing customer warehouse with pending load
    cw = CustomerWarehouse(
        id=origin_id,
        address="A",
        coordinate=Coordinate(lat=10.0, lon=106.0),
        representativeName="Rep",
        contactPhone="000",
        pendingWeight=weight,
        totalPendingOrders=1,
    )

    async def get_document_side_effect(doc_id: str, collection: str):
        if collection == ORDER_COLLECTION:
            return existing_order.to_dict()
        if collection == CUSTOMER_HOUSE_COLLECTION:
            return cw.to_dict()
        return None

    cb.get_document = AsyncMock(side_effect=get_document_side_effect)
    cb.upsert_document = AsyncMock(return_value=None)

    event = OrderEvent(
        eventType=OrderEventType.ORDER_UPDATED,
        ownerEmail="owner@example.com",
        order=existing_order.model_copy(deep=True, update={"status": OrderStatus.ORDER_PICKED_UP}),
    )

    service = OrderService(cb)
    await service.append_event(event)

    # 1) Order event persisted
    assert any(call.args[2] == ORDER_EVENT_COLLECTION for call in cb.upsert_document.call_args_list)

    # 2) Customer warehouse updated with decremented values
    cw_updates = [
        call for call in cb.upsert_document.call_args_list if call.args[2] == CUSTOMER_HOUSE_COLLECTION
    ]
    assert len(cw_updates) == 1
    updated_cw_doc = cw_updates[0].args[1]
    assert updated_cw_doc["pendingWeight"] == 0.0
    assert updated_cw_doc["totalPendingOrders"] == 0

    # 3) Customer warehouse event persisted
    assert any(call.args[2] == CUSTOMER_HOUSE_EVENT_COLLECTION for call in cb.upsert_document.call_args_list)

    # 4) Order snapshot updated to PICKED_UP
    order_updates = [call for call in cb.upsert_document.call_args_list if call.args[2] == ORDER_COLLECTION]
    assert len(order_updates) == 1
    assert order_updates[0].args[1]["status"] == OrderStatus.ORDER_PICKED_UP.value


@pytest.mark.asyncio
async def test_append_order_updated_picked_up_is_idempotent_when_order_already_picked_up():
    cb = AsyncMock()

    order_id = str(uuid.uuid4())
    origin_id = str(uuid.uuid4())

    existing_order = Order(
        id=order_id,
        senderName="S",
        receiverName="R",
        origin=Point(id=origin_id, address="A", coordinate=Coordinate(lat=10.0, lon=106.0)),
        destination=Point(address="B", coordinate=Coordinate(lat=11.0, lon=107.0)),
        package=PackageDetails(description="Box", weightKg=5.0),
        status=OrderStatus.ORDER_PICKED_UP,
    )

    # Warehouse has some pending numbers, but handler shouldn't touch because existing order already PICKED_UP
    cw = CustomerWarehouse(
        id=origin_id,
        address="A",
        coordinate=Coordinate(lat=10.0, lon=106.0),
        representativeName="Rep",
        contactPhone="000",
        pendingWeight=10.0,
        totalPendingOrders=2,
    )

    async def get_document_side_effect(doc_id: str, collection: str):
        if collection == ORDER_COLLECTION:
            return existing_order.to_dict()
        if collection == CUSTOMER_HOUSE_COLLECTION:
            return cw.to_dict()
        return None

    cb.get_document = AsyncMock(side_effect=get_document_side_effect)
    cb.upsert_document = AsyncMock(return_value=None)

    event = OrderEvent(
        eventType=OrderEventType.ORDER_UPDATED,
        ownerEmail="owner@example.com",
        order=existing_order.model_copy(deep=True),
    )

    service = OrderService(cb)
    await service.append_event(event)

    # Only persist order_event; no cw updates/events and no order snapshot update.
    assert any(call.args[2] == ORDER_EVENT_COLLECTION for call in cb.upsert_document.call_args_list)
    assert not any(call.args[2] == CUSTOMER_HOUSE_COLLECTION for call in cb.upsert_document.call_args_list)
    assert not any(call.args[2] == CUSTOMER_HOUSE_EVENT_COLLECTION for call in cb.upsert_document.call_args_list)
    assert not any(call.args[2] == ORDER_COLLECTION for call in cb.upsert_document.call_args_list)


