import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlsplit

import httpx
import pytest
import respx

from planner.domain.geo import haversine_mi
from planner.domain.types import LatLon
from planner.providers.base import NoRoute, RouteRequest, RoutingUnavailable
from planner.providers.fakes import DALLAS, DENVER
from planner.providers.here import ROUTES_URL, HereRouting, parse_routes

FIXTURE = Path(__file__).parent / "fixtures" / "here_routes_dallas_denver.json"
DEPARTURE = datetime(2026, 10, 12, 11, 0, tzinfo=UTC)


def body() -> dict[str, Any]:
    data: dict[str, Any] = json.loads(FIXTURE.read_text())
    return data


def request(load_lb: int = 42_000, via: tuple[LatLon, ...] = ()) -> RouteRequest:
    return RouteRequest(DALLAS, DENVER, DEPARTURE, load_lb, via)


def sent_params(call: respx.models.Call) -> dict[str, list[str]]:
    return parse_qs(urlsplit(str(call.request.url)).query)


@pytest.fixture
def here() -> HereRouting:
    return HereRouting("test-key")


class TestRequest:
    @respx.mock
    def test_truck_request_parameters(self, here: HereRouting) -> None:
        route = respx.get(ROUTES_URL).mock(return_value=httpx.Response(200, json=body()))

        here.routes(request(), alternatives=4)

        params = sent_params(route.calls.last)
        assert params["transportMode"] == ["truck"]
        assert params["origin"] == ["32.776700,-96.797000"]
        assert params["destination"] == ["39.739200,-104.990300"]
        assert params["departureTime"] == ["2026-10-12T11:00:00+00:00"]
        assert params["alternatives"] == ["4"]
        assert params["return"] == ["polyline,summary,routeLabels"]
        assert params["spans"] == ["dynamicSpeedInfo,length,duration"]
        assert params["apiKey"] == ["test-key"]
        assert "via" not in params

    @respx.mock
    @pytest.mark.parametrize(("load_lb", "kg"), [(42_000, "19051"), (80_000, "36287"), (1, "0")])
    def test_load_weight_is_sent_in_kg(self, here: HereRouting, load_lb: int, kg: str) -> None:
        route = respx.get(ROUTES_URL).mock(return_value=httpx.Response(200, json=body()))

        here.routes(request(load_lb), 4)

        assert sent_params(route.calls.last)["vehicle[grossWeight]"] == [kg]

    @respx.mock
    def test_via_points_pass_through(self, here: HereRouting) -> None:
        route = respx.get(ROUTES_URL).mock(return_value=httpx.Response(200, json=body()))

        here.routes(request(via=(LatLon(36.5, -100.25),)), 0)

        assert sent_params(route.calls.last)["via"] == ["36.500000,-100.250000!passThrough=true"]

    def test_requires_a_key(self) -> None:
        with pytest.raises(ValueError, match="HERE_API_KEY"):
            HereRouting("")


class TestParse:
    def test_routes_fastest_first_with_geometry_distance_and_spans(self) -> None:
        routes = parse_routes(body())

        assert len(routes) == 3
        assert [r.duration_s for r in routes] == sorted(r.duration_s for r in routes)
        for r in routes:
            assert haversine_mi(r.geometry[0], DALLAS) < 0.01
            assert haversine_mi(r.geometry[-1], DENVER) < 0.01
            assert 700 < r.distance_mi < 900
            assert len(r.spans) == 6
            assert sum(s.length_mi for s in r.spans) == pytest.approx(r.distance_mi, abs=0.01)
            assert sum(s.duration_s for s in r.spans) == pytest.approx(r.duration_s)

    def test_labels_from_route_labels(self) -> None:
        assert [r.label for r in parse_routes(body())] == [
            "via US-287, I-25",
            "via I-35, I-70",
            "via US-84, US-87",
        ]

    def test_sections_are_joined_without_repeating_the_join_point(self) -> None:
        raw = body()
        two_sections = next(r for r in raw["routes"] if len(r["sections"]) == 2)
        raw["routes"] = [two_sections]

        (route,) = parse_routes(raw)

        assert all(a != b for a, b in zip(route.geometry, route.geometry[1:], strict=False))
        summary_m = sum(s["summary"]["length"] for s in two_sections["sections"])
        assert route.distance_mi == pytest.approx(summary_m / 1609.344)

    def test_section_without_spans_becomes_one_span(self) -> None:
        raw = body()
        one_section = next(r for r in raw["routes"] if len(r["sections"]) == 1)
        del one_section["sections"][0]["spans"]
        raw["routes"] = [one_section]

        (route,) = parse_routes(raw)

        assert len(route.spans) == 1
        assert route.spans[0].duration_s == route.duration_s
        assert route.spans[0].length_mi == pytest.approx(route.distance_mi)

    def test_no_routes_is_no_route_with_heres_reason(self) -> None:
        raw = {"routes": [], "notices": [{"title": "Route calculation failed", "code": "noRoute"}]}

        with pytest.raises(NoRoute, match="Route calculation failed"):
            parse_routes(raw)

    @pytest.mark.parametrize(
        "mutate",
        [
            lambda r: r["sections"][0].pop("polyline"),
            lambda r: r["sections"][0]["summary"].pop("duration"),
            lambda r: r["sections"][0].__setitem__("polyline", "not-a-polyline"),
            lambda r: r.__setitem__("sections", []),
        ],
        ids=["no geometry", "no duration", "bad polyline", "no sections"],
    )
    def test_malformed_route_is_an_error_not_a_zero_route(self, mutate: Any) -> None:
        raw = body()
        mutate(raw["routes"][0])

        with pytest.raises(RoutingUnavailable, match="malformed"):
            parse_routes(raw)

    @pytest.mark.parametrize("raw", [[], {"nope": 1}, "text"])
    def test_unexpected_body(self, raw: Any) -> None:
        with pytest.raises(RoutingUnavailable):
            parse_routes(raw)


class TestFailures:
    @respx.mock
    @pytest.mark.parametrize("status", [401, 429, 500, 503])
    def test_http_errors_are_routing_unavailable(self, here: HereRouting, status: int) -> None:
        respx.get(ROUTES_URL).mock(return_value=httpx.Response(status, json={}))

        with pytest.raises(RoutingUnavailable, match=f"HTTP {status}"):
            here.routes(request(), 4)

    @respx.mock
    def test_timeout_is_routing_unavailable(self, here: HereRouting) -> None:
        respx.get(ROUTES_URL).mock(side_effect=httpx.ConnectTimeout("slow"))

        with pytest.raises(RoutingUnavailable, match="timed out"):
            here.routes(request(), 4)

    @respx.mock
    def test_non_json_body(self, here: HereRouting) -> None:
        respx.get(ROUTES_URL).mock(return_value=httpx.Response(200, text="<html>"))

        with pytest.raises(RoutingUnavailable, match="not JSON"):
            here.routes(request(), 4)
