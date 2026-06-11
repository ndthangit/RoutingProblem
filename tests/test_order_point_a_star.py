import json
from pathlib import Path

import pytest

from src.models.routing import Coordinate, Point
from src.services import order_point_service
from src.services.a_star_pathfinder import find_depot_path_with_a_star


FIXTURE_PATH = Path(__file__).parent / "fixtures" / "a_star_routes.json"


def point_from_data(data: dict) -> Point:
    return Point.model_validate(data)


def points_from_data(items: list[dict]) -> list[Point]:
    return [point_from_data(item) for item in items]


def load_fixture_data() -> dict:
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def test_a_star_returns_direct_path_when_points_are_within_segment_limit():
    data = load_fixture_data()["direct_path"]

    path = find_depot_path_with_a_star(
        start=point_from_data(data["start"]),
        goal=point_from_data(data["goal"]),
        depots=points_from_data(data["depots"]),
    )

    assert [point.id for point in path] == data["expectedPath"]


def test_a_star_uses_intermediate_depot_when_direct_segment_is_too_far():
    data = load_fixture_data()["intermediate_depot"]

    path = find_depot_path_with_a_star(
        start=point_from_data(data["start"]),
        goal=point_from_data(data["goal"]),
        depots=points_from_data(data["depots"]),
    )

    assert [point.id for point in path] == data["expectedPath"]


def test_a_star_raises_when_no_segment_under_limit_can_reach_goal():
    data = load_fixture_data()["no_route"]

    with pytest.raises(ValueError, match="Unable to find depot route"):
        find_depot_path_with_a_star(
            start=point_from_data(data["start"]),
            goal=point_from_data(data["goal"]),
            depots=points_from_data(data["depots"]),
        )


@pytest.mark.parametrize("case_index", [0, 1])
def test_a_star_requires_start_and_goal_coordinates(case_index: int):
    data = load_fixture_data()["missing_coordinate_cases"][case_index]

    with pytest.raises(ValueError, match="Depot points must have coordinates"):
        find_depot_path_with_a_star(
            start=point_from_data(data["start"]),
            goal=point_from_data(data["goal"]),
            depots=points_from_data(data["depots"]),
        )


def test_a_star_returns_single_point_when_start_and_goal_are_the_same():
    data = load_fixture_data()["same_point"]

    path = find_depot_path_with_a_star(
        start=point_from_data(data["start"]),
        goal=point_from_data(data["goal"]),
        depots=points_from_data(data["depots"]),
    )

    assert [point.id for point in path] == data["expectedPath"]


def test_order_point_distance_cache_reuses_same_pair_by_ids(monkeypatch):
    calls: list[tuple[str, str]] = []

    def fake_distance_m(left: Point, right: Point) -> float:
        calls.append((left.id, right.id))
        return 123.0

    monkeypatch.setattr(order_point_service, "distance_m", fake_distance_m)

    service = order_point_service.OrderPointService.__new__(order_point_service.OrderPointService)
    service._distance_cache = {}
    customer = Point(
        id="customer-1",
        name="Customer",
        address="Customer address",
        coordinate=Coordinate(lat=10.0, lon=106.0),
    )
    brand = Point(
        id="brand-1",
        name="Brand",
        address="Brand address",
        coordinate=Coordinate(lat=11.0, lon=107.0),
    )

    assert service._distance_m(customer, brand) == 123.0
    assert service._distance_m(brand, customer) == 123.0

    assert calls == [("customer-1", "brand-1")]
    assert service._distance_cache == {("brand-1", "customer-1"): 123.0}
