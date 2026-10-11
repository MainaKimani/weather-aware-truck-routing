from datetime import UTC, datetime, timedelta

import pytest
from django.core.exceptions import ImproperlyConfigured
from django.test import override_settings

from planner.domain.geo import haversine_mi
from planner.domain.types import LatLon
from planner.providers.base import NoRoute, RouteRequest
from planner.providers.fakes import DALLAS, DENVER, FakeGeocoder, FakeRouting, FakeWeather
from planner.providers.registry import get_providers
from tests.pipeline import evaluate

ANCHOR = datetime(2026, 10, 12, 6, tzinfo=UTC)
DEPARTURE = ANCHOR + timedelta(minutes=17)


def dallas_denver(load: int = 42_000) -> RouteRequest:
    return RouteRequest(DALLAS, DENVER, DEPARTURE, load)


class TestFakeRouting:
    def test_three_scripted_routes_fastest_first(self) -> None:
        routes = FakeRouting().routes(dallas_denver(), alternatives=3)

        assert [r.label for r in routes] == ["via Amarillo", "via Wichita", "via Lubbock"]
        assert [r.duration_s for r in routes] == sorted(r.duration_s for r in routes)
        for r in routes:
            assert r.geometry[0] == DALLAS
            assert r.geometry[-1] == DENVER
            assert sum(s.length_mi for s in r.spans) == pytest.approx(r.distance_mi)
            assert 700 < r.distance_mi < 900

    def test_alternatives_limit(self) -> None:
        assert len(FakeRouting().routes(dallas_denver(), alternatives=1)) == 2

    def test_any_other_pair_gets_three_distinct_routes(self) -> None:
        chicago, memphis = LatLon(41.8781, -87.6298), LatLon(35.1495, -90.0490)

        routes = FakeRouting().routes(RouteRequest(chicago, memphis, DEPARTURE, 30_000), 3)

        assert len(routes) == 3
        midpoints = [r.geometry[len(r.geometry) // 2] for r in routes]
        assert min(haversine_mi(a, b) for a in midpoints for b in midpoints if a != b) > 30

    def test_via_points_are_followed(self) -> None:
        via = LatLon(36.0, -100.0)

        (route,) = FakeRouting().routes(
            RouteRequest(DALLAS, DENVER, DEPARTURE, 1, via=(via,)), alternatives=3
        )

        assert min(haversine_mi(p, via) for p in route.geometry) < 0.01

    def test_same_place_has_no_route(self) -> None:
        with pytest.raises(NoRoute):
            FakeRouting().routes(RouteRequest(DALLAS, DALLAS, DEPARTURE, 1), 3)

    def test_records_requests(self) -> None:
        fake = FakeRouting()
        fake.routes(dallas_denver(load=12_345), 3)

        assert fake.calls[0].load_lb == 12_345


class TestFakeWeather:
    def test_deterministic(self) -> None:
        a = FakeWeather(anchor=ANCHOR).hourly([DALLAS], ANCHOR, 5)
        b = FakeWeather(anchor=ANCHOR).hourly([DALLAS], ANCHOR, 5)

        assert a == b

    def test_series_shape(self) -> None:
        (series,) = FakeWeather(anchor=ANCHOR).hourly([DALLAS], ANCHOR + timedelta(minutes=5), 49)

        assert series is not None
        assert series.start == ANCHOR
        assert len(series.hours) == 49

    def test_storm_over_wichita_and_calm_at_amarillo(self) -> None:
        w = FakeWeather(anchor=ANCHOR)
        wichita, amarillo = LatLon(37.69, -97.34), LatLon(35.222, -101.8313)

        stormy = w.forecast(wichita, ANCHOR)
        calm = w.forecast(amarillo, ANCHOR)

        assert stormy.rain_in_hr is not None
        assert stormy.rain_in_hr >= 0.5
        assert calm.rain_in_hr is not None
        assert calm.rain_in_hr < 0.1

    def test_storms_move_over_time(self) -> None:
        w = FakeWeather(anchor=ANCHOR)
        near = LatLon(37.69, -97.0)

        values = {w.forecast(near, ANCHOR + timedelta(hours=h)).rain_in_hr for h in range(0, 18, 3)}

        assert len(values) > 1

    def test_counts_calls(self) -> None:
        w = FakeWeather(anchor=ANCHOR)
        w.hourly([DALLAS, DENVER], ANCHOR, 2)

        assert w.calls == 1


class TestDemoScenarios:
    @pytest.mark.parametrize("offset_h", [0, 7, 19, 36])
    @pytest.mark.parametrize("interval", [10, 25, 50])
    def test_demo_recommends_route_a_for_fewest_severe_miles(
        self, offset_h: int, interval: int
    ) -> None:
        departure = DEPARTURE + timedelta(hours=offset_h)
        routes = FakeRouting().routes(dallas_denver(), 3)

        ranking = evaluate(routes, FakeWeather("demo", anchor=ANCHOR), departure, 42_000, interval)

        assert ranking.recommended_id == "via Amarillo"
        assert ranking.reason_code == "severe"
        assert ranking.reason.startswith("Fewest severe miles (0 vs ")
        assert all(c.metrics.drivable for c in ranking.ranked)

    @pytest.mark.parametrize("load", [1, 42_000, 80_000])
    def test_strong_scenario_makes_route_b_not_drivable(self, load: int) -> None:
        routes = FakeRouting().routes(dallas_denver(load), 3)

        ranking = evaluate(routes, FakeWeather("strong", anchor=ANCHOR), DEPARTURE, load)

        by_id = {c.route_id: c for c in ranking.ranked}
        assert not by_id["via Wichita"].metrics.drivable
        assert ranking.ranked[-1].route_id == "via Wichita"
        assert ranking.recommended_id == "via Amarillo"


class TestFakeGeocoder:
    def test_prefix_match_first(self) -> None:
        (first, *_) = FakeGeocoder().suggest("dall")

        assert first.label == "Dallas, TX"
        assert first.tz == "America/Chicago"

    def test_substring_and_limit(self) -> None:
        assert [p.label for p in FakeGeocoder().suggest("city", limit=2)] == [
            "Oklahoma City, OK",
            "Kansas City, MO",
        ]

    def test_short_query_returns_nothing(self) -> None:
        assert FakeGeocoder().suggest("d") == []


class TestRegistry:
    def test_fake_mode_needs_no_keys_and_flags_demo(self) -> None:
        with override_settings(PROVIDERS="fake", HERE_API_KEY=""):
            providers = get_providers()

        assert providers.demo
        assert isinstance(providers.routing, FakeRouting)

    def test_scenario_setting(self) -> None:
        with override_settings(PROVIDERS="fake", FAKE_SCENARIO="strong"):
            weather = get_providers().weather

        assert isinstance(weather, FakeWeather)
        assert weather.cells[0].gust_mph == 62

    @pytest.mark.parametrize(("mode", "scenario"), [("bogus", "demo"), ("fake", "bogus")])
    def test_rejects_unknown_values(self, mode: str, scenario: str) -> None:
        with (
            override_settings(PROVIDERS=mode, FAKE_SCENARIO=scenario),
            pytest.raises(ImproperlyConfigured),
        ):
            get_providers()


class TestRealRegistry:
    def test_real_mode_uses_here_and_open_meteo(self) -> None:
        with override_settings(PROVIDERS="real", HERE_API_KEY="k"):
            providers = get_providers()

        assert not providers.demo
        assert type(providers.routing).__name__ == "HereRouting"
        assert type(providers.weather).__name__ == "OpenMeteoWeather"
        assert type(providers.geocoder).__name__ == "HereGeocoder"

    def test_real_mode_without_key(self) -> None:
        with (
            override_settings(PROVIDERS="real", HERE_API_KEY=""),
            pytest.raises(ImproperlyConfigured, match="HERE_API_KEY"),
        ):
            get_providers()
