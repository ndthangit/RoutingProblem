from __future__ import annotations

from typing import Optional

from src.config.couchbase import CouchbaseClient
from src.models.brand_warehouse import BrandWarehouseType
from src.models.customer_warehouse import CustomerWarehouse
from src.models.order import Order
from src.models.routing import Coordinate, Point
from src.services.brand_warehouse_service import BrandWarehouseService


class OrderPointService:
    """Build the logical warehouse/customer waypoints for a newly created order."""

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
                and warehouse.brand_warehouse_type == BrandWarehouseType.HUB
            ):
                return self._as_point(warehouse)

        lookup_origin = customer_warehouse if customer_warehouse is not None else origin
        warehouse = await self._brand_warehouse_service.find_nearest_warehouse(
            lookup_origin,
            BrandWarehouseType.HUB.value,
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
        routes = [origin_point, hub_point]
        if not self._is_same_point(hub_point, depot_point):
            routes.append(depot_point)
        routes.append(destination_point)
        return routes
