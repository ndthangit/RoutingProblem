from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, status

from src.config.couchbase import CouchbaseClient
from src.models.order import Order
from src.services.order_service import OrderService

# Public endpoints (no auth middleware via exclude_patterns)
router = APIRouter(prefix="/public/orders", tags=["public-orders"])


def _get_service(request: Request) -> OrderService:
    cb: CouchbaseClient = getattr(request.app.state, "couchbase", None)
    if cb is None:
        raise RuntimeError("Couchbase client not available on app.state")
    return OrderService(cb)


@router.get("/{order_id}", response_model=Order)
async def public_get_order(order_id: str, request: Request):
    """Public order lookup for end-users (tracking).

    NOTE: This endpoint is intentionally public. Do not return sensitive fields here.
    Currently Order schema contains only operational fields; if you add PII later,
    create a dedicated public DTO and return only safe fields.
    """

    service = _get_service(request)
    order = await service.get_order(order_id)
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return order

