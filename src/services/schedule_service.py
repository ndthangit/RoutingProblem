from __future__ import annotations

from datetime import  timezone
from typing import Optional

from couchbase.exceptions import CouchbaseException

from src.config.couchbase import CouchbaseClient
from src.models.routing import Schedule, ScheduleEvent, ScheduleEventType

SCHEDULE_COLLECTION = "schedule"
SCHEDULE_EVENT_COLLECTION = "schedule_event"


def _doc_id(schedule_id: str) -> str:
    # Schedule.id already defaults to template::<uuid>
    return schedule_id if schedule_id.startswith("template::") else f"template::{schedule_id}"


def _event_doc_id(schedule_id: str, event_id: str) -> str:
    return f"schedule_event::{schedule_id}::{event_id}"


class ScheduleService:
    def __init__(self, cb: CouchbaseClient):
        self._cb = cb

    async def _persist_event(self, event: ScheduleEvent) -> None:
        await self._cb.upsert_document(
            _event_doc_id(event.schedule.id, event.event_id),
            event.to_dict(),
            SCHEDULE_EVENT_COLLECTION,
        )

    async def create_schedule(self, event: ScheduleEvent) -> Schedule:
        if event.event_type != ScheduleEventType.SCHEDULE_CREATED:
            raise ValueError(
                f"Invalid eventType: expected {ScheduleEventType.SCHEDULE_CREATED}, got {event.event_type}"
            )

        # Normalize lastGeneratedAt if caller passes naive datetime
        if event.schedule.last_generated_at and event.schedule.last_generated_at.tzinfo is None:
            event.schedule.last_generated_at = event.schedule.last_generated_at.replace(tzinfo=timezone.utc)

        await self._cb.upsert_document(
            _doc_id(event.schedule.id),
            event.schedule.model_dump(mode="json", by_alias=True, exclude_none=True),
            SCHEDULE_COLLECTION,
        )
        await self._persist_event(event)
        return event.schedule

    async def get_schedule(self, schedule_id: str) -> Optional[Schedule]:
        doc = await self._cb.get_document(_doc_id(schedule_id), SCHEDULE_COLLECTION)
        if not doc:
            return None
        return Schedule.model_validate(doc)

    async def list_schedules(self, *, limit: int = 100, offset: int = 0) -> list[Schedule]:
        scope_name = self._cb.scope.name if self._cb.scope else "default"
        statement = (
            f"SELECT s.* FROM `{self._cb.bucket.name}`.`{scope_name}`.{SCHEDULE_COLLECTION} s "
            "ORDER BY s.id DESC "
            "LIMIT $limit OFFSET $offset"
        )

        try:
            result = await self._cb.query(statement, limit=limit, offset=offset)
            rows = list(result)
            return [Schedule.model_validate(row) for row in rows]
        except CouchbaseException:
            return []

    async def update_schedule(self, schedule_id: str, event: ScheduleEvent) -> Optional[Schedule]:
        existing = await self.get_schedule(schedule_id)
        if existing is None:
            return None

        if event.event_type != ScheduleEventType.SCHEDULE_UPDATED:
            raise ValueError(
                f"Invalid eventType: expected {ScheduleEventType.SCHEDULE_UPDATED}, got {event.event_type}"
            )

        event.schedule.id = _doc_id(schedule_id)

        if event.schedule.last_generated_at and event.schedule.last_generated_at.tzinfo is None:
            event.schedule.last_generated_at = event.schedule.last_generated_at.replace(tzinfo=timezone.utc)

        await self._cb.upsert_document(
            _doc_id(schedule_id),
            event.schedule.model_dump(mode="json", by_alias=True, exclude_none=True),
            SCHEDULE_COLLECTION,
        )
        await self._persist_event(event)
        return event.schedule

    async def delete_schedule(self, schedule_id: str, event: ScheduleEvent) -> bool:
        existing = await self.get_schedule(schedule_id)
        if existing is None:
            return False

        try:
            await self._cb.remove_document(_doc_id(schedule_id), SCHEDULE_COLLECTION)
            await self._persist_event(event)
            return True
        except CouchbaseException:
            return False

