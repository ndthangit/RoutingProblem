from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status

from src.config.couchbase import CouchbaseClient
from src.dependencies import get_current_user
from src.models.routing import Route, RouteEvent, RouteEventType
from src.models.user import User
from src.services.route_service import RouteService

router = APIRouter(prefix="/routes", tags=["routes"])


def _get_service(request: Request) -> RouteService:
    cb: CouchbaseClient = getattr(request.app.state, "couchbase", None)
    if cb is None:
        raise RuntimeError("Couchbase client not available on app.state")
    return RouteService(cb)


@router.post("", response_model=Route, status_code=status.HTTP_201_CREATED)
async def create_route(
    payload: RouteEvent,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    service = _get_service(request)

    # Ensure correct event type for create
    if payload.event_type != RouteEventType.ROUTE_STARTED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid eventType for create: expected {RouteEventType.ROUTE_STARTED}",
        )

    # keep owner like other modules if present on EventBase
    event = payload
    if hasattr(event, "owner_email"):
        event = payload.model_copy(update={"owner_email": current_user.email})

    return await service.create_route(event)


@router.get("/{route_id}", response_model=Route)
async def get_route(route_id: str, request: Request):
    service = _get_service(request)
    route = await service.get_route(route_id)
    if route is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Route not found")
    return route


@router.get("", response_model=list[Route])
async def list_routes(request: Request, limit: int = 100, offset: int = 0):
    service = _get_service(request)
    return await service.list_routes(limit=limit, offset=offset)


@router.put("/{route_id}", response_model=Route)
async def update_route(
    route_id: str,
    payload: RouteEvent,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    service = _get_service(request)

    event = payload
    if hasattr(event, "owner_email"):
        event = payload.model_copy(update={"owner_email": current_user.email})

    updated = await service.update_route(route_id, event)
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Route not found")
    return updated


@router.post("/{route_id}/end", response_model=Route)
async def end_route(
    route_id: str,
    payload: RouteEvent,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    service = _get_service(request)

    if payload.event_type != RouteEventType.ROUTE_ENDED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid eventType for end: expected {RouteEventType.ROUTE_ENDED}",
        )

    event = payload
    if hasattr(event, "owner_email"):
        event = payload.model_copy(update={"owner_email": current_user.email})

    ended = await service.end_route(route_id, event)
    if ended is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Route not found")
    return ended


@router.delete("/{route_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_route(
    route_id: str,
    payload: RouteEvent,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    service = _get_service(request)

    event = payload
    if hasattr(event, "owner_email"):
        event = payload.model_copy(update={"owner_email": current_user.email})

    ok = await service.delete_route(route_id, event)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Route not found")
    return None

