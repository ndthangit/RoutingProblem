from __future__ import annotations

from typing import Optional, TYPE_CHECKING

from src.models.brand_warehouse import BrandWarehouseType
from src.models.customer_warehouse import CustomerWarehouse
from src.models.order import Order
from src.models.routing import Coordinate, Point
from src.services.a_star_pathfinder import (
    MAX_DEPOT_SEGMENT_DISTANCE_M as DEFAULT_MAX_DEPOT_SEGMENT_DISTANCE_M,
    as_point,
    distance_m,
    find_depot_path_with_a_star,
    is_same_point,
)

if TYPE_CHECKING:
    from src.config.couchbase import CouchbaseClient


class OrderPointService:
    """Build the logical warehouse/customer waypoints for a newly created order."""

    MAX_DEPOT_SEGMENT_DISTANCE_M = DEFAULT_MAX_DEPOT_SEGMENT_DISTANCE_M

    def __init__(self, cb: CouchbaseClient):
        from src.services.brand_warehouse_service import BrandWarehouseService

        self._brand_warehouse_service = BrandWarehouseService(cb)
        self._distance_cache: dict[tuple[str, str], float] = {}

    @staticmethod
    def _copy_coordinate(coordinate: Coordinate | None) -> Coordinate | None:
        if coordinate is None:
            return None
        return coordinate.model_copy(deep=True)

    @classmethod
    def _as_point(cls, point: Point) -> Point:
        return as_point(point)

    @staticmethod
    def _is_same_point(left: Point, right: Point) -> bool:
        return is_same_point(left, right)

    @staticmethod
    def _distance_cache_key(left: Point, right: Point) -> tuple[str, str] | None:
        if not left.id or not right.id:
            return None
        if left.id <= right.id:
            return (left.id, right.id)
        return (right.id, left.id)

    def _distance_m(self, left: Point, right: Point) -> float:
        if left.coordinate is None or right.coordinate is None:
            return distance_m(left, right)

        cache_key = self._distance_cache_key(left, right)
        if cache_key is not None and cache_key in self._distance_cache:
            return self._distance_cache[cache_key]

        calculated_distance = distance_m(left, right)
        if cache_key is not None:
            self._distance_cache[cache_key] = calculated_distance
        return calculated_distance

    async def _find_depot_path_with_a_star(self, start: Point, goal: Point) -> list[Point]:
        depots = await self._brand_warehouse_service.list_warehouses_by_type(BrandWarehouseType.DEPOT.value)
        return find_depot_path_with_a_star(
            start=start,
            goal=goal,
            depots=depots,
            max_segment_distance_m=self.MAX_DEPOT_SEGMENT_DISTANCE_M,
            distance_func=self._distance_m,
        )

    async def _find_nearest_depot(self, point: Point) -> Optional[Point]:
        if point.coordinate is None:
            return None

        depots = await self._brand_warehouse_service.list_warehouses_by_type(BrandWarehouseType.DEPOT.value)
        best: Optional[Point] = None
        best_distance = float("inf")
        for depot in depots:
            if depot.coordinate is None:
                continue

            depot_distance = self._distance_m(point, depot)
            if depot_distance < best_distance:
                best = depot
                best_distance = depot_distance

        return best

    async def _resolve_hub_point(
        self,
        *,
        origin: Point,
        customer_warehouse: CustomerWarehouse | None,
    ) -> Optional[Point]:
        if customer_warehouse and customer_warehouse.hub_responsible:
            warehouse = await self._brand_warehouse_service.get_warehouse(customer_warehouse.hub_responsible)
            if (
                warehouse is not None
                and warehouse.coordinate is not None
                and warehouse.brand_warehouse_type == BrandWarehouseType.DEPOT
            ):
                return self._as_point(warehouse)

        lookup_origin = customer_warehouse if customer_warehouse is not None else origin
        warehouse = await self._find_nearest_depot(lookup_origin)
        if warehouse is None:
            return None
        return self._as_point(warehouse)

    async def _resolve_destination_depot_point(self, destination: Point) -> Optional[Point]:
        warehouse = await self._find_nearest_depot(destination)
        if warehouse is None:
            return None
        return self._as_point(warehouse)

    async def build_order_points(
        self,
        order: Order,
        *,
        customer_warehouse: CustomerWarehouse | None = None,
    ) -> list[Point]:
        if order.origin.coordinate is None:
            raise ValueError("Order origin must have a coordinate before computing route points")
        if order.destination.coordinate is None:
            raise ValueError("Order destination must have a coordinate before computing route points")

        origin_point = self._as_point(customer_warehouse if customer_warehouse is not None else order.origin)

        hub_point = await self._resolve_hub_point(origin=origin_point, customer_warehouse=customer_warehouse)
        if hub_point is None:
            raise ValueError("Unable to resolve hub point for order")

        depot_point = await self._resolve_destination_depot_point(order.destination)
        if depot_point is None:
            raise ValueError("Unable to resolve depot point near order destination")

        destination_point = self._as_point(order.destination)
        depot_route = await self._find_depot_path_with_a_star(hub_point, depot_point)

        routes = [origin_point]
        for point in depot_route:
            if not routes or not self._is_same_point(routes[-1], point):
                routes.append(point)

        routes.append(destination_point)
        return routes
