from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from src.models.routing import (
	AddressRouteRequest,
	AddressRouteResponse,
	GeocodeRequest,
	GeocodeResponse,
	RouteRequest,
	RouteResponse,
)
from src.services.routing_service import OsrmError, RoutingService

router = APIRouter(prefix="/routing", tags=["routing"])


@router.post("/route", response_model=RouteResponse, status_code=status.HTTP_200_OK)
async def compute_route(payload: RouteRequest) -> RouteResponse:
	service = RoutingService()
	try:
		return await service.route(payload)
	except ValueError as e:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
	except OsrmError as e:
		raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))


@router.post("/geocode", response_model=GeocodeResponse, status_code=status.HTTP_200_OK)
async def geocode(payload: GeocodeRequest) -> GeocodeResponse:
	service = RoutingService()
	try:
		return await service.geocode_address_detail(payload.address)
	except ValueError as e:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
	except OsrmError as e:
		raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))


@router.post("/route-by-address", response_model=AddressRouteResponse, status_code=status.HTTP_200_OK)
async def compute_route_by_address(payload: AddressRouteRequest) -> AddressRouteResponse:
	service = RoutingService()
	try:
		return await service.route_by_address(payload)
	except ValueError as e:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
	except OsrmError as e:
		raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))

