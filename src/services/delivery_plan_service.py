from __future__ import annotations

from typing import TYPE_CHECKING

from ortools.constraint_solver import pywrapcp, routing_enums_pb2

from src.models.brand_warehouse import BrandWarehouse
from src.models.plan import Plan, PlanEvent, PlanEventType
from src.models.routing import Point, Route, RouteEvent, RouteEventType

if TYPE_CHECKING:
    from src.config.couchbase import CouchbaseClient
    from src.models.vehicle import Vehicle
    from src.services.plan_service import PlanService
    from src.services.route_service import RouteService


class DeliveryPlanService:
    def __init__(self, cb: CouchbaseClient, plan_service: PlanService, route_service: RouteService):
        self._cb = cb
        self._plan_service = plan_service
        self._route_service = route_service

    async def create_delivery_plan(
        self,
        depot: BrandWarehouse,
        vehicles: list[Vehicle],
        delivery_points: list[Point],
        *,
        note: str | None = None,
    ) -> list[Plan]:
        """Create a delivery plan starting/ending at a brand warehouse depot.

        Nodes are buyer delivery points (order destinations). We use a fast squared
        Euclidean distance on lon/lat as the cost function (same as Pickup/Moving plan).

        Capacity constraint is optional; currently modeled as 0-demand for each point,
        similar to `MovingPlanService`.
        """

        if not vehicles:
            return []

        # Ensure uniqueness (by point.id) and avoid including the depot as a delivery stop.
        unique_by_id: dict[str, Point] = {p.id: p for p in delivery_points if p is not None}
        unique_by_id.pop(depot.id, None)

        locations: list[Point] = [depot] + list(unique_by_id.values())
        if len(locations) <= 1:
            return []

        location_coords = [loc.coordinate for loc in locations]

        num_vehicles = len(vehicles)
        manager = pywrapcp.RoutingIndexManager(len(locations), num_vehicles, 0)
        routing = pywrapcp.RoutingModel(manager)

        def cost_callback(from_index: int, to_index: int) -> int:
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)

            if from_node >= len(location_coords) or to_node >= len(location_coords):
                return 0

            from_coord = location_coords[from_node]
            to_coord = location_coords[to_node]
            if from_coord is None or to_coord is None:
                return 0

            dx = from_coord.lon - to_coord.lon
            dy = from_coord.lat - to_coord.lat
            return int((dx * dx + dy * dy) * 1_000_000)

        transit_callback_index = routing.RegisterTransitCallback(cost_callback)
        routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

        # Capacity dimension (kept; 0 demand by default)
        demands = [0 for _ in locations]
        vehicle_capacities = [int(v.capacity) if v.capacity is not None else 10**18 for v in vehicles]

        def demand_callback(from_index: int) -> int:
            from_node = manager.IndexToNode(from_index)
            return demands[from_node]

        demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)
        routing.AddDimensionWithVehicleCapacity(
            demand_callback_index,
            0,
            vehicle_capacities,
            True,
            "Capacity",
        )

        search_parameters = pywrapcp.DefaultRoutingSearchParameters()
        search_parameters.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
        search_parameters.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
        search_parameters.time_limit.FromSeconds(1)

        solution = routing.SolveWithParameters(search_parameters)
        if not solution:
            raise Exception("No solution found for the delivery plan.")

        plans: list[Plan] = []
        for vehicle_id in range(num_vehicles):
            index = routing.Start(vehicle_id)
            route_nodes: list[Point] = []

            while not routing.IsEnd(index):
                node_index = manager.IndexToNode(index)
                route_nodes.append(locations[node_index])
                index = solution.Value(routing.NextVar(index))

            end_node_index = manager.IndexToNode(index)
            route_nodes.append(locations[end_node_index])

            # start + end depot only => ignore
            if len(route_nodes) <= 2:
                continue

            plan_routes = [
                Route(
                    vehicleId=vehicles[vehicle_id].id,
                    origin=route_nodes[i].to_dict(),
                    destination=route_nodes[i + 1].to_dict(),
                )
                for i in range(len(route_nodes) - 1)
            ]

            plan = Plan(
                vehicleId=vehicles[vehicle_id].id,
                origin=depot.id,
                destination=depot.id,
                points=[loc.to_dict() for loc in route_nodes],
                routeIds=[route.id for route in plan_routes],
                note=note or "DELIVERY_PLAN",
            )

            event = PlanEvent(eventType=PlanEventType.PLAN_CREATED, plan=plan)
            created_plan = await self._plan_service.create_plan(event)

            for route in plan_routes:
                route_event = RouteEvent(eventType=RouteEventType.ROUTE_STARTED, route=route)
                await self._route_service.create_route(route_event)

            plans.append(created_plan)
        #     plans.append(plan)
        #
        # print(plans)
        return plans

