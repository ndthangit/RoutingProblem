from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from couchbase.exceptions import CouchbaseException

from src.config.couchbase import CouchbaseClient
from src.models.plan import Plan, PlanEvent, PlanEventType

PLAN_COLLECTION = "plan"
PLAN_EVENT_COLLECTION = "plan_event"


def _doc_id(plan_id: str) -> str:
    return f"plan::{plan_id}"


def _event_doc_id(plan_id: str, event_id: str) -> str:
    return f"plan_event::{plan_id}::{event_id}"


class PlanService:
    def __init__(self, cb: CouchbaseClient):
        self._cb = cb

    async def _persist_event(self, event: PlanEvent) -> None:
        await self._cb.upsert_document(
            _event_doc_id(event.plan.id, event.event_id),
            event.to_dict(),
            PLAN_EVENT_COLLECTION,
        )

    async def create_plan(self, event: PlanEvent) -> Plan:
        if event.event_type != PlanEventType.PLAN_CREATED:
            raise ValueError(f"Invalid eventType: expected {PlanEventType.PLAN_CREATED}, got {event.event_type}")

        now = datetime.now(timezone.utc)
        if event.plan.created_at is None:
            event.plan.created_at = now
        event.plan.updated_at = now

        await self._cb.upsert_document(_doc_id(event.plan.id), event.plan.to_dict(), PLAN_COLLECTION)
        await self._persist_event(event)
        return event.plan

    async def get_plan(self, plan_id: str) -> Optional[Plan]:
        doc = await self._cb.get_document(_doc_id(plan_id), PLAN_COLLECTION)
        if not doc:
            return None
        return Plan.model_validate(doc)

    async def list_plans(self, *, limit: int = 100, offset: int = 0) -> list[Plan]:
        scope_name = self._cb.scope.name if self._cb.scope else "default"
        statement = (
            f"SELECT p.* FROM `{self._cb.bucket.name}`.`{scope_name}`.{PLAN_COLLECTION} p "
            "ORDER BY p.updatedAt DESC "
            "LIMIT $limit OFFSET $offset"
        )

        try:
            result = await self._cb.query(statement, limit=limit, offset=offset)
            rows = list(result)
            return [Plan.model_validate(row) for row in rows]
        except CouchbaseException as e:
            print(f"Couchbase query failed: {e}")
            return []

    async def update_plan(self, event: PlanEvent) -> Optional[Plan]:
        existing = await self.get_plan(event.plan.id)
        if existing is None:
            return None

        event.plan.created_at = existing.created_at
        event.plan.updated_at = datetime.now(timezone.utc)

        await self._cb.upsert_document(_doc_id(event.plan.id), event.plan.to_dict(), PLAN_COLLECTION)
        await self._persist_event(event)
        return event.plan

    async def delete_plan(self, plan_id: str, event: PlanEvent) -> bool:
        existing = await self.get_plan(plan_id)
        if existing is None:
            return False

        event.plan.id = plan_id
        event.plan.created_at = existing.created_at
        event.plan.updated_at = datetime.now(timezone.utc)

        try:
            await self._cb.remove_document(_doc_id(plan_id), PLAN_COLLECTION)
            await self._persist_event(event)
            return True
        except CouchbaseException:
            return False

    @staticmethod
    def validate_event_type_for_operation(operation: str, event_type: PlanEventType) -> None:
        mapping = {
            "create": PlanEventType.PLAN_CREATED,
            "update": PlanEventType.PLAN_UPDATED,
            "delete": PlanEventType.PLAN_DELETED,
        }
        expected = mapping.get(operation)
        if expected is not None and event_type != expected:
            raise ValueError(f"Invalid eventType for {operation}: expected {expected}, got {event_type}")
