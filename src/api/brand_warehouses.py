from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from src.config.couchbase import CouchbaseClient
from src.dependencies import get_current_user
from src.models.user import User
from src.models.brand_warehouse import BrandWarehouse, WarehouseEvent
from src.services.brand_warehouse_service import BrandWarehouseService

router = APIRouter(prefix="/brand-warehouses", tags=["brand-warehouses"])


def _get_service(request: Request) -> BrandWarehouseService:
    cb: CouchbaseClient = getattr(request.app.state, "couchbase", None)
    if cb is None:
        raise RuntimeError("Couchbase client not available on app.state")
    return BrandWarehouseService(cb)


@router.post("", response_model=BrandWarehouse, status_code=status.HTTP_201_CREATED)
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


@router.get("/geo", response_model=list[BrandWarehouse])
async def list_warehouses_geo(
    request: Request,
    min_lat: float = Query(..., alias="minLat"),
    min_lon: float = Query(..., alias="minLon"),
    max_lat: float = Query(..., alias="maxLat"),
    max_lon: float = Query(..., alias="maxLon"),
    limit: int = 5000,
):
    """Return warehouses inside a bounding box.

    Note: This route MUST be defined before `/{warehouse_id}` otherwise the
    string "geo" would be captured as a warehouse_id and you get 404.

    Query params keep backwards compatibility with camelCase names.
    """

    # Basic bounds validation
    if min_lat > max_lat or min_lon > max_lon:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid bbox")

    service = _get_service(request)
    return await service.list_warehouses_in_bbox(
        min_lat=min_lat,
        min_lon=min_lon,
        max_lat=max_lat,
        max_lon=max_lon,
        limit=limit,
    )


@router.get("/{warehouse_id}", response_model=BrandWarehouse)
async def get_warehouse(warehouse_id: str, request: Request):
    service = _get_service(request)
    warehouse = await service.get_warehouse(warehouse_id)
    if warehouse is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")
    return warehouse


@router.get("", response_model=list[BrandWarehouse])
async def list_warehouses(request: Request, limit: int = 100, offset: int = 0):
    service = _get_service(request)
    return await service.list_warehouses(limit=limit, offset=offset)




@router.put("/{warehouse_id}", response_model=BrandWarehouse)
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
