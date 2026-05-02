from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from src.dependencies import get_current_user
from src.models.user import User
from src.models.plan import Plan
from src.services.pickup_plan_service import PickupPlanService
from src.services.plan_service import PlanService
from src.services.vehicle_service import VehicleService
from src.services.customer_warehouse_service import CustomerWarehouseService
from src.config.couchbase import CouchbaseClient

router = APIRouter(prefix="/pickup-plans", tags=["pickup-plans"])


class PickupPlanRequest(BaseModel):
    depot_id: str
    vehicle_ids: list[str]
    customer_warehouse_ids: list[str]


def _get_plan_service(request: Request) -> PlanService:
    cb: CouchbaseClient = getattr(request.app.state, "couchbase", None)
    if cb is None:
        raise RuntimeError("Couchbase client not available on app.state")
    return PlanService(cb)


def _get_pickup_plan_service(request: Request) -> PickupPlanService:
    cb: CouchbaseClient = getattr(request.app.state, "couchbase", None)
    if cb is None:
        raise RuntimeError("Couchbase client not available on app.state")
    plan_service = _get_plan_service(request)
    return PickupPlanService(cb, plan_service)


def _get_vehicle_service(request: Request) -> VehicleService:
    cb: CouchbaseClient = getattr(request.app.state, "couchbase", None)
    if cb is None:
        raise RuntimeError("Couchbase client not available on app.state")
    return VehicleService(cb)


def _get_customer_warehouse_service(request: Request) -> CustomerWarehouseService:
    cb: CouchbaseClient = getattr(request.app.state, "couchbase", None)
    if cb is None:
        raise RuntimeError("Couchbase client not available on app.state")
    return CustomerWarehouseService(cb)


@router.post("", response_model=list[Plan], status_code=status.HTTP_201_CREATED)
async def create_pickup_plan(
    payload: PickupPlanRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    # pickup_plan_service = _get_pickup_plan_service(request)
    # vehicle_service = _get_vehicle_service(request)
    # customer_warehouse_service = _get_customer_warehouse_service(request)
    #
    # depot = await customer_warehouse_service.get_customer_warehouse(
    #     payload.depot_id)
    # if not depot:
    #     raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Depot not found")
    #
    # vehicles = [await vehicle_service.get_vehicle(vid) for vid in payload.vehicle_ids]
    # if not all(vehicles):
    #     raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or more vehicles not found")
    #
    # customer_warehouses = [await customer_warehouse_service.get_customer_warehouse(wid) for wid in payload.customer_warehouse_ids]
    # if not all(customer_warehouses):
    #     raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or more customer warehouses not found")
    #
    # try:
    #     plans = await pickup_plan_service.create_pickup_plan(
    #         depot=depot,
    #         vehicles=vehicles,
    #         customer_warehouses=customer_warehouses,
    #         owner_email=current_user.email,
    #     )
    #     return plans
    # except Exception as e:
    #     raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    print(payload)
    return []