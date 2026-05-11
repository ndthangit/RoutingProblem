from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from src.config.couchbase import CouchbaseClient
from src.dependencies import get_current_user
from src.models.customer_warehouse import CustomerWarehouse, CustomerWarehouseEvent
from src.models.user import User
from src.services.customer_warehouse_service import CustomerWarehouseService

router = APIRouter(prefix="/customer-warehouses", tags=["customer-warehouses"])


def _get_service(request: Request) -> CustomerWarehouseService:
    cb: CouchbaseClient = getattr(request.app.state, "couchbase", None)
    if cb is None:
        raise RuntimeError("Couchbase client not available on app.state")
    return CustomerWarehouseService(cb)


@router.post("", response_model=CustomerWarehouse, status_code=status.HTTP_201_CREATED)
async def create_customer_house(
    payload: CustomerWarehouseEvent,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    service = _get_service(request)

    event = payload.model_copy(update={"owner_email": current_user.email})

    try:
        service.validate_event_type_for_operation("create", event.event_type)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return await service.create_customer_warehouse(event)


@router.get("/me", response_model=CustomerWarehouse)
async def get_my_customer_house(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    service = _get_service(request)
    customer_house = await service.get_customer_warehouse_by_owner_email(current_user.email)
    if customer_house is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer house not found")
    return customer_house


@router.get("/{customer_house_id}", response_model=CustomerWarehouse)
async def get_customer_house(customer_house_id: str, request: Request):
    service = _get_service(request)
    customer_house = await service.get_customer_warehouse(customer_house_id)
    if customer_house is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer house not found")
    return customer_house


@router.get("", response_model=list[CustomerWarehouse])
async def list_customer_houses(
    request: Request,
    limit: int = 100,
    offset: int = 0,
    owner_email: str | None = Query(default=None, alias="ownerEmail"),
):
    service = _get_service(request)
    if owner_email:
        cw = await service.get_customer_warehouse_by_owner_email(owner_email)
        return [cw] if cw else []
    return await service.list_customer_warehouses(limit=limit, offset=offset)


@router.put("/{customer_house_id}", response_model=CustomerWarehouse)
async def update_customer_house(
    customer_house_id: str,
    payload: CustomerWarehouseEvent,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    service = _get_service(request)

    event = payload.model_copy(update={"owner_email": current_user.email})
    event.customer_warehouse.id = customer_house_id

    try:
        service.validate_event_type_for_operation("update", event.event_type)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    updated = await service.update_customer_warehouse(event)
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer house not found")
    return updated


@router.delete("/{customer_house_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer_house(
    customer_house_id: str,
    payload: CustomerWarehouseEvent,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    service = _get_service(request)

    event = payload.model_copy(update={"owner_email": current_user.email})

    try:
        service.validate_event_type_for_operation("delete", event.event_type)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    ok = await service.delete_customer_warehouse(customer_house_id, event)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer house not found")
    return None

