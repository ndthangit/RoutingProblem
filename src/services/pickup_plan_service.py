from __future__ import annotations
from typing import TYPE_CHECKING
from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp

from src.models.plan import Plan, PlanEvent, PlanEventType
from src.models.routing import RouteRequest
from src.services.routing_service import RoutingService
if TYPE_CHECKING:
    from src.config.couchbase import CouchbaseClient
    from src.models.vehicle import Vehicle
    from src.models.customer_warehouse import CustomerWarehouse
    from src.services.plan_service import PlanService


class PickupPlanService:
    def __init__(self, cb: CouchbaseClient, plan_service: PlanService):
        self._cb = cb
        self._plan_service = plan_service
        self._routing_service = RoutingService()

    async def create_pickup_plan(
        self,
        depot: CustomerWarehouse,
        vehicles: list[Vehicle],
        customer_warehouses: list[CustomerWarehouse],
        owner_email: str,
    ) -> list[Plan]:
        """
        Creates a pickup plan for a list of vehicles and customer warehouses.
        """
        locations = [depot] + customer_warehouses
        location_coords = [loc.coordinate for loc in locations]

        # Create the routing model.
        num_vehicles = len(vehicles)
        manager = pywrapcp.RoutingIndexManager(len(locations), num_vehicles, 0)
        routing = pywrapcp.RoutingModel(manager)

        # Create and register a transit callback.
        async def time_callback(from_index, to_index):
            """Returns the travel time between the two nodes."""
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            
            if from_node >= len(location_coords) or to_node >= len(location_coords):
                 return 0
            
            from_coord = location_coords[from_node]
            to_coord = location_coords[to_node]

            if from_coord is None or to_coord is None:
                return 0

            route_req = RouteRequest(coordinates=[from_coord, to_coord])
            route = await self._routing_service.route(route_req)
            return route.duration_s

        transit_callback_index = routing.RegisterUnaryTransitCallback(time_callback)
        routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

        # Add capacity constraints.
        demands = [0] + [wh.pending_weight for wh in customer_warehouses]
        vehicle_capacities = [v.capacity for v in vehicles]

        def demand_callback(from_index):
            """Returns the demand of the node."""
            from_node = manager.IndexToNode(from_index)
            return demands[from_node]

        demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)
        routing.AddDimensionWithVehicleCapacity(
            demand_callback_index,
            0,  # null capacity slack
            vehicle_capacities,  # vehicle maximum capacities
            True,  # start cumul to zero
            "Capacity",
        )

        # Setting first solution heuristic.
        search_parameters = pywrapcp.DefaultRoutingSearchParameters()
        search_parameters.first_solution_strategy = (
            routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
        )
        search_parameters.local_search_metaheuristic = (
            routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
        )
        search_parameters.time_limit.FromSeconds(1)

        # Solve the problem.
        solution = routing.SolveWithParameters(search_parameters)

        if not solution:
            raise Exception("No solution found for the pickup plan.")

        # Create plans from the solution.
        plans = []
        for vehicle_id in range(num_vehicles):
            index = routing.Start(vehicle_id)
            route_nodes = []
            while not routing.IsEnd(index):
                node_index = manager.IndexToNode(index)
                route_nodes.append(locations[node_index])
                index = solution.Value(routing.NextVar(index))
            
            if len(route_nodes) <= 1:
                continue

            plan = Plan(
                vehicleId=vehicles[vehicle_id].id,
                origin=depot.id,
                destination=depot.id,
                stops=[loc.to_dict() for loc in route_nodes[1:]],
            )
            event = PlanEvent(
                eventType=PlanEventType.PLAN_CREATED,
                plan=plan,
            )
            print(plan)
            # created_plan = await self._plan_service.create_plan(event)
            # plans.append(created_plan)

        return plans
