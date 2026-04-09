from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status

from src.config.couchbase import CouchbaseClient
from src.dependencies import get_current_user
from src.models.routing import Schedule, ScheduleEvent, ScheduleEventType
from src.models.user import User
from src.services.schedule_service import ScheduleService

router = APIRouter(prefix="/schedules", tags=["schedules"])


def _get_service(request: Request) -> ScheduleService:
    cb: CouchbaseClient = getattr(request.app.state, "couchbase", None)
    if cb is None:
        raise RuntimeError("Couchbase client not available on app.state")
    return ScheduleService(cb)


@router.post("", response_model=Schedule, status_code=status.HTTP_201_CREATED)
async def create_schedule(
    payload: ScheduleEvent,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    service = _get_service(request)

    if payload.event_type != ScheduleEventType.SCHEDULE_CREATED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid eventType for create: expected {ScheduleEventType.SCHEDULE_CREATED}",
        )

    event = payload.model_copy(update={"owner_email": current_user.email})
    return await service.create_schedule(event)


@router.get("/{schedule_id}", response_model=Schedule)
async def get_schedule(schedule_id: str, request: Request):
    service = _get_service(request)
    schedule = await service.get_schedule(schedule_id)
    if schedule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found")
    return schedule


@router.get("", response_model=list[Schedule])
async def list_schedules(request: Request, limit: int = 100, offset: int = 0):
    service = _get_service(request)
    return await service.list_schedules(limit=limit, offset=offset)


@router.put("/{schedule_id}", response_model=Schedule)
async def update_schedule(
    schedule_id: str,
    payload: ScheduleEvent,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    service = _get_service(request)

    if payload.event_type != ScheduleEventType.SCHEDULE_UPDATED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid eventType for update: expected {ScheduleEventType.SCHEDULE_UPDATED}",
        )

    event = payload.model_copy(update={"owner_email": current_user.email})
    updated = await service.update_schedule(schedule_id, event)
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found")
    return updated


@router.delete("/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_schedule(
    schedule_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    service = _get_service(request)

    existing = await service.get_schedule(schedule_id)
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found")

    # Construct a minimal audit event for deletion.
    event = ScheduleEvent(
        eventType=ScheduleEventType.SCHEDULE_UPDATED,
        schedule=existing,
    ).model_copy(update={"owner_email": current_user.email})

    ok = await service.delete_schedule(schedule_id, event)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found")
    return None

