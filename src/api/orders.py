from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status

from src.config.couchbase import CouchbaseClient
from src.dependencies import get_current_user
from src.models.order import Order, OrderEvent, OrderEventType
from src.models.producer import kafka_producer
from src.models.user import User
from src.services.order_service import OrderService

router = APIRouter(prefix="/orders", tags=["orders"])


def _get_service(request: Request) -> OrderService:
    cb: CouchbaseClient = getattr(request.app.state, "couchbase", None)
    if cb is None:
        raise RuntimeError("Couchbase client not available on app.state")
    return OrderService(cb)


@router.post("", response_model=Order, status_code=status.HTTP_202_ACCEPTED)
async def create_order(
    payload: OrderEvent,
    current_user: User = Depends(get_current_user),
):
    event = payload.model_copy(update={"owner_email": current_user.email})

    if event.event_type != OrderEventType.ORDER_CREATED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid eventType for create: {event.event_type}",
        )

    try:
        kafka_producer.send_order_event(event)
        return event.order
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except (RuntimeError, TimeoutError) as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Kafka publish failed: {e}",
        )


@router.get("/{order_id}", response_model=Order)
async def get_order(order_id: str, request: Request):
    service = _get_service(request)
    order = await service.get_order(order_id)
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return order


@router.get("", response_model=list[Order])
async def list_orders(request: Request, limit: int = 100, offset: int = 0):
    service = _get_service(request)
    return await service.list_orders(limit=limit, offset=offset)


@router.put("/{order_id}", response_model=Order, status_code=status.HTTP_202_ACCEPTED)
async def update_order(
    order_id: str,
    payload: Order,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    service = _get_service(request)

    existing = await service.get_order(order_id)
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    order = payload.model_copy(update={"id": order_id, "created_at": existing.created_at})
    event = OrderEvent(
        eventType=OrderEventType.ORDER_UPDATED,
        order=order,
        ownerEmail=current_user.email,
    )

    try:
        kafka_producer.send_order_event(event)
        return order
    except (RuntimeError, TimeoutError) as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Kafka publish failed: {e}",
        )


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_order(
    order_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    service = _get_service(request)

    existing = await service.get_order(order_id)
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    event = OrderEvent(
        eventType=OrderEventType.ORDER_DELETED,
        order=existing,
        ownerEmail=current_user.email,
    )

    try:
        kafka_producer.send_order_event(event)
    except (RuntimeError, TimeoutError) as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Kafka publish failed: {e}",
        )
    return None


@router.post("/{order_id}/events", response_model=OrderEvent, status_code=status.HTTP_202_ACCEPTED)
async def append_event(
    order_id: str,
    payload: OrderEvent,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    service = _get_service(request)

    event = payload.model_copy(update={"owner_email": current_user.email})
    event.order.id = order_id

    if event.event_type == OrderEventType.ORDER_CREATED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Use POST /orders for ORDER.CREATED events",
        )

    existing = await service.get_order(order_id)
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    try:
        kafka_producer.send_order_event(event)
        return event
    except (RuntimeError, TimeoutError) as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Kafka publish failed: {e}",
        )


@router.get("/{order_id}/events", response_model=list[OrderEvent])
async def list_events(
    order_id: str,
    request: Request,
    limit: int = 200,
    offset: int = 0,
):
    service = _get_service(request)
    return await service.list_events(order_id, limit=limit, offset=offset)
