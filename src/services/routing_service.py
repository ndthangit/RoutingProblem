from __future__ import annotations

import logging
from typing import Any

import httpx

from src.config.config import settings
from src.models.routing import (
	AddressRouteRequest,
	AddressRouteResponse,
	Coordinate,
	GeocodeResponse,
	RouteLeg,
	RouteRequest,
	RouteResponse,
)

logger = logging.getLogger(__name__)


class OsrmError(RuntimeError):
	"""Raised when OSRM returns an error or is unreachable."""


class RoutingService:
	def __init__(
		self,
		*,
		base_url: str | None = None,
		timeout_s: float | None = None,
	):
		# Backward compatible: base_url is OSRM base url.
		self._osrm_base_url = (base_url or settings.OSRM_BASE_URL).rstrip("/")
		self._timeout = httpx.Timeout(timeout_s or settings.ROUTING_UPSTREAM_TIMEOUT_S)

	async def route(self, req: RouteRequest) -> RouteResponse:
		"""Compute a route using OSRM."""
		return await self._route_via_osrm(req)

	async def route_by_address(self, req: AddressRouteRequest) -> AddressRouteResponse:
		"""Geocode two addresses with Nominatim, then calculate the OSRM route."""
		start_coordinate = await self.geocode_address(req.start_address)
		end_coordinate = await self.geocode_address(req.end_address)

		route = await self.route(
			RouteRequest(
				coordinates=[start_coordinate, end_coordinate],
				profile=req.profile,
				steps=req.steps,
				alternatives=req.alternatives,
				overview=req.overview,
				geometries=req.geometries,
			)
		)

		return AddressRouteResponse(
			distanceM=route.distance_m,
			durationS=route.duration_s,
			geometry=route.geometry,
			legs=route.legs,
			startCoordinate=start_coordinate,
			endCoordinate=end_coordinate,
		)

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
		return await self._execute_osrm_request(url=url, params=params)

	async def _execute_osrm_request(
		self,
		*,
		url: str,
		params: dict[str, str],
	) -> RouteResponse:
		async with httpx.AsyncClient(timeout=self._timeout) as client:
			try:
				r = await client.get(url, params=params)
			except httpx.TimeoutException as e:
				raise OsrmError(f"OSRM timed out: {e}") from e
			except httpx.RequestError as e:
				raise OsrmError(f"OSRM request error: {e}") from e

		if r.status_code != 200:
			raise OsrmError(f"OSRM HTTP {r.status_code}: {r.text}")

		try:
			data: dict[str, Any] = r.json()
		except ValueError as e:
			raise OsrmError("OSRM returned non-JSON response") from e

		if data.get("code") != "Ok":
			raise OsrmError(f"OSRM response not Ok: {data}")

		routes = data.get("routes") or []
		if not routes:
			raise OsrmError("OSRM returned no routes")

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

	async def geocode_address(self, address: str) -> Coordinate:
		"""Geocode an address into a Coordinate (lon/lat).

		This is used to enrich Warehouse creation when the client only provides an address.
		Default implementation uses OpenStreetMap Nominatim.
		
		Configure via env:
		- GEOCODING_PROVIDER: 'nominatim' (default)
		- NOMINATIM_BASE_URL: default 'https://nominatim.openstreetmap.org'
		"""
		result = await self.geocode_address_detail(address)
		return result.coordinate

	async def geocode_address_detail(self, address: str) -> GeocodeResponse:
		"""Geocode an address with Nominatim and return coordinate plus display name."""
		address = (address or "").strip()
		if not address:
			raise ValueError("Address is required for geocoding")

		provider = (getattr(settings, "GEOCODING_PROVIDER", None) or "nominatim").strip().lower()
		if provider not in {"nominatim"}:
			raise OsrmError(f"Unknown GEOCODING_PROVIDER='{provider}'.")

		base_url = (getattr(settings, "NOMINATIM_BASE_URL", None) or "https://nominatim.openstreetmap.org").rstrip(
			"/"
		)
		url = f"{base_url}/search"
		params = {
			"q": address,
			"format": "json",
			"limit": "1",
		}
		email = (getattr(settings, "NOMINATIM_EMAIL", "") or "").strip()
		if email:
			params["email"] = email

		user_agent = (getattr(settings, "NOMINATIM_USER_AGENT", "") or "").strip()
		if not user_agent:
			user_agent = f"{getattr(settings, 'APP_NAME', 'routing-app')}/1.0"

		headers = {
			# Nominatim requires a valid User-Agent identifying the application.
			"User-Agent": user_agent,
			"Accept": "application/json",
		}

		async with httpx.AsyncClient(timeout=self._timeout) as client:
			try:
				r = await client.get(url, params=params, headers=headers)
			except httpx.TimeoutException as e:
				raise OsrmError(f"Geocoding timed out: {e}") from e
			except httpx.RequestError as e:
				raise OsrmError(f"Geocoding request error: {e}") from e

		if r.status_code != 200:
			raise OsrmError(f"Geocoding HTTP {r.status_code}: {r.text}")

		try:
			data = r.json()
		except ValueError as e:
			raise OsrmError("Geocoding returned non-JSON response") from e

		if not data:
			raise OsrmError(f"Geocoding returned no results for address: {address}")

		best = data[0]
		try:
			lat = float(best["lat"])
			lon = float(best["lon"])
		except Exception as e:
			raise OsrmError(f"Unexpected geocoding response: {best}") from e

		# Coordinate is lon/lat.
		return GeocodeResponse(
			address=address,
			coordinate=Coordinate(lon=lon, lat=lat),
			displayName=best.get("display_name"),
		)

