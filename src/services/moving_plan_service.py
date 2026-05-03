from __future__ import annotations

from typing import TYPE_CHECKING

from ortools.constraint_solver import pywrapcp, routing_enums_pb2

from src.models.brand_warehouse import BrandWarehouse
from src.models.plan import Plan, PlanEvent, PlanEventType
from src.models.routing import Route, RouteEvent, RouteEventType

if TYPE_CHECKING:
    from src.config.couchbase import CouchbaseClient
    from src.models.vehicle import Vehicle
    from src.services.plan_service import PlanService
    from src.services.route_service import RouteService


class MovingPlanService:
    def __init__(self, cb: CouchbaseClient, plan_service: PlanService, route_service: RouteService):
        self._cb = cb
        self._plan_service = plan_service
        self._route_service = route_service

    async def create_moving_plan(
        self,
        depot: BrandWarehouse,
        vehicles: list[Vehicle],
        brand_warehouses: list[BrandWarehouse],
        *,
        note: str | None = None,
    ) -> list[Plan]:
        """Create inter-warehouse moving plans using straight-line distance.

        Modeling is similar to `PickupPlanService`:
        - VRP with a single depot (start/end)
        - nodes are brand warehouses to be visited
        - objective: minimize travel cost

        Capacity constraint is currently optional: we keep it for compatibility with
        `Vehicle.capacity` but set all node demands to 0 because this endpoint does
        not yet model per-transfer weights.
        """

        if not vehicles:
            return []

        # Ensure uniqueness and avoid including the depot twice.
        unique_by_id: dict[str, BrandWarehouse] = {bw.id: bw for bw in brand_warehouses if bw is not None}
        unique_by_id.pop(depot.id, None)

        locations: list[BrandWarehouse] = [depot] + list(unique_by_id.values())
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

        # Capacity dimension (kept, but with 0 demand everywhere by default).
        # If `Vehicle.capacity` is missing, treat as "infinite".
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
            raise Exception("No solution found for the moving plan.")

        plans: list[Plan] = []
        for vehicle_id in range(num_vehicles):
            index = routing.Start(vehicle_id)
            route_nodes: list[BrandWarehouse] = []

            while not routing.IsEnd(index):
                node_index = manager.IndexToNode(index)
                route_nodes.append(locations[node_index])
                index = solution.Value(routing.NextVar(index))

            end_node_index = manager.IndexToNode(index)
            route_nodes.append(locations[end_node_index])

            # start + end depot only => ignore
            if len(route_nodes) <= 2:
                continue

            plan = Plan(
                vehicleId=vehicles[vehicle_id].id,
                origin=depot.id,
                destination=depot.id,
                points=[loc.to_dict() for loc in route_nodes],
                routes=[
                    Route(
                        vehicleId=vehicles[vehicle_id].id,
                        origin=route_nodes[i].to_dict(),
                        destination=route_nodes[i + 1].to_dict(),
                    )
                    for i in range(len(route_nodes) - 1)
                ],
                note=note or "MOVING_PLAN",
            )

            event = PlanEvent(eventType=PlanEventType.PLAN_CREATED, plan=plan)
            created_plan = await self._plan_service.create_plan(event)

            for route in created_plan.routes:
                route_event = RouteEvent(eventType=RouteEventType.ROUTE_STARTED, route=route)
                await self._route_service.create_route(route_event)

            plans.append(created_plan)

        return plans

