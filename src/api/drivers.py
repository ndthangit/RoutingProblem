from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status

from src.config.couchbase import CouchbaseClient
from src.dependencies import get_current_user
from src.models.driver import Driver, DriverEvent
from src.models.user import User
from src.services.driver_service import DriverService

router = APIRouter(prefix="/drivers", tags=["drivers"])


def _get_service(request: Request) -> DriverService:
    cb: CouchbaseClient = getattr(request.app.state, "couchbase", None)
    if cb is None:
        raise RuntimeError("Couchbase client not available on app.state")
    return DriverService(cb)


@router.post("", response_model=Driver, status_code=status.HTTP_201_CREATED)
async def create_driver(
    payload: DriverEvent,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    service = _get_service(request)

    event = payload.model_copy(update={"owner_email": current_user.email})

    try:
        service.validate_event_type_for_operation("create", event.event_type)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return await service.create_driver(event)


@router.get("/{driver_id}", response_model=Driver)
async def get_driver(driver_id: str, request: Request):
    service = _get_service(request)
    driver = await service.get_driver(driver_id)
    if driver is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Driver not found")
    return driver


@router.get("", response_model=list[Driver])
async def list_drivers(request: Request, limit: int = 100, offset: int = 0):
    service = _get_service(request)
    return await service.list_drivers(limit=limit, offset=offset)


@router.put("/{driver_id}", response_model=Driver)
async def update_driver(
    driver_id: str,
    payload: DriverEvent,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    service = _get_service(request)

    event = payload.model_copy(update={"owner_email": current_user.email})
    # trust path param for driver id
    event.driver.id = driver_id

    try:
        service.validate_event_type_for_operation("update", event.event_type)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    updated = await service.update_driver(event)
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Driver not found")
    return updated


@router.delete("/{driver_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_driver(
    driver_id: str,
    payload: DriverEvent,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    service = _get_service(request)

    event = payload.model_copy(update={"owner_email": current_user.email})

    try:
        service.validate_event_type_for_operation("delete", event.event_type)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    ok = await service.delete_driver(driver_id, event)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Driver not found")
    return None

