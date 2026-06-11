from __future__ import annotations

import heapq
import math
from typing import Callable

from src.models.routing import Coordinate, Point


MAX_DEPOT_SEGMENT_DISTANCE_M = 100_000.0
DistanceFunction = Callable[[Point, Point], float]


def copy_coordinate(coordinate: Coordinate | None) -> Coordinate | None:
    if coordinate is None:
        return None
    return coordinate.model_copy(deep=True)


def as_point(point: Point) -> Point:
    return Point(
        id=point.id,
        name=point.name,
        address=point.address,
        coordinate=copy_coordinate(point.coordinate),
    )


def is_same_point(left: Point, right: Point) -> bool:
    if left.id and right.id and left.id == right.id:
        return True

    if left.coordinate is not None and right.coordinate is not None:
        if left.coordinate.lat == right.coordinate.lat and left.coordinate.lon == right.coordinate.lon:
            return True

    return left.address == right.address and left.name == right.name


def distance_m(left: Point, right: Point) -> float:
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


def append_unique_point(points: list[Point], point: Point) -> int:
    for index, existing in enumerate(points):
        if is_same_point(existing, point):
            return index

    points.append(as_point(point))
    return len(points) - 1


def reconstruct_path(came_from: dict[int, int], current: int, points: list[Point]) -> list[Point]:
    path_indexes = [current]
    while current in came_from:
        current = came_from[current]
        path_indexes.append(current)

    path_indexes.reverse()
    return [points[index] for index in path_indexes]


def find_depot_path_with_a_star(
    *,
    start: Point,
    goal: Point,
    depots: list[Point],
    max_segment_distance_m: float = MAX_DEPOT_SEGMENT_DISTANCE_M,
    distance_func: DistanceFunction = distance_m,
) -> list[Point]:
    if start.coordinate is None or goal.coordinate is None:
        raise ValueError("Depot points must have coordinates before computing A* route")

    if is_same_point(start, goal):
        return [as_point(start)]

    points: list[Point] = []
    start_index = append_unique_point(points, start)
    for depot in depots:
        if depot.coordinate is None:
            continue
        append_unique_point(points, depot)
    goal_index = append_unique_point(points, goal)

    if start_index == goal_index:
        return [points[start_index]]

    open_heap: list[tuple[float, int, int]] = []
    counter = 0
    g_score: dict[int, float] = {start_index: 0.0}
    came_from: dict[int, int] = {}

    heapq.heappush(open_heap, (distance_func(points[start_index], points[goal_index]), counter, start_index))
    closed: set[int] = set()

    while open_heap:
        _, _, current = heapq.heappop(open_heap)
        if current in closed:
            continue
        if current == goal_index:
            return reconstruct_path(came_from, current, points)

        closed.add(current)
        current_g_score = g_score[current]
        for neighbor, neighbor_point in enumerate(points):
            if neighbor == current or neighbor in closed:
                continue

            segment_distance = distance_func(points[current], neighbor_point)
            if segment_distance >= max_segment_distance_m:
                continue

            tentative_g_score = current_g_score + segment_distance
            if tentative_g_score >= g_score.get(neighbor, float("inf")):
                continue

            came_from[neighbor] = current
            g_score[neighbor] = tentative_g_score
            counter += 1
            f_score = tentative_g_score + distance_func(neighbor_point, points[goal_index])
            heapq.heappush(open_heap, (f_score, counter, neighbor))

    raise ValueError("Unable to find depot route where every segment is under 100km")
