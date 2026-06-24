import json
import time
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
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8-sig"))


def route_case_ids() -> list[str]:
    data = load_fixture_data()
    return [
        case_id
        for case_id, case in data.items()
        if isinstance(case, dict)
        and {"start", "goal", "depots", "expectedPath"}.issubset(case)
    ]


def record_a_star_result(
    config: pytest.Config,
    *,
    case_id: str,
    depots_count: int,
    found_len: int | str,
    expected_len: int,
    elapsed_ms: float,
    status: str,
) -> None:
    results = getattr(config, "_a_star_results", None)
    if results is None:
        return

    results.append(
        {
            "case_id": case_id,
            "depots_count": depots_count,
            "found_len": found_len,
            "expected_len": expected_len,
            "elapsed_ms": elapsed_ms,
            "status": status,
        }
    )


@pytest.mark.parametrize("case_id", route_case_ids())
def test_a_star_returns_expected_path_for_fixture_case(case_id: str, request: pytest.FixtureRequest):
    data = load_fixture_data()[case_id]

    started = time.perf_counter()
    try:
        path = find_depot_path_with_a_star(
            start=point_from_data(data["start"]),
            goal=point_from_data(data["goal"]),
            depots=points_from_data(data["depots"]),
        )
    except Exception as exc:
        elapsed_ms = (time.perf_counter() - started) * 1000
        record_a_star_result(
            request.config,
            case_id=case_id,
            depots_count=len(data["depots"]),
            found_len="ERROR",
            expected_len=len(data["expectedPath"]),
            elapsed_ms=elapsed_ms,
            status=type(exc).__name__,
        )
        raise

    elapsed_ms = (time.perf_counter() - started) * 1000
    found_ids = [point.id for point in path]
    status = "PASS" if found_ids == data["expectedPath"] else "FAIL"
    record_a_star_result(
        request.config,
        case_id=case_id,
        depots_count=len(data["depots"]),
        found_len=len(path),
        expected_len=len(data["expectedPath"]),
        elapsed_ms=elapsed_ms,
        status=status,
    )

    assert found_ids == data["expectedPath"]


def test_a_star_returns_direct_path_when_points_are_within_segment_limit():
    path = find_depot_path_with_a_star(
        start=Point(
            id="start",
            name="start",
            address="start address",
            coordinate=Coordinate(lon=0.0, lat=0.0),
        ),
        goal=Point(
            id="goal",
            name="goal",
            address="goal address",
            coordinate=Coordinate(lon=0.5, lat=0.0),
        ),
        depots=[],
    )

    assert [point.id for point in path] == ["start", "goal"]


def test_a_star_raises_when_no_segment_under_limit_can_reach_goal():
    with pytest.raises(ValueError, match="Unable to find depot route"):
        find_depot_path_with_a_star(
            start=Point(
                id="start",
                name="start",
                address="start address",
                coordinate=Coordinate(lon=0.0, lat=0.0),
            ),
            goal=Point(
                id="goal",
                name="goal",
                address="goal address",
                coordinate=Coordinate(lon=2.0, lat=0.0),
            ),
            depots=[],
        )


@pytest.mark.parametrize(
    ("start", "goal"),
    [
        (
            Point(id="start", name="start", address="start address"),
            Point(
                id="goal",
                name="goal",
                address="goal address",
                coordinate=Coordinate(lon=0.5, lat=0.0),
            ),
        ),
        (
            Point(
                id="start",
                name="start",
                address="start address",
                coordinate=Coordinate(lon=0.0, lat=0.0),
            ),
            Point(id="goal", name="goal", address="goal address"),
        ),
    ],
)
def test_a_star_requires_start_and_goal_coordinates(start: Point, goal: Point):
    with pytest.raises(ValueError, match="Depot points must have coordinates"):
        find_depot_path_with_a_star(start=start, goal=goal, depots=[])


def test_a_star_returns_single_point_when_start_and_goal_are_the_same():
    path = find_depot_path_with_a_star(
        start=Point(
            id="same",
            name="same",
            address="same address",
            coordinate=Coordinate(lon=0.0, lat=0.0),
        ),
        goal=Point(
            id="same",
            name="same",
            address="same address",
            coordinate=Coordinate(lon=0.0, lat=0.0),
        ),
        depots=[
            Point(
                id="unused-depot",
                name="unused-depot",
                address="unused-depot address",
                coordinate=Coordinate(lon=0.5, lat=0.0),
            )
        ],
    )

    assert [point.id for point in path] == ["same"]


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
