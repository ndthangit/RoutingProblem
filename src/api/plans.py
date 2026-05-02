from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status

from src.dependencies import get_current_user
from src.models.user import User
from src.models.plan import Plan, PlanEvent
from src.services.plan_service import PlanService
from src.config.couchbase import CouchbaseClient

router = APIRouter(prefix="/plans", tags=["plans"])


def _get_service(request: Request) -> PlanService:
    cb: CouchbaseClient = getattr(request.app.state, "couchbase", None)
    if cb is None:
        raise RuntimeError("Couchbase client not available on app.state")
    return PlanService(cb)


@router.post("", response_model=Plan, status_code=status.HTTP_201_CREATED)
async def create_plan(
    payload: PlanEvent,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    service = _get_service(request)

    event = payload.model_copy(update={"owner_email": current_user.email})

    try:
        service.validate_event_type_for_operation("create", event.event_type)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    try:
        return await service.create_plan(event)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{plan_id}", response_model=Plan)
async def get_plan(
    plan_id: str,
    request: Request,
):
    service = _get_service(request)
    plan = await service.get_plan(plan_id)
    if plan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")
    return plan


@router.get("", response_model=list[Plan])
async def list_plans(
    request: Request,
    limit: int = 100,
    offset: int = 0,
):
    service = _get_service(request)
    return await service.list_plans(limit=limit, offset=offset)


@router.put("/{plan_id}", response_model=Plan)
async def update_plan(
    plan_id: str,
    payload: PlanEvent,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    service = _get_service(request)

    event = payload.model_copy(update={"owner_email": current_user.email})

    try:
        service.validate_event_type_for_operation("update", event.event_type)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    try:
        updated = await service.update_plan(event)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")
    return updated


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_plan(
    plan_id: str,
    payload: PlanEvent,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    service = _get_service(request)

    event = payload.model_copy(update={"owner_email": current_user.email})

    try:
        service.validate_event_type_for_operation("delete", event.event_type)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    ok = await service.delete_plan(plan_id, event)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")
    return None
