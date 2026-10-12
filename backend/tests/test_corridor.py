import gzip
import json
import time
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta

import pytest

from planner.api.serializers import HeatmapSerializer
from planner.domain.forecast import ForecastSeries
from planner.domain.geo import distance_to_line_mi
from planner.domain.risk import Level, classify
from planner.domain.types import Forecast, LatLon, Route
from planner.providers.base import Place, RouteRequest, WeatherUnavailable
from planner.providers.fakes import DALLAS, DENVER, FakeGeocoder, FakeRouting, FakeWeather
from planner.providers.registry import Providers
from planner.services.corridor import (
    BUFFER_MI,
    HOURS,
    POINT_CAP,
    corridor_grid,
    corridor_points,
)
from planner.services.forecasts import ForecastStore
from planner.services.plan import PlanRequest, plan_trip

NOW = datetime(2026, 10, 12, 10, 20, tzinfo=UTC)
LOS_ANGELES = LatLon(34.0522, -118.2437)
NEW_YORK = LatLon(40.7128, -74.0060)
SEATTLE = LatLon(47.6062, -122.3321)
MIAMI = LatLon(25.7617, -80.1918)


def routes(origin: LatLon, destination: LatLon) -> list[Route]:
    return FakeRouting().routes(RouteRequest(origin, destination, NOW, 42_000), 4)


def lines(origin: LatLon, destination: LatLon) -> list[tuple[LatLon, ...]]:
    return [r.geometry for r in routes(origin, destination)]


class StripedWeather:
    """Gusts that differ by place and hour, so reading the wrong point or hour shows."""

    def __init__(self) -> None:
        self.calls = 0
        self.down = False

    def forecast(self, p: LatLon, hour: datetime) -> Forecast:
        stripe = (round(p.lon * 4) + round(p.lat * 4) + hour.hour) % 5
        return Forecast(hour, gust_mph=10.0 + 11 * stripe, rain_in_hr=0.0, snow_in_hr=0.0)

    def hourly(
        self, points: Sequence[LatLon], start: datetime, hours: int
    ) -> list[ForecastSeries | None]:
        self.calls += 1
        if self.down:
            raise WeatherUnavailable("down")
        stamps = [start + timedelta(hours=h) for h in range(hours)]
        return [ForecastSeries(start, tuple(self.forecast(p, t) for t in stamps)) for p in points]


def store(weather: object, at: datetime = NOW) -> ForecastStore:
    return ForecastStore(weather, clock=lambda: at)  # type: ignore[arg-type]


class TestCorridorPoints:
    @pytest.mark.parametrize(("origin", "destination"), [(LOS_ANGELES, NEW_YORK), (SEATTLE, MIAMI)])
    def test_coast_to_coast_stays_under_the_cap(self, origin: LatLon, destination: LatLon) -> None:
        step, points = corridor_points(lines(origin, destination))

        assert len(points) <= POINT_CAP
        assert step > 0.25  # the lattice had to step up

    def test_a_regional_trip_keeps_the_fine_lattice(self) -> None:
        step, points = corridor_points(lines(DALLAS, DENVER))

        assert step == 0.25
        assert 300 < len(points) <= POINT_CAP

    def test_points_are_within_the_buffer_of_some_route(self) -> None:
        route_lines = lines(DALLAS, DENVER)
        _, points = corridor_points(route_lines)

        # Simplification moves the line by at most ~1 km.
        assert all(
            min(distance_to_line_mi(p, line) for line in route_lines) <= BUFFER_MI + 1
            for p in points
        )
        # And the buffer is covered: every route vertex has a grid point within a cell.
        _, coarse = corridor_points(route_lines)
        for line in route_lines:
            for v in line[::25]:
                assert min(abs(p.lat - v.lat) + abs(p.lon - v.lon) for p in coarse) <= 0.25

    def test_points_sit_on_the_global_lattice(self) -> None:
        step, points = corridor_points(lines(DALLAS, DENVER))

        for p in points:
            assert round(p.lat / step, 6) == round(p.lat / step)
            assert round(p.lon / step, 6) == round(p.lon / step)

    def test_cap_steps_the_lattice_up(self) -> None:
        step, points = corridor_points(lines(DALLAS, DENVER), cap=200)

        assert step == 0.5 and len(points) <= 200


class TestCorridorGrid:
    def test_shape_and_hours_from_now(self) -> None:
        grid = corridor_grid(
            lines(DALLAS, DENVER), 42_000, store(FakeWeather(anchor=NOW)), lambda: NOW
        )

        assert grid.hours == HOURS == 49
        assert grid.start_hour == datetime(2026, 10, 12, 11, tzinfo=UTC)  # the hour in progress
        assert len(grid.risk) == len(grid.points)
        assert all(len(row) == HOURS for row in grid.risk)
        assert grid.cell_deg == 0.25
        assert not grid.stale and grid.forecast_as_of == NOW

    def test_one_batched_weather_call(self) -> None:
        weather = StripedWeather()
        corridor_grid(lines(DALLAS, DENVER), 42_000, store(weather), lambda: NOW)

        assert weather.calls == 1

    def test_every_point_hour_uses_classify_with_the_load(self) -> None:
        weather = StripedWeather()
        for load in (20_000, 35_000, 45_000):
            grid = corridor_grid(lines(DALLAS, DENVER), load, store(weather), lambda: NOW)
            for p, row in list(zip(grid.points, grid.risk, strict=True))[::37]:
                for h, level in enumerate(row):
                    expected = classify(
                        weather.forecast(p, grid.start_hour + timedelta(hours=h)), load
                    )
                    assert level == expected.level

    def test_each_conditions_levels_are_the_ratings_own(self) -> None:
        weather = StripedWeather()
        grid = corridor_grid(lines(DALLAS, DENVER), 45_000, store(weather), lambda: NOW)

        assert len(grid.wind) == len(grid.rain) == len(grid.snow) == len(grid.points)
        for i in range(0, len(grid.points), 37):
            for h in range(grid.hours):
                rating = classify(
                    weather.forecast(grid.points[i], grid.start_hour + timedelta(hours=h)),
                    45_000,
                )
                assert grid.wind[i][h] == rating.wind_adjusted  # after the load rules
                assert grid.rain[i][h] == rating.rain
                assert grid.snow[i][h] == rating.snow

    def test_load_rules_change_the_grid(self) -> None:
        weather = StripedWeather()
        light = corridor_grid(lines(DALLAS, DENVER), 20_000, store(weather), lambda: NOW)
        heavy = corridor_grid(lines(DALLAS, DENVER), 45_000, store(weather), lambda: NOW)

        def count(grid: object, level: Level) -> int:
            return sum(row.count(level) for row in grid.risk)  # type: ignore[attr-defined]

        # 54 mph gusts: Severe at 20,000 lb, No Travel over 30,000 lb.
        assert count(heavy, Level.NO_TRAVEL) > count(light, Level.NO_TRAVEL)

    def test_missing_points_are_unknown(self) -> None:
        class Gappy(StripedWeather):
            def hourly(
                self, points: Sequence[LatLon], start: datetime, hours: int
            ) -> list[ForecastSeries | None]:
                out = super().hourly(points, start, hours)
                return [None if p.lat > 37 else s for p, s in zip(points, out, strict=True)]

        grid = corridor_grid(lines(DALLAS, DENVER), 42_000, store(Gappy()), lambda: NOW)

        for p, row in zip(grid.points, grid.risk, strict=True):
            assert all(level is None for level in row) == (p.lat > 37)

    def test_stale_forecasts_are_flagged(self) -> None:
        weather = StripedWeather()
        corridor_grid(lines(DALLAS, DENVER), 42_000, store(weather), lambda: NOW)
        later = NOW + timedelta(hours=1)
        weather.down = True

        grid = corridor_grid(lines(DALLAS, DENVER), 42_000, store(weather, later), lambda: later)

        assert grid.stale and grid.forecast_as_of == NOW


def test_a_grid_point_on_a_checkpoint_has_the_checkpoints_level() -> None:
    # Ends on lattice points, so the first and last checkpoints sit exactly
    # on grid points; departing now puts the first checkpoint in hour 0.
    origin, destination = LatLon(35.0, -100.0), LatLon(35.0, -96.0)
    weather = StripedWeather()
    s = store(weather)
    providers = Providers(FakeRouting(), weather, FakeGeocoder(), demo=True)
    request = PlanRequest(Place("A", origin, None), Place("B", destination, None), NOW, 42_000, 25)
    plan = plan_trip(request, providers, s, clock=lambda: NOW)
    grid = corridor_grid([r.route.geometry for r in plan.routes], 42_000, s, lambda: NOW)
    index = {p: i for i, p in enumerate(grid.points)}

    checked = 0
    for route in plan.routes:
        for cp in (route.checkpoints[0], route.checkpoints[-1]):
            hour = int((cp.forecast.valid_hour - grid.start_hour) / timedelta(hours=1))  # type: ignore[union-attr]
            if cp.position in index and 0 <= hour < grid.hours:
                assert grid.risk[index[cp.position]][hour] == cp.risk.level
                checked += 1
    assert checked >= 2  # the shared origin, at least; the destination too if within 48 h


def test_payload_for_about_600_points_is_under_20_kb_gzipped() -> None:
    grid = corridor_grid(
        lines(DALLAS, DENVER), 42_000, store(FakeWeather("strong", anchor=NOW)), lambda: NOW
    )
    payload = json.dumps(HeatmapSerializer(grid).data, separators=(",", ":")).encode()

    assert 550 <= len(grid.points) <= POINT_CAP
    assert len(gzip.compress(payload)) < 20_000


def test_serialized_shape() -> None:
    grid = corridor_grid(lines(DALLAS, DENVER), 42_000, store(StripedWeather()), lambda: NOW)
    data = HeatmapSerializer(grid).data

    assert data["start_hour"] == "2026-10-12T11:00:00Z"
    assert data["hours"] == 49 and data["cell_deg"] == 0.25
    lon, lat = data["points"][0]
    assert -106 < lon < -96 and 31 < lat < 41
    assert set(data["risk"][0]) <= {0, 1, 2, 3, 4}
    assert "metrics" not in data


def test_serialized_metrics_only_when_asked_for() -> None:
    grid = corridor_grid(lines(DALLAS, DENVER), 42_000, store(StripedWeather()), lambda: NOW)
    data = HeatmapSerializer(grid, context={"include_metrics": True}).data

    assert set(data["metrics"]) == {"wind", "rain", "snow"}
    for rows in data["metrics"].values():
        assert len(rows) == len(data["points"])
        assert all(len(row) == 49 for row in rows)
        assert {v for row in rows for v in row} <= {None, 0, 1, 2, 3, 4}


def test_coast_to_coast_grid_is_quick_with_cached_forecasts() -> None:
    weather = StripedWeather()
    s = store(weather)
    corridor_grid(lines(LOS_ANGELES, NEW_YORK), 42_000, s, lambda: NOW)

    started = time.perf_counter()
    corridor_grid(lines(LOS_ANGELES, NEW_YORK), 42_000, s, lambda: NOW)

    assert weather.calls == 1
    assert time.perf_counter() - started < 1.5
