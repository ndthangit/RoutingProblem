from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import uuid4

from couchbase.exceptions import CouchbaseException

from src.config.couchbase import CouchbaseClient
from src.models.routing import (
	Route,
	RouteEvent,
	RouteEventType,
	RouteType,
	Schedule,
	ScheduleType,
)
from src.services.route_service import RouteService

logger = logging.getLogger(__name__)


class AutomationRoutingService:
	"""Background scheduler for automatically generating routes from `Schedule`.

	Currently supported:
	- scheduleType == ONCE_PER_WEEK
		- Every 7 days (based on schedule.lastGeneratedAt), create a new Route.
		- Update schedule.lastGeneratedAt to avoid duplicates.

	This is a long-running background task started from the FastAPI app lifecycle.
	"""

	def __init__(
		self,
		cb: CouchbaseClient,
		*,
		interval_seconds: int = 30,
		week_seconds: int = 7 * 24 * 60 * 60,
	) -> None:
		self._cb = cb
		self._route_service = RouteService(cb)
		self._interval_seconds = max(1, int(interval_seconds))
		self._week = timedelta(seconds=int(week_seconds))

		self._task: Optional[asyncio.Task] = None
		self._stop_event = asyncio.Event()

	def start(self) -> None:
		if self._task and not self._task.done():
			return
		self._stop_event.clear()
		self._task = asyncio.create_task(self._run_loop(), name="automation_routing_service")
		logger.info("AutomationRoutingService started")

	async def stop(self) -> None:
		self._stop_event.set()
		if self._task:
			self._task.cancel()
			try:
				await self._task
			except asyncio.CancelledError:
				pass
		logger.info("AutomationRoutingService stopped")

	async def _run_loop(self) -> None:
		while not self._stop_event.is_set():
			try:
				await self._tick()
			except asyncio.CancelledError:
				raise
			except Exception:
				logger.exception("AutomationRoutingService tick failed")

			try:
				await asyncio.wait_for(self._stop_event.wait(), timeout=self._interval_seconds)
			except asyncio.TimeoutError:
				continue

	async def _tick(self) -> None:
		now = datetime.now(timezone.utc)

		for schedule_doc in await self._list_active_weekly_schedules(limit=500):
			try:
				schedule = Schedule.model_validate(schedule_doc)
			except Exception:
				logger.warning("Invalid schedule document; skipping. doc=%s", schedule_doc)
				continue

			if not schedule.is_active:
				continue

			last_generated = schedule.last_generated_at
			if last_generated and last_generated.tzinfo is None:
				last_generated = last_generated.replace(tzinfo=timezone.utc)

			if last_generated is not None and (now - last_generated) < self._week:
				continue

			try:
				vehicle_id = (
					schedule.schedule_config.get("vehicleId")
					or schedule.schedule_config.get("vehicle_id")
					or schedule.schedule_config.get("vehicle")
				)
				if not vehicle_id:
					logger.warning(
						"Weekly schedule %s missing vehicleId in scheduleConfig; skipping. keys=%s",
						schedule.id,
						list((schedule.schedule_config or {}).keys()),
					)
					continue

				new_route = Route(
					id=str(uuid4()),
					vehicleId=vehicle_id,
					origin=schedule.origin,
					destination=schedule.destination,
					startTime=now,
					routeType=RouteType.ONCE_PER_WEEK.value,
				)

				event = RouteEvent(
					eventType=RouteEventType.ROUTE_STARTED,
					route=new_route,
				)
				await self._route_service.create_route(event)

				await self._mark_schedule_last_generated(schedule.id, now)
				logger.info("Auto-generated weekly route from schedule %s -> %s", schedule.id, new_route.id)
			except Exception:
				logger.exception("Failed to auto-generate weekly route for schedule %s", schedule.id)

	async def _list_active_weekly_schedules(self, *, limit: int = 200) -> list[dict]:
		scope_name = self._cb.scope.name if self._cb.scope else "default"
		statement = (
			f"SELECT s.* FROM `{self._cb.bucket.name}`.`{scope_name}`.schedule s "
			"WHERE s.isActive = TRUE AND s.scheduleType = $scheduleType "
			"LIMIT $limit"
		)
		try:
			result = await self._cb.query(
				statement,
				scheduleType=ScheduleType.ONCE_PER_WEEK.value,
				limit=limit,
			)
			return list(result)
		except CouchbaseException:
			return []

	async def _mark_schedule_last_generated(self, schedule_id: str, ts: datetime) -> None:
		"""Update Schedule.lastGeneratedAt after generating a Route."""
		doc_id = schedule_id if schedule_id.startswith("template::") else f"template::{schedule_id}"
		existing = await self._cb.get_document(doc_id, "schedule")
		if not existing:
			return
		existing["lastGeneratedAt"] = ts.isoformat()
		await self._cb.upsert_document(doc_id, existing, "schedule")

	@staticmethod
	def _parse_dt(value) -> Optional[datetime]:
		if not value:
			return None
		if isinstance(value, datetime):
			return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
		if isinstance(value, str):
			try:
				# Python's fromisoformat handles Z only in 3.11+? We'll normalize.
				v = value.replace("Z", "+00:00")
				dt = datetime.fromisoformat(v)
				return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
			except ValueError:
				return None
		return None




