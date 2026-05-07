from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status

from src.config.couchbase import CouchbaseClient
from src.dependencies import get_current_user
from src.models import DriverEventType
from src.models.driver import DriverEvent
from src.models.user import User
from src.services.driver_vehicle_service import DriverVehicleService

router = APIRouter(prefix="/driver-vehicle", tags=["driver-vehicle"])


def _get_service(request: Request) -> DriverVehicleService:
    cb: CouchbaseClient = getattr(request.app.state, "couchbase", None)
    if cb is None:
        raise RuntimeError("Couchbase client not available on app.state")
    return DriverVehicleService(cb)


@router.post("", response_model=DriverEvent, status_code=status.HTTP_201_CREATED)
async def post_event(
        payload: DriverEvent,
        request: Request,
        current_user: User = Depends(get_current_user),
):
    service = _get_service(request)

    # keep event snapshot but enforce ownerEmail from authenticated user
    event = payload.model_copy(update={"ownerEmail": current_user.email})

    try:
        if event.event_type == DriverEventType.DRIVER_VEHICLE_ASSIGNED:
            driver = await service.handle_driver_vehicle_assigned(event)
        elif event.event_type == DriverEventType.DRIVER_VEHICLE_UNASSIGNED:
            driver = await service.handle_driver_vehicle_unassigned(event)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported eventType: {event.event_type}",
            )

        if driver is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Driver not found")

        # Response model is DriverEvent, so wrap the updated driver back into an event.
        return DriverEvent(
            event_id=event.event_id,
            timestamp=event.timestamp,
            ownerEmail=event.owner_email,
            eventType=event.event_type,
            driver=driver,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


