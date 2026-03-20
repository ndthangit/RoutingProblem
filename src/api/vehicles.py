from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status

from src.dependencies import get_current_user
from src.models.user import User
from src.models.vehicle import Vehicle, VehicleCreate, VehicleUpdate
from src.services.vehicle_service import VehicleService
from src.config.couchbase import CouchbaseClient

router = APIRouter(prefix="/vehicles", tags=["vehicles"])


def _get_service(request: Request) -> VehicleService:
    cb: CouchbaseClient = getattr(request.app.state, "couchbase", None)
    if cb is None:
        raise RuntimeError("Couchbase client not available on app.state")
    return VehicleService(cb)


@router.post("", response_model=Vehicle, status_code=status.HTTP_201_CREATED)
async def create_vehicle(
    payload: VehicleCreate,
    request: Request,
    _: User = Depends(get_current_user),
):
    service = _get_service(request)
    return await service.create_vehicle(payload)


@router.get("/{vehicle_id}", response_model=Vehicle)
async def get_vehicle(
    vehicle_id: str,
    request: Request,
    _: User = Depends(get_current_user),
):
    service = _get_service(request)
    vehicle = await service.get_vehicle(vehicle_id)
    if vehicle is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")
    return vehicle


@router.get("", response_model=list[Vehicle])
async def list_vehicles(
    request: Request,
    limit: int = 100,
    offset: int = 0,
    _: User = Depends(get_current_user),
):
    service = _get_service(request)
    return await service.list_vehicles(limit=limit, offset=offset)


@router.put("/{vehicle_id}", response_model=Vehicle)
async def update_vehicle(
    vehicle_id: str,
    patch: VehicleUpdate,
    request: Request,
    _: User = Depends(get_current_user),
):
    service = _get_service(request)
    updated = await service.update_vehicle(vehicle_id, patch)
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")
    return updated


@router.delete("/{vehicle_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vehicle(
    vehicle_id: str,
    request: Request,
    _: User = Depends(get_current_user),
):
    service = _get_service(request)
    ok = await service.delete_vehicle(vehicle_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")
    return None
