import itertools
from dataclasses import dataclass, field
from datetime import UTC, datetime

import pytest

from planner.domain.geo import haversine_mi, interpolate
from planner.domain.types import LatLon, Route
from planner.providers.base import NoRoute, RouteRequest
from planner.providers.fakes import DALLAS, DENVER, FakeRouting
from planner.services.routing import find_routes

DEPARTURE = datetime(2026, 10, 12, 11, tzinfo=UTC)
REQUEST = RouteRequest(DALLAS, DENVER, DEPARTURE, 42_000)


def straight(a: LatLon, b: LatLon, duration_s: float, *via: LatLon) -> Route:
    points = [a, *via, b]
    geometry: list[LatLon] = []
    for p, q in itertools.pairwise(points):
        geometry += [interpolate(p, q, i / 100) for i in range(100)]
    geometry.append(b)
    distance = sum(haversine_mi(p, q) for p, q in itertools.pairwise(geometry))
    return Route(tuple(geometry), distance, duration_s)


@dataclass
class StubRouting:
    """Returns fixed routes for the main request; via requests go through `via_routes`."""

    main: list[Route]
    via_routes: bool = True
    calls: list[RouteRequest] = field(default_factory=list)

    def routes(self, request: RouteRequest, alternatives: int) -> list[Route]:
        self.calls.append(request)
        if not request.via:
            return self.main
        if not self.via_routes:
            raise NoRoute("no route via that point")
        return [straight(request.origin, request.destination, 50_000, *request.via)]


def test_identical_routes_are_reduced_to_one_and_fallback_fills_the_rest() -> None:
    same = straight(DALLAS, DENVER, 40_000)
    stub = StubRouting([same, straight(DALLAS, DENVER, 40_500)])

    options = find_routes(stub, REQUEST)

    assert len(options.routes) == 3
    assert options.routes[0] is same
    assert options.via_fallback_used
    assert [len(c.via) for c in stub.calls] == [0, 1, 1]
    assert options.warnings == ()


def test_three_distinct_routes_need_no_fallback() -> None:
    stub = FakeRouting()

    options = find_routes(stub, REQUEST)

    assert [r.label for r in options.routes] == ["via Amarillo", "via Wichita", "via Lubbock"]
    assert not options.via_fallback_used
    assert len(stub.calls) == 1


def test_keeps_the_fastest_three() -> None:
    routes = [
        straight(DALLAS, DENVER, 40_000 + i * 1_000, LatLon(36.0, -101.0 + i)) for i in range(5)
    ]

    options = find_routes(StubRouting(list(reversed(routes))), REQUEST)

    assert [r.duration_s for r in options.routes] == [40_000, 41_000, 42_000]


def test_single_route_and_failed_fallback_warns() -> None:
    stub = StubRouting([straight(DALLAS, DENVER, 40_000)], via_routes=False)

    options = find_routes(stub, REQUEST)

    assert len(options.routes) == 1
    assert options.via_fallback_used
    assert [w.code for w in options.warnings] == ["only_n_routes_found"]
    assert options.warnings[0].message == "Only 1 distinct route found for this trip"


def test_via_points_sit_either_side_of_the_midpoint() -> None:
    stub = StubRouting([straight(DALLAS, DENVER, 40_000)])

    find_routes(stub, REQUEST)

    vias = [c.via[0] for c in stub.calls[1:]]
    mid = interpolate(DALLAS, DENVER, 0.5)
    trip = haversine_mi(DALLAS, DENVER)
    for v in vias:
        assert haversine_mi(v, mid) == pytest.approx(0.10 * trip, rel=0.01)
    assert haversine_mi(vias[0], vias[1]) == pytest.approx(0.20 * trip, rel=0.01)
