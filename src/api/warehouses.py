from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status

from src.config.couchbase import CouchbaseClient
from src.dependencies import get_current_user
from src.models.user import User
from src.models.warehouse import Warehouse, WarehouseEvent
from src.services.warehouse_service import WarehouseService

router = APIRouter(prefix="/warehouses", tags=["warehouses"])


def _get_service(request: Request) -> WarehouseService:
    cb: CouchbaseClient = getattr(request.app.state, "couchbase", None)
    if cb is None:
        raise RuntimeError("Couchbase client not available on app.state")
    return WarehouseService(cb)


@router.post("", response_model=Warehouse, status_code=status.HTTP_201_CREATED)
async def create_warehouse(
    payload: WarehouseEvent,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    service = _get_service(request)

    event = payload.model_copy(update={"owner_email": current_user.email})

    try:
        service.validate_event_type_for_operation("create", event.event_type)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return await service.create_warehouse(event)


@router.get("/{warehouse_id}", response_model=Warehouse)
async def get_warehouse(warehouse_id: str, request: Request):
    service = _get_service(request)
    warehouse = await service.get_warehouse(warehouse_id)
    if warehouse is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")
    return warehouse


@router.get("", response_model=list[Warehouse])
async def list_warehouses(request: Request, limit: int = 100, offset: int = 0):
    service = _get_service(request)
    return await service.list_warehouses(limit=limit, offset=offset)


@router.put("/{warehouse_id}", response_model=Warehouse)
async def update_warehouse(
    warehouse_id: str,
    payload: WarehouseEvent,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    service = _get_service(request)

    event = payload.model_copy(update={"owner_email": current_user.email})
    event.warehouse.id = warehouse_id

    try:
        service.validate_event_type_for_operation("update", event.event_type)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    updated = await service.update_warehouse(event)
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")
    return updated


@router.delete("/{warehouse_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_warehouse(
    warehouse_id: str,
    payload: WarehouseEvent,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    service = _get_service(request)

    event = payload.model_copy(update={"owner_email": current_user.email})

    try:
        service.validate_event_type_for_operation("delete", event.event_type)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    ok = await service.delete_warehouse(warehouse_id, event)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")
    return None
