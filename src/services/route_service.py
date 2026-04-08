from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from couchbase.exceptions import CouchbaseException

from src.config.couchbase import CouchbaseClient
from src.models.routing import Route, RouteEvent, RouteEventType
from src.services.routing_service import RoutingService

ROUTE_COLLECTION = "route"
ROUTE_EVENT_COLLECTION = "route_event"


def _doc_id(route_id: str) -> str:
    return f"route::{route_id}"


def _event_doc_id(route_id: str, event_id: str) -> str:
    return f"route_event::{route_id}::{event_id}"


class RouteService:
    def __init__(self, cb: CouchbaseClient):
        self._cb = cb

    async def _persist_event(self, event: RouteEvent) -> None:
        await self._cb.upsert_document(
            _event_doc_id(event.route.id, event.event_id),
            event.to_dict(),
            ROUTE_EVENT_COLLECTION,
        )

    async def create_route(self, event: RouteEvent) -> Route:
        if event.event_type != RouteEventType.ROUTE_STARTED:
            raise ValueError(
                f"Invalid eventType: expected {RouteEventType.ROUTE_STARTED}, got {event.event_type}"
            )

        # start time should reflect when the route starts moving
        if event.route.start_time is None:
            # EventBase.timestamp is timezone-aware; fall back to now if needed
            event.route.start_time = getattr(event, "timestamp", None) or datetime.now(timezone.utc)

        # Enrich coordinates from addresses if not provided by client
        if event.route.origin_coordinate is None:
            event.route.origin_coordinate = await RoutingService().geocode_address(event.route.origin)
        if event.route.destination_coordinate is None:
            event.route.destination_coordinate = await RoutingService().geocode_address(event.route.destination)

        await self._cb.upsert_document(
            _doc_id(event.route.id),
            event.route.model_dump(mode="json", by_alias=True, exclude_none=True),
            ROUTE_COLLECTION,
        )
        await self._persist_event(event)
        return event.route

    async def get_route(self, route_id: str) -> Optional[Route]:
        doc = await self._cb.get_document(_doc_id(route_id), ROUTE_COLLECTION)
        if not doc:
            return None
        return Route.model_validate(doc)

    async def list_routes(self, *, limit: int = 100, offset: int = 0) -> list[Route]:
        scope_name = self._cb.scope.name if self._cb.scope else "default"
        statement = (
            f"SELECT r.* FROM `{self._cb.bucket.name}`.`{scope_name}`.{ROUTE_COLLECTION} r "
            "ORDER BY r.id DESC "
            "LIMIT $limit OFFSET $offset"
        )

        try:
            result = await self._cb.query(statement, limit=limit, offset=offset)
            rows = list(result)
            return [Route.model_validate(row) for row in rows]
        except CouchbaseException:
            return []

    async def update_route(self, route_id: str, event: RouteEvent) -> Optional[Route]:
        existing = await self.get_route(route_id)
        if existing is None:
            return None

        # Force correct id
        event.route.id = route_id

        # Preserve original start_time unless explicitly provided
        if event.route.start_time is None:
            event.route.start_time = existing.start_time

        # If coordinates are missing, try to enrich from addresses
        if event.route.origin_coordinate is None:
            event.route.origin_coordinate = await RoutingService().geocode_address(event.route.origin)
        if event.route.destination_coordinate is None:
            event.route.destination_coordinate = await RoutingService().geocode_address(event.route.destination)

        await self._cb.upsert_document(
            _doc_id(route_id),
            event.route.model_dump(mode="json", by_alias=True, exclude_none=True),
            ROUTE_COLLECTION,
        )
        await self._persist_event(event)
        return event.route

    async def end_route(self, route_id: str, event: RouteEvent) -> Optional[Route]:
        # semantic sugar; treat as update + ROUTE_ENDED
        if event.event_type != RouteEventType.ROUTE_ENDED:
            raise ValueError(
                f"Invalid eventType: expected {RouteEventType.ROUTE_ENDED}, got {event.event_type}"
            )
        return await self.update_route(route_id, event)

    async def delete_route(self, route_id: str, event: RouteEvent) -> bool:
        existing = await self.get_route(route_id)
        if existing is None:
            return False

        # Ensure event targets correct route
        event.route = existing

        try:
            await self._cb.remove_document(_doc_id(route_id), ROUTE_COLLECTION)
            await self._persist_event(event)
            return True
        except CouchbaseException:
            return False
