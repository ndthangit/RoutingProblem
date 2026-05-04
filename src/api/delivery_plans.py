from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from src.config.couchbase import CouchbaseClient
from src.dependencies import get_current_user
from src.models.plan import Plan
from src.models.routing import Point
from src.models.user import User
from src.services.brand_warehouse_service import BrandWarehouseService
from src.services.delivery_plan_service import DeliveryPlanService
from src.services.plan_service import PlanService
from src.services.route_service import RouteService
from src.services.vehicle_service import VehicleService

router = APIRouter(prefix="/delivery-plans", tags=["delivery-plans"])


class DeliveryPlanRequest(BaseModel):
    depot_id: str = Field(..., description="Brand warehouse used as start/end depot")
    vehicle_ids: list[str]
    delivery_points: list[Point] = Field(..., description="Buyer locations (destinations)")
    note: str | None = None


def _get_plan_service(request: Request) -> PlanService:
    cb: CouchbaseClient = getattr(request.app.state, "couchbase", None)
    if cb is None:
        raise RuntimeError("Couchbase client not available on app.state")
    return PlanService(cb)


def _get_route_service(request: Request) -> RouteService:
    cb: CouchbaseClient = getattr(request.app.state, "couchbase", None)
    if cb is None:
        raise RuntimeError("Couchbase client not available on app.state")
    return RouteService(cb)


def _get_delivery_plan_service(request: Request) -> DeliveryPlanService:
    cb: CouchbaseClient = getattr(request.app.state, "couchbase", None)
    if cb is None:
        raise RuntimeError("Couchbase client not available on app.state")
    plan_service = _get_plan_service(request)
    route_service = _get_route_service(request)
    return DeliveryPlanService(cb, plan_service, route_service)


def _get_vehicle_service(request: Request) -> VehicleService:
    cb: CouchbaseClient = getattr(request.app.state, "couchbase", None)
    if cb is None:
        raise RuntimeError("Couchbase client not available on app.state")
    return VehicleService(cb)


def _get_brand_warehouse_service(request: Request) -> BrandWarehouseService:
    cb: CouchbaseClient = getattr(request.app.state, "couchbase", None)
    if cb is None:
        raise RuntimeError("Couchbase client not available on app.state")
    return BrandWarehouseService(cb)


@router.post("", response_model=list[Plan], status_code=status.HTTP_201_CREATED)
async def create_delivery_plan(
    payload: DeliveryPlanRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    _ = current_user

    delivery_plan_service = _get_delivery_plan_service(request)
    vehicle_service = _get_vehicle_service(request)
    brand_warehouse_service = _get_brand_warehouse_service(request)

    depot = await brand_warehouse_service.get_warehouse(payload.depot_id)
    if not depot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Depot (brand warehouse) not found")

    vehicles = [await vehicle_service.get_vehicle(vid) for vid in payload.vehicle_ids]
    if not all(vehicles):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or more vehicles not found")

    # If caller forgets coordinates, we will still run (cost becomes 0); but it's better to validate.
    # Keep it permissive like PickupPlanService.
    try:
        plans = await delivery_plan_service.create_delivery_plan(
            depot=depot,
            vehicles=vehicles,
            delivery_points=payload.delivery_points,
            note=payload.note,
        )
        return plans
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

