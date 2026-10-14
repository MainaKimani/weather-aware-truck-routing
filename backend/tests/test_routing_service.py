import itertools
from dataclasses import dataclass, field, replace
from datetime import UTC, datetime, timedelta

import pytest

from planner.domain.geo import haversine_mi, interpolate
from planner.domain.types import LatLon, Route, Span
from planner.providers.base import NoRoute, RouteRequest
from planner.providers.fakes import DALLAS, DENVER, FakeRouting
from planner.services.routing import cache_key, cached_find_routes, find_routes

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


class TestCache:
    def here_like(self) -> Route:
        """A route on HERE's precision-6 grid, with spans and a label."""
        r = straight(DALLAS, DENVER, 40_000)
        geometry = tuple(LatLon(round(p.lat, 6), round(p.lon, 6)) for p in r.geometry)
        spans = (Span(400.123456789, 20_000.5), Span(r.distance_mi - 400.123456789, 19_999.5))
        return Route(geometry, r.distance_mi, r.duration_s, spans, "via I-35, US-287")

    def test_the_same_trip_in_the_same_hour_is_routed_once(self) -> None:
        stub = StubRouting([self.here_like()], via_routes=False)
        first = cached_find_routes(stub, REQUEST)
        calls = len(stub.calls)

        again = cached_find_routes(stub, replace(REQUEST, departure=DEPARTURE.replace(minute=59)))

        assert len(stub.calls) == calls
        assert again == first

    def test_a_cached_route_is_exactly_what_the_provider_returned(self) -> None:
        stub = StubRouting([self.here_like()])
        first = cached_find_routes(stub, REQUEST)

        again = cached_find_routes(stub, REQUEST)

        assert again.routes[0] == self.here_like()
        assert again.warnings == first.warnings
        assert again.via_fallback_used == first.via_fallback_used

    @pytest.mark.parametrize(
        "changed",
        [
            replace(REQUEST, departure=DEPARTURE + timedelta(hours=1)),
            replace(REQUEST, load_lb=80_000),
            replace(REQUEST, destination=LatLon(DENVER.lat, DENVER.lon + 0.001)),
        ],
    )
    def test_another_hour_load_or_place_is_routed_again(self, changed: RouteRequest) -> None:
        assert cache_key(changed) != cache_key(REQUEST)

    def test_failures_are_not_cached(self) -> None:
        class Down:
            calls = 0

            def routes(self, request: RouteRequest, alternatives: int) -> list[Route]:
                self.calls += 1
                raise NoRoute("none")

        down = Down()
        for _ in range(2):
            with pytest.raises(NoRoute):
                cached_find_routes(down, REQUEST)

        assert down.calls == 2
