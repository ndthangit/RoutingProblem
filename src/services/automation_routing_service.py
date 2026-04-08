from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import uuid4

from couchbase.exceptions import CouchbaseException

from src.config.couchbase import CouchbaseClient
from src.models.routing import Route, RouteEvent, RouteEventType, RouteType
from src.services.route_service import RouteService

logger = logging.getLogger(__name__)


class AutomationRoutingService:
	"""Background scheduler for automatically generating weekly routes.

	Behavior:
	- Find all routes with routeType == ONCE_PER_WEEK.
	- Each such route document acts like a *template*.
	- We store `lastGeneratedAt` inside that route document (extra field in Couchbase only).
	- When now - lastGeneratedAt >= 7 days, we create a new Route with a fresh id/startTime.
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

		for template in await self._list_weekly_templates(limit=500):
			template_id = template.get("id")
			if not template_id:
				continue

			# Ensure required fields exist before attempting validation
			if not template.get("vehicleId") or not template.get("origin") or not template.get("destination"):
				logger.warning("Weekly route template %s is missing required fields; skipping", template_id)
				continue

			last_generated = self._parse_dt(template.get("lastGeneratedAt"))
			# default: consider template.startTime as the baseline if present, otherwise generate immediately
			if last_generated is None:
				last_generated = self._parse_dt(template.get("startTime"))

			if last_generated is not None and (now - last_generated) < self._week:
				continue

			try:
				# Create new Route based on template.
				new_route = Route.model_validate(template)
				new_route.id = str(uuid4())
				new_route.start_time = now
				new_route.route_type = RouteType.ONCE_PER_WEEK

				event = RouteEvent(
					eventType=RouteEventType.ROUTE_STARTED,
					route=new_route,
				)
				await self._route_service.create_route(event)

				# Mark template's lastGeneratedAt to avoid duplicates
				await self._mark_last_generated(template_id, now)
				logger.info("Auto-generated weekly route from template %s -> %s", template_id, new_route.id)
			except Exception:
				logger.exception("Failed to auto-generate weekly route for template %s", template_id)

	async def _list_weekly_templates(self, *, limit: int = 200) -> list[dict]:
		scope_name = self._cb.scope.name if self._cb.scope else "default"
		statement = (
			f"SELECT r.* FROM `{self._cb.bucket.name}`.`{scope_name}`.route r "
			"WHERE r.routeType = $routeType "
			"LIMIT $limit"
		)
		try:
			result = await self._cb.query(statement, routeType=RouteType.ONCE_PER_WEEK.value, limit=limit)
			return list(result)
		except CouchbaseException:
			return []

	async def _mark_last_generated(self, route_id: str, ts: datetime) -> None:
		# Update the template document with lastGeneratedAt.
		# We do a UPSERT merging only the field; simplest approach is to fetch + upsert.
		doc_id = f"route::{route_id}"
		existing = await self._cb.get_document(doc_id, "route")
		if not existing:
			return
		existing["lastGeneratedAt"] = ts.isoformat()
		await self._cb.upsert_document(doc_id, existing, "route")

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




