from __future__ import annotations

import heapq
import math
from typing import Optional

from src.config.couchbase import CouchbaseClient
from src.models.brand_warehouse import BrandWarehouseType
from src.models.customer_warehouse import CustomerWarehouse
from src.models.order import Order
from src.models.routing import Coordinate, Point
from src.services.brand_warehouse_service import BrandWarehouseService


class OrderPointService:
    """Build the logical warehouse/customer waypoints for a newly created order."""

    MAX_DEPOT_SEGMENT_DISTANCE_M = 100_000.0

    def __init__(self, cb: CouchbaseClient):
        self._brand_warehouse_service = BrandWarehouseService(cb)

    @staticmethod
    def _copy_coordinate(coordinate: Coordinate | None) -> Coordinate | None:
        if coordinate is None:
            return None
        return coordinate.model_copy(deep=True)

    @classmethod
    def _as_point(cls, point: Point) -> Point:
        return Point(
            id=point.id,
            name=point.name,
            address=point.address,
            coordinate=cls._copy_coordinate(point.coordinate),
        )

    @staticmethod
    def _is_same_point(left: Point, right: Point) -> bool:
        if left.id and right.id and left.id == right.id:
            return True

        if left.coordinate is not None and right.coordinate is not None:
            if left.coordinate.lat == right.coordinate.lat and left.coordinate.lon == right.coordinate.lon:
                return True

        return left.address == right.address and left.name == right.name

    @staticmethod
    def _distance_m(left: Point, right: Point) -> float:
        if left.coordinate is None or right.coordinate is None:
            return float("inf")

        radius_m = 6_371_000.0
        left_lat = math.radians(left.coordinate.lat)
        right_lat = math.radians(right.coordinate.lat)
        delta_lat = math.radians(right.coordinate.lat - left.coordinate.lat)
        delta_lon = math.radians(right.coordinate.lon - left.coordinate.lon)

        haversine = (
            math.sin(delta_lat / 2) ** 2
            + math.cos(left_lat) * math.cos(right_lat) * math.sin(delta_lon / 2) ** 2
        )
        haversine = min(1.0, max(0.0, haversine))
        return 2 * radius_m * math.atan2(math.sqrt(haversine), math.sqrt(1 - haversine))

    @classmethod
    def _append_unique_point(cls, points: list[Point], point: Point) -> int:
        for index, existing in enumerate(points):
            if cls._is_same_point(existing, point):
                return index

        points.append(cls._as_point(point))
        return len(points) - 1

    @staticmethod
    def _reconstruct_path(came_from: dict[int, int], current: int, points: list[Point]) -> list[Point]:
        path_indexes = [current]
        while current in came_from:
            current = came_from[current]
            path_indexes.append(current)

        path_indexes.reverse()
        return [points[index] for index in path_indexes]

    async def _find_depot_path_with_a_star(self, start: Point, goal: Point) -> list[Point]:
        if start.coordinate is None or goal.coordinate is None:
            raise ValueError("Depot points must have coordinates before computing A* route")

        if self._is_same_point(start, goal):
            return [self._as_point(start)]

        depots = await self._brand_warehouse_service.list_warehouses_by_type(BrandWarehouseType.DEPOT.value)
        points: list[Point] = []
        start_index = self._append_unique_point(points, start)
        for depot in depots:
            if depot.coordinate is None:
                continue
            self._append_unique_point(points, depot)
        goal_index = self._append_unique_point(points, goal)

        if start_index == goal_index:
            return [points[start_index]]

        open_heap: list[tuple[float, int, int]] = []
        counter = 0
        g_score: dict[int, float] = {start_index: 0.0}
        came_from: dict[int, int] = {}

        heapq.heappush(open_heap, (self._distance_m(points[start_index], points[goal_index]), counter, start_index))
        closed: set[int] = set()

        while open_heap:
            _, _, current = heapq.heappop(open_heap)
            if current in closed:
                continue
            if current == goal_index:
                return self._reconstruct_path(came_from, current, points)

            closed.add(current)
            current_g_score = g_score[current]
            for neighbor, neighbor_point in enumerate(points):
                if neighbor == current or neighbor in closed:
                    continue

                segment_distance = self._distance_m(points[current], neighbor_point)
                if segment_distance >= self.MAX_DEPOT_SEGMENT_DISTANCE_M:
                    continue

                tentative_g_score = current_g_score + segment_distance
                if tentative_g_score >= g_score.get(neighbor, float("inf")):
                    continue

                came_from[neighbor] = current
                g_score[neighbor] = tentative_g_score
                counter += 1
                f_score = tentative_g_score + self._distance_m(neighbor_point, points[goal_index])
                heapq.heappush(open_heap, (f_score, counter, neighbor))

        raise ValueError("Unable to find depot route where every segment is under 100km")

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
        warehouse = await self._brand_warehouse_service.find_nearest_warehouse(
            lookup_origin,
            BrandWarehouseType.DEPOT.value,
        )
        if warehouse is None:
            return None
        return self._as_point(warehouse)

    async def _resolve_destination_depot_point(self, destination: Point) -> Optional[Point]:
        warehouse = await self._brand_warehouse_service.find_nearest_warehouse(
            destination,
            BrandWarehouseType.DEPOT.value,
        )
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
