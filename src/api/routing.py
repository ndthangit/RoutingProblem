from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from src.models.routing import RouteRequest, RouteResponse
from src.services.routing_service import OsrmError, RoutingService

router = APIRouter(prefix="/routing", tags=["routing"])


@router.post("/route", response_model=RouteResponse, status_code=status.HTTP_200_OK)
async def compute_route(payload: RouteRequest) -> RouteResponse:
	service = RoutingService()
	try:
		return await service.route(payload)
	except OsrmError as e:
		raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))

