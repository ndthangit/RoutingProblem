from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status

from src.config.couchbase import CouchbaseClient
from src.dependencies import get_current_user
from src.models.order import Order, OrderEvent
from src.models.user import User
from src.services.order_service import OrderService

router = APIRouter(prefix="/orders", tags=["orders"])


def _get_service(request: Request) -> OrderService:
    cb: CouchbaseClient = getattr(request.app.state, "couchbase", None)
    if cb is None:
        raise RuntimeError("Couchbase client not available on app.state")
    return OrderService(cb)


@router.post("", response_model=Order, status_code=status.HTTP_201_CREATED)
async def create_order(
    payload: OrderEvent,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    service = _get_service(request)
    event = payload.model_copy(update={"owner_email": current_user.email})
    try:
        return await service.create_order(event)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


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


@router.put("/{order_id}", response_model=Order)
async def update_order(
    order_id: str,
    payload: Order,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    service = _get_service(request)

    _ = current_user
    updated = await service.update_order(order_id, payload)
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return updated


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_order(
    order_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    service = _get_service(request)

    _ = current_user
    ok = await service.delete_order(order_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return None


@router.post("/{order_id}/events", response_model=OrderEvent, status_code=status.HTTP_201_CREATED)
async def append_event(
    order_id: str,
    payload: OrderEvent,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    service = _get_service(request)

    event = payload.model_copy(update={"owner_email": current_user.email})
    event.order.id = order_id

    try:
        return await service.append_event(event)
    except ValueError as e:
        msg = str(e)
        if msg.lower() == "order not found":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)


@router.get("/{order_id}/events", response_model=list[OrderEvent])
async def list_events(
    order_id: str,
    request: Request,
    limit: int = 200,
    offset: int = 0,
):
    service = _get_service(request)
    return await service.list_events(order_id, limit=limit, offset=offset)
