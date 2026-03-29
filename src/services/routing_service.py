from __future__ import annotations

import logging
from typing import Any

import httpx

from src.config.config import settings
from src.models.routing import RouteLeg, RouteRequest, RouteResponse

logger = logging.getLogger(__name__)


class OsrmError(RuntimeError):
	"""Raised when OSRM returns an error or is unreachable."""


class RoutingService:
	def __init__(
		self,
		*,
		base_url: str | None = None,
		timeout_s: float | None = None,
		provider: str | None = None,
	):
		# Backward compatible: base_url is OSRM base url.
		self._osrm_base_url = (base_url or settings.OSRM_BASE_URL).rstrip("/")
		self._rapidapi_base_url = settings.RAPIDAPI_BASE_URL.rstrip("/")
		self._timeout = httpx.Timeout(timeout_s or settings.ROUTING_UPSTREAM_TIMEOUT_S)
		self._provider = (provider or settings.ROUTING_PROVIDER or "osrm").strip().lower()

	async def route(self, req: RouteRequest) -> RouteResponse:
		"""Compute a route using configured provider (OSRM direct or RapidAPI)."""
		if self._provider in {"rapidapi", "fast-routing", "fast_routing"}:
			return await self._route_via_rapidapi(req)
		if self._provider not in {"osrm"}:
			raise OsrmError(f"Unknown ROUTING_PROVIDER='{self._provider}'. Use 'osrm' or 'rapidapi'.")
		return await self._route_via_osrm(req)

	async def _route_via_osrm(self, req: RouteRequest) -> RouteResponse:
		coords = ";".join([c.to_osrm_str() for c in req.coordinates])
		url = f"{self._osrm_base_url}/route/v1/{req.profile}/{coords}"
		params = {
			"steps": "true" if req.steps else "false",
			"alternatives": "true" if req.alternatives else "false",
			"overview": req.overview,
			"geometries": req.geometries,
			"annotations": "false",
		}
		return await self._execute_osrm_like_request(url=url, params=params, provider_label="OSRM")

	async def _route_via_rapidapi(self, req: RouteRequest) -> RouteResponse:
		# RapidAPI fast-routing is OSRM-compatible but requires headers.
		if not settings.RAPIDAPI_KEY:
			raise OsrmError(
				"RAPIDAPI_KEY is not set. Set env RAPIDAPI_KEY to use ROUTING_PROVIDER=rapidapi."
			)
		coords = ";".join([c.to_osrm_str() for c in req.coordinates])
		url = f"{self._rapidapi_base_url}/route/v1/{req.profile}/{coords}"
		params = {
			"steps": "true" if req.steps else "false",
			"overview": req.overview,
			"exclude": "ferry",
			"snapping": "default",
			"skip_waypoints": "false",
			"geometries": req.geometries,
			"continue_straight": "default",
			# rapidapi/osrm supports alternatives too in many deployments; keep it if requested
			"alternatives": "true" if req.alternatives else "false",
		}

		headers = {
			"x-rapidapi-key": settings.RAPIDAPI_KEY,
			"x-rapidapi-host": settings.RAPIDAPI_HOST or "fast-routing.p.rapidapi.com",
			"Content-Type": "application/json",
		}
		return await self._execute_osrm_like_request(
			url=url,
			params=params,
			headers=headers,
			provider_label="RapidAPI",
		)

	async def _execute_osrm_like_request(
		self,
		*,
		url: str,
		params: dict[str, str],
		headers: dict[str, str] | None = None,
		provider_label: str,
	) -> RouteResponse:
		async with httpx.AsyncClient(timeout=self._timeout) as client:
			try:
				r = await client.get(url, params=params, headers=headers)
			except httpx.TimeoutException as e:
				raise OsrmError(f"{provider_label} timed out: {e}") from e
			except httpx.RequestError as e:
				raise OsrmError(f"{provider_label} request error: {e}") from e

		if r.status_code != 200:
			raise OsrmError(f"{provider_label} HTTP {r.status_code}: {r.text}")

		try:
			data: dict[str, Any] = r.json()
		except ValueError as e:
			raise OsrmError(f"{provider_label} returned non-JSON response") from e

		if data.get("code") != "Ok":
			raise OsrmError(f"{provider_label} response not Ok: {data}")

		routes = data.get("routes") or []
		if not routes:
			raise OsrmError(f"{provider_label} returned no routes")

		best = routes[0]
		legs: list[RouteLeg] = []
		for leg in best.get("legs") or []:
			legs.append(
				RouteLeg(
					distanceM=float(leg.get("distance", 0.0)),
					durationS=float(leg.get("duration", 0.0)),
				)
			)

		geometry = best.get("geometry")
		if params.get("geometries") == "geojson":
			geometry_obj = geometry
		else:
			# For polyline/polyline6 decoding is not implemented. Request geojson.
			geometry_obj = {"type": "LineString", "coordinates": []}

		return RouteResponse(
			distanceM=float(best.get("distance", 0.0)),
			durationS=float(best.get("duration", 0.0)),
			geometry=geometry_obj,
			legs=legs,
		)

