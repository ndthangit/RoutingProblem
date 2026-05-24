from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from src.config.couchbase import CouchbaseClient
from src.dependencies import get_current_user
from src.models.driver import Driver, DriverType
from src.models.plan import InputPlan, Plan
from src.models.routing import Point
from src.models.user import User
from src.models.vehicle import Vehicle, VehicleStatus, VehicleType
from src.services.brand_warehouse_service import BrandWarehouseService
from src.services.delivery_plan_service import DeliveryPlanService
from src.services.driver_service import DriverService
from src.services.plan_service import PlanService
from src.services.route_service import RouteService

router = APIRouter(prefix="/delivery-plans", tags=["delivery-plans"])


class DeliveryPlanRequest(BaseModel):
    depot_id: str = Field(..., description="Brand warehouse used as start/end depot")
    driver_ids: list[str] = Field(..., description="Seasonal drivers assigned to this delivery plan")
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


def _get_driver_service(request: Request) -> DriverService:
    cb: CouchbaseClient = getattr(request.app.state, "couchbase", None)
    if cb is None:
        raise RuntimeError("Couchbase client not available on app.state")
    return DriverService(cb)


def _get_brand_warehouse_service(request: Request) -> BrandWarehouseService:
    cb: CouchbaseClient = getattr(request.app.state, "couchbase", None)
    if cb is None:
        raise RuntimeError("Couchbase client not available on app.state")
    return BrandWarehouseService(cb)


def _driver_to_delivery_resource(driver: Driver) -> Vehicle:
    """Delivery routing still expects vehicle-like resources; seasonal drivers are the resource."""
    return Vehicle(
        id=driver.id,
        licensePlate=driver.license_plate or driver.employee_code or driver.id,
        vehicleType=VehicleType.MOTORCYCLE,
        status=VehicleStatus.ACTIVE,
        driverId=driver.id,
        employeeCode=driver.employee_code,
        warehouseId=driver.warehouse_id,
        warehouseAddress=driver.warehouse_address,
    )


@router.post("", response_model=list[Plan], status_code=status.HTTP_201_CREATED)
async def create_delivery_plan(
    payload: DeliveryPlanRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    _ = current_user

    delivery_plan_service = _get_delivery_plan_service(request)
    driver_service = _get_driver_service(request)
    brand_warehouse_service = _get_brand_warehouse_service(request)

    depot = await brand_warehouse_service.get_warehouse(payload.depot_id)
    if not depot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Depot (brand warehouse) not found")

    if not payload.driver_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one driver is required")

    drivers = [await driver_service.get_driver(driver_id) for driver_id in payload.driver_ids]
    if not all(drivers):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or more drivers not found")

    invalid_drivers = [
        driver
        for driver in drivers
        if driver is not None
        and (
            driver.driver_type != DriverType.SEASONAL
            or driver.warehouse_id != payload.depot_id
            or driver.assigned_vehicle_id is not None
        )
    ]
    if invalid_drivers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more drivers are not seasonal drivers managed by the selected depot without vehicles",
        )

    vehicles = [_driver_to_delivery_resource(driver) for driver in drivers if driver is not None]

    # If caller forgets coordinates, we will still run (cost becomes 0); but it's better to validate.
    # Keep it permissive like PickupPlanService.
    try:
        input_plan = InputPlan(
            depot=depot,
            vehicles=vehicles,
            points=payload.delivery_points,
            demands=[0 for _ in payload.delivery_points],
            note=payload.note,
        )
        plans = await delivery_plan_service.create_delivery_plan(
            input_plan,
        )
        return plans
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

