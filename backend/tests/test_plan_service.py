import time
from collections.abc import Sequence
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from itertools import pairwise

import pytest

from planner.domain.forecast import ForecastSeries
from planner.domain.hos import Cycle, HosClocks, StopKind
from planner.domain.risk import Level
from planner.domain.types import LatLon, Route
from planner.domain.version import RULES_VERSION
from planner.providers.base import (
    Place,
    RouteRequest,
    RoutingUnavailable,
    WeatherUnavailable,
)
from planner.providers.fakes import DALLAS, DENVER, FakeGeocoder, FakeRouting, FakeWeather
from planner.providers.registry import Providers
from planner.services.forecasts import ForecastStore
from planner.services.plan import Plan, PlanRequest, plan_trip
from tests.golden import assert_golden, to_jsonable

NOW = datetime(2026, 10, 12, 10, 20, tzinfo=UTC)
DEPARTURE = datetime(2026, 10, 12, 11, 0, tzinfo=UTC)  # 06:00 in Dallas
ORIGIN = Place("Dallas, TX", DALLAS, "America/Chicago")
DESTINATION = Place("Denver, CO", DENVER, "America/Denver")
REQUEST = PlanRequest(ORIGIN, DESTINATION, DEPARTURE, load_lb=42_000, interval_mi=25)


class Clock:
    def __init__(self, t: datetime = NOW) -> None:
        self.t = t

    def __call__(self) -> datetime:
        return self.t


class SlowRouting:
    def __init__(self, delay_s: float = 0.0, down: bool = False) -> None:
        self.inner = FakeRouting()
        self.delay_s = delay_s
        self.down = down
        self.calls = 0

    def routes(self, request: RouteRequest, alternatives: int) -> list[Route]:
        self.calls += 1
        time.sleep(self.delay_s)
        if self.down:
            raise RoutingUnavailable("HERE: timed out")
        return self.inner.routes(request, alternatives)


class SlowWeather:
    def __init__(self, delay_s: float = 0.0, scenario: str = "demo") -> None:
        self.inner = FakeWeather(
            "strong" if scenario == "strong" else "demo", anchor=NOW.replace(minute=0)
        )
        self.delay_s = delay_s
        self.down = False
        self.calls = 0

    def hourly(
        self, points: Sequence[LatLon], start: datetime, hours: int
    ) -> list[ForecastSeries | None]:
        self.calls += 1
        time.sleep(self.delay_s)
        if self.down:
            raise WeatherUnavailable("Open-Meteo: HTTP 503")
        return self.inner.hourly(points, start, hours)


def run(
    request: PlanRequest = REQUEST,
    routing: SlowRouting | None = None,
    weather: SlowWeather | None = None,
    clock: Clock | None = None,
) -> Plan:
    routing = routing or SlowRouting()
    weather = weather or SlowWeather()
    clock = clock or Clock()
    providers = Providers(routing, weather, FakeGeocoder(), demo=True)
    return plan_trip(request, providers, ForecastStore(weather, clock=clock), clock=clock)


def summary(plan: Plan) -> object:
    """The whole plan except geometry and spans, which pin nothing about the logic."""
    return to_jsonable(plan, skip=frozenset({"geometry", "spans"}))


def test_demo_plan_matches_golden_file() -> None:
    assert_golden("plan_demo.json", summary(run()))


def test_demo_recommends_route_a_for_fewest_severe_miles() -> None:
    plan = run()

    assert [r.name for r in plan.routes] == ["Route A", "Route B", "Route C"]
    assert [r.route.label for r in plan.routes] == ["via Amarillo", "via Wichita", "via Lubbock"]
    assert plan.recommended_id == "r1"
    assert plan.reason_code == "severe"
    assert plan.reason.startswith("Fewest severe miles (0 vs ")
    assert [r.rank for r in plan.routes] == [1, 2, 3]
    assert plan.warnings == ()


def test_provenance() -> None:
    plan = run()

    assert plan.rules_version == RULES_VERSION
    assert plan.generated_at == NOW
    assert plan.forecast_as_of == NOW
    assert plan.demo is True
    assert plan.stale is False


def test_forecasts_for_all_routes_are_one_batched_call() -> None:
    routing, weather = SlowRouting(), SlowWeather()
    run(routing=routing, weather=weather)

    assert routing.calls == 1
    assert weather.calls == 1


def test_cold_plan_with_slow_providers_is_under_two_seconds() -> None:
    started = time.perf_counter()
    run(routing=SlowRouting(delay_s=0.3), weather=SlowWeather(delay_s=0.3))

    assert time.perf_counter() - started < 2.0


def test_checkpoints_follow_the_route_in_time() -> None:
    for route in run().routes:
        cps = route.checkpoints
        assert cps[0].mile == 0 and cps[0].eta == DEPARTURE
        assert cps[-1].mile == pytest.approx(route.route.distance_mi)
        assert cps[-1].eta == route.arrival
        assert all(a.eta <= b.eta and a.mile < b.mile for a, b in pairwise(cps))
        assert sum(c.owned_mi for c in cps) == pytest.approx(route.route.distance_mi)
        # Each checkpoint reads the forecast for the hour it is driving through.
        for c in cps:
            assert c.forecast is not None
            assert c.eta <= c.forecast.valid_hour < c.eta + timedelta(hours=1)


def test_without_hos_trip_time_is_drive_time() -> None:
    for route in run().routes:
        assert route.hos_stops == ()
        assert route.trip_duration_s == route.route.duration_s
        assert route.arrival == DEPARTURE + timedelta(seconds=route.route.duration_s)


def test_hos_adds_stops_and_shifts_later_etas() -> None:
    clocks = HosClocks(Cycle.H70_8D, 11 * 3600, 14 * 3600, 8 * 3600, 52 * 3600)
    plain, hos = run(), run(replace(REQUEST, hos=clocks))

    for a, b in zip(plain.routes, hos.routes, strict=True):
        assert a.id == b.id
        drive_h = a.route.duration_s / 3600
        # Every fake route is 11.7-12.9 h of driving: a break at 8 h, a rest at 11 h.
        assert drive_h > 11
        assert [s.stop.kind for s in b.hos_stops] == [StopKind.BREAK, StopKind.REST]
        assert b.trip_duration_s == a.route.duration_s + 30 * 60 + 10 * 3600
        assert b.arrival == DEPARTURE + timedelta(seconds=b.trip_duration_s)
        assert b.checkpoints[-1].eta == b.arrival
        rest = b.hos_stops[1]
        for pa, pb in zip(a.checkpoints, b.checkpoints, strict=True):
            assert pa.mile == pb.mile
            shift = (pb.eta - pa.eta).total_seconds()
            if pb.mile > rest.mile + 1e-6:
                assert shift == pytest.approx(30 * 60 + 10 * 3600)
            assert shift >= 0


def test_hos_trip_time_drives_ranking_when_risk_ties() -> None:
    # Away from Dallas-Denver the fakes have no storms on the route: risk ties
    # and the fastest trip wins.
    request = replace(
        REQUEST,
        origin=Place("Chicago, IL", LatLon(41.8781, -87.6298), None),
        destination=Place("Memphis, TN", LatLon(35.1495, -90.0490), None),
    )
    plan = run(request)

    assert plan.reason_code in ("duration", "avg_risk")
    assert plan.routes[0].trip_duration_s <= plan.routes[1].trip_duration_s


def test_strong_scenario_has_an_undrivable_route() -> None:
    plan = run(weather=SlowWeather(scenario="strong"))

    wichita = next(r for r in plan.routes if r.route.label == "via Wichita")
    assert not wichita.metrics.drivable
    assert wichita.rank == 3
    assert plan.recommended_id == "r1"


def test_provider_down_with_recent_cache_plans_with_stale_flag() -> None:
    weather, clock = SlowWeather(), Clock()
    run(weather=weather, clock=clock)  # warms the cache at 10:20

    clock.t = NOW + timedelta(hours=1)
    weather.down = True
    plan = run(weather=weather, clock=clock)

    assert plan.stale is True
    assert plan.forecast_as_of == NOW
    assert plan.recommended_id == "r1"
    assert all(c.risk.known for r in plan.routes for c in r.checkpoints)


def test_weather_down_with_nothing_cached_fails() -> None:
    weather = SlowWeather()
    weather.down = True

    with pytest.raises(WeatherUnavailable):
        run(weather=weather)


def test_routing_down_fails() -> None:
    with pytest.raises(RoutingUnavailable):
        run(routing=SlowRouting(down=True))


class GappyWeather(SlowWeather):
    """No data for points west of a longitude, as when a batch fails upstream."""

    def __init__(self, west_of: float) -> None:
        super().__init__()
        self.west_of = west_of

    def hourly(
        self, points: Sequence[LatLon], start: datetime, hours: int
    ) -> list[ForecastSeries | None]:
        series = super().hourly(points, start, hours)
        return [None if p.lon < self.west_of else s for p, s in zip(points, series, strict=True)]


def test_missing_forecasts_are_unknown_with_a_warning() -> None:
    plan = run(weather=GappyWeather(west_of=-104.5))  # the last stretch into Denver

    for route in plan.routes:
        unknown = [c for c in route.checkpoints if c.position.lon < -104.55]
        assert unknown, route.name
        assert all(c.risk.level is None and c.forecast is None for c in unknown)
        assert route.metrics.unknown_miles > 0
    codes = {(w.code, w.route_id) for w in plan.warnings}
    assert all(
        ("partial_forecast", r.id) in codes or ("high_unknown", r.id) in codes for r in plan.routes
    )


def test_routes_without_spans_warn_that_etas_are_estimated() -> None:
    class NoSpans(SlowRouting):
        def routes(self, request: RouteRequest, alternatives: int) -> list[Route]:
            return [replace(r, spans=()) for r in super().routes(request, alternatives)]

    plan = run(routing=NoSpans())

    assert all(r.eta_estimated for r in plan.routes)
    assert {w.code for w in plan.warnings} == {"eta_estimated"}


def test_a_storm_on_the_route_is_rated_at_the_eta_not_departure() -> None:
    plan = run()
    wichita = next(r for r in plan.routes if r.route.label == "via Wichita")

    worst = max(wichita.checkpoints, key=lambda c: c.risk.level or 0)
    assert worst.risk.level is not None and worst.risk.level >= Level.SEVERE
    assert worst.eta > DEPARTURE + timedelta(hours=3)  # Wichita is ~5 h out
