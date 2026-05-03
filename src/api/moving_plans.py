from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from src.config.couchbase import CouchbaseClient
from src.dependencies import get_current_user
from src.models.brand_warehouse import BrandWarehouse
from src.models.plan import Plan
from src.models.user import User
from src.services.brand_warehouse_service import BrandWarehouseService
from src.services.moving_plan_service import MovingPlanService
from src.services.plan_service import PlanService
from src.services.route_service import RouteService
from src.services.vehicle_service import VehicleService

router = APIRouter(prefix="/moving-plans", tags=["moving-plans"])


class MovingPlanRequest(BaseModel):
	depot_id: str = Field(..., description="Brand warehouse used as start/end depot")
	vehicle_ids: list[str]
	brand_warehouse_ids: list[str] = Field(..., description="Brand warehouses to be visited")
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


def _get_moving_plan_service(request: Request) -> MovingPlanService:
	cb: CouchbaseClient = getattr(request.app.state, "couchbase", None)
	if cb is None:
		raise RuntimeError("Couchbase client not available on app.state")
	plan_service = _get_plan_service(request)
	route_service = _get_route_service(request)
	return MovingPlanService(cb, plan_service, route_service)


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
async def create_moving_plan(
	payload: MovingPlanRequest,
	request: Request,
	current_user: User = Depends(get_current_user),
):
	moving_plan_service = _get_moving_plan_service(request)
	vehicle_service = _get_vehicle_service(request)
	brand_warehouse_service = _get_brand_warehouse_service(request)

	depot: BrandWarehouse | None = await brand_warehouse_service.get_warehouse(payload.depot_id)
	if not depot:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Depot (brand warehouse) not found")

	vehicles = [await vehicle_service.get_vehicle(vid) for vid in payload.vehicle_ids]
	if not all(vehicles):
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or more vehicles not found")

	bws = [await brand_warehouse_service.get_warehouse(wid) for wid in payload.brand_warehouse_ids]
	if not all(bws):
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or more brand warehouses not found")

	try:
		return await moving_plan_service.create_moving_plan(
			depot=depot,
			vehicles=vehicles,
			brand_warehouses=bws,
			note=payload.note,
		)
	except Exception as e:
		raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

