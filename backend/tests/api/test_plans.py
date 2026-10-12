from collections.abc import Callable, Sequence
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from django.test import Client

from planner.api import views
from planner.domain.forecast import ForecastSeries
from planner.domain.polyline import decode
from planner.domain.types import LatLon, Route
from planner.providers.base import (
    NoRoute,
    ProviderError,
    RouteRequest,
    RoutingUnavailable,
    WeatherUnavailable,
)
from planner.providers.fakes import FakeGeocoder, FakeRouting, FakeWeather
from planner.providers.registry import Providers

URL = "/api/v1/plans"


def body(**overrides: Any) -> dict[str, Any]:
    data: dict[str, Any] = {
        "origin": {"lat": 32.7767, "lon": -96.7970, "label": "Dallas, TX", "tz": "America/Chicago"},
        "destination": {"lat": 39.7392, "lon": -104.9903, "label": "Denver, CO"},
        "departure": (datetime.now(UTC) + timedelta(hours=1)).isoformat(),
        "load_lb": 42_000,
        "interval_mi": 25,
    }
    data.update(overrides)
    return data


HOS = {
    "enabled": True,
    "cycle": "70h_8d",
    "drive_left_h": 11,
    "window_left_h": 14,
    "until_break_h": 8,
    "cycle_left_h": 52.5,
}


def post(client: Client, data: dict[str, Any]) -> Any:
    return client.post(URL, data, content_type="application/json")


def error(response: Any) -> dict[str, Any]:
    payload: dict[str, Any] = response.json()["error"]
    return payload


class TestPlan:
    def test_demo_plan(self, client: Client) -> None:
        response = post(client, body())

        assert response.status_code == 200
        data = response.json()
        assert data["recommended_route_id"] == "r1"
        assert data["recommendation_reason"].startswith("Fewest severe miles")
        assert data["reason_code"] == "severe"
        assert data["demo"] is True
        assert data["stale"] is False
        assert data["rules_version"]
        assert data["settings"] == {
            "wind_basis": "gust",
            "avg_risk_tolerance": 0.05,
            "hos_enabled": False,
        }
        assert data["inputs"]["hos"] is None
        # Ranked best first; ids and names follow provider order (fastest first).
        routes = sorted(data["routes"], key=lambda r: r["id"])
        assert [r["name"] for r in routes] == ["Route A", "Route B", "Route C"]
        assert [r["label"] for r in routes] == ["via Amarillo", "via Wichita", "via Lubbock"]
        assert [r["rank"] for r in data["routes"]] == [1, 2, 3]
        assert data["routes"][0]["id"] == "r1"

    def test_response_shape(self, client: Client) -> None:
        data = post(client, body()).json()
        route = data["routes"][0]

        assert set(route) == {
            "id", "rank", "name", "label", "geometry", "distance_mi", "duration_s",
            "trip_duration_s", "departure", "arrival", "eta_estimated", "hos_stops", "metrics",
            "checkpoints",
        }  # fmt: skip
        assert set(route["metrics"]["miles_by_level"]) == {
            "LOW", "MODERATE", "HIGH", "SEVERE", "NO_TRAVEL", "UNKNOWN",
        }  # fmt: skip
        cp = route["checkpoints"][1]
        assert set(cp) == {"mile", "owned_mi", "lat", "lon", "eta", "forecast", "risk"}
        assert cp["risk"]["level"] in {"LOW", "MODERATE", "HIGH", "SEVERE", "NO_TRAVEL"}
        assert cp["eta"].endswith("Z") and cp["forecast"]["valid_hour"].endswith(":00:00Z")
        line = decode(route["geometry"])
        assert line[0] == pytest.approx(LatLon(32.7767, -96.7970), abs=1e-5)
        assert line[-1] == pytest.approx(LatLon(39.7392, -104.9903), abs=1e-5)
        west, south, east, north = data["corridor"]["bbox"]
        assert west < -104.9 and east > -96.8 and south < 32.8 and north > 39.7

    def test_with_hours_of_service(self, client: Client) -> None:
        data = post(client, body(hos=HOS)).json()

        assert data["settings"]["hos_enabled"] is True
        assert data["inputs"]["hos"] == {**HOS, "drive_left_h": 11.0, "window_left_h": 14.0,
                                         "until_break_h": 8.0}  # fmt: skip
        stops = data["routes"][0]["hos_stops"]
        assert [(s["kind"], s["reason"], s["duration_s"]) for s in stops] == [
            ("break", "break", 1800),
            ("rest", "drive_limit", 36000),
        ]
        assert set(stops[0]) == {"kind", "reason", "mile", "lat", "lon", "start", "duration_s"}

    def test_hos_disabled_ignores_clocks(self, client: Client) -> None:
        data = post(client, body(hos={"enabled": False, "drive_left_h": 99})).json()

        assert data["settings"]["hos_enabled"] is False

    def test_time_zone_label_round_trips(self, client: Client) -> None:
        data = post(client, body()).json()

        assert data["inputs"]["origin"] == {
            "label": "Dallas, TX", "lat": 32.7767, "lon": -96.797, "tz": "America/Chicago",
        }  # fmt: skip
        assert data["inputs"]["destination"]["tz"] is None


def invalid(client: Client, data: dict[str, Any]) -> dict[str, Any]:
    response = post(client, data)
    assert response.status_code == 400, response.content
    e = error(response)
    assert e["code"] == "invalid_input"
    assert e["message"]
    fields: dict[str, Any] = e["fields"]
    return fields


def in_hours(h: float) -> str:
    return (datetime.now(UTC) + timedelta(hours=h)).isoformat()


class TestValidation:
    @pytest.mark.parametrize("interval", [0, 5, 20, 30, 100, "25.5", None])
    def test_interval(self, client: Client, interval: object) -> None:
        assert "interval_mi" in invalid(client, body(interval_mi=interval))

    @pytest.mark.parametrize("interval", [10, 25, 50])
    def test_allowed_intervals(self, client: Client, interval: int) -> None:
        assert post(client, body(interval_mi=interval)).status_code == 200

    @pytest.mark.parametrize("load", [0, -1, 80_001, 1.5, "heavy"])
    def test_weight(self, client: Client, load: object) -> None:
        assert "load_lb" in invalid(client, body(load_lb=load))

    @pytest.mark.parametrize("load", [1, 80_000])
    def test_weight_bounds(self, client: Client, load: int) -> None:
        assert post(client, body(load_lb=load)).status_code == 200

    @pytest.mark.parametrize(
        "departure",
        [in_hours(-1), in_hours(24 * 7 + 1), "2026-10-12T06:00:00", "tomorrow", ""],
    )
    def test_departure(self, client: Client, departure: str) -> None:
        assert "departure" in invalid(client, body(departure=departure))

    def test_departure_a_few_minutes_ago_is_allowed(self, client: Client) -> None:
        assert post(client, body(departure=in_hours(-0.1))).status_code == 200

    def test_naive_departure_message_asks_for_an_offset(self, client: Client) -> None:
        fields = invalid(client, body(departure="2026-10-12T06:00:00"))

        assert "UTC offset" in fields["departure"][0]

    def test_identical_origin_and_destination(self, client: Client) -> None:
        same = body()["origin"]
        fields = invalid(client, body(destination={**same, "label": "Dallas again"}))

        assert "destination" in fields

    def test_points_under_a_mile_apart(self, client: Client) -> None:
        near = {"lat": 32.7807, "lon": -96.7970, "label": "Near Dallas"}  # ~0.3 mi north
        assert "destination" in invalid(client, body(destination=near))

    @pytest.mark.parametrize(
        ("place", "field"),
        [
            ({"lat": 91, "lon": 0, "label": "x"}, "origin.lat"),
            ({"lat": 0, "lon": -181, "label": "x"}, "origin.lon"),
            ({"lat": 0, "lon": 0}, "origin.label"),
            ({"lat": 0, "lon": 0, "label": "x", "tz": "Mars/Olympus"}, "origin.tz"),
        ],
    )
    def test_place_fields_are_named(
        self, client: Client, place: dict[str, Any], field: str
    ) -> None:
        assert field in invalid(client, body(origin=place))

    def test_missing_fields(self, client: Client) -> None:
        fields = invalid(client, {})

        assert set(fields) == {"origin", "destination", "departure", "load_lb", "interval_mi"}

    def test_not_json(self, client: Client) -> None:
        response = client.post(URL, "{nope", content_type="application/json")

        assert response.status_code == 400
        assert error(response)["code"] == "invalid_input"


class TestHosValidation:
    @pytest.mark.parametrize(
        "missing", ["cycle", "drive_left_h", "window_left_h", "until_break_h", "cycle_left_h"]
    )
    def test_clocks_required_when_enabled(self, client: Client, missing: str) -> None:
        hos = {k: v for k, v in HOS.items() if k != missing}
        assert f"hos.{missing}" in invalid(client, body(hos=hos))

    @pytest.mark.parametrize(
        ("field", "value"),
        [
            ("drive_left_h", 11.01),
            ("window_left_h", 14.5),
            ("until_break_h", 8.25),
            ("cycle_left_h", 70.5),
            ("drive_left_h", -1),
            ("cycle_left_h", 1.234),  # more than 2 decimals
            ("cycle", "80h_8d"),
        ],
    )
    def test_limits(self, client: Client, field: str, value: object) -> None:
        hos = {**HOS, field: value}
        assert f"hos.{field}" in invalid(client, body(hos=hos))

    def test_sixty_hour_cycle_limit(self, client: Client) -> None:
        hos = {**HOS, "cycle": "60h_7d", "cycle_left_h": 60.5}
        assert "hos.cycle_left_h" in invalid(client, body(hos=hos))

        hos = {**HOS, "cycle": "60h_7d", "cycle_left_h": 60}
        assert post(client, body(hos=hos)).status_code == 200

    @pytest.mark.parametrize(("window", "cycle"), [(10, 52.5), (14, 9.5)])
    def test_drive_left_cannot_exceed_window_or_cycle(
        self, client: Client, window: float, cycle: float
    ) -> None:
        hos = {**HOS, "drive_left_h": 11, "window_left_h": window, "cycle_left_h": cycle}
        assert "hos.drive_left_h" in invalid(client, body(hos=hos))

    def test_hours_become_whole_seconds(self, client: Client) -> None:
        hos = {**HOS, "drive_left_h": 2.25, "until_break_h": 0.5}
        data = post(client, body(hos=hos)).json()

        assert data["inputs"]["hos"]["drive_left_h"] == 2.25
        # 2 h 15 min of driving before the first rest; a break after 30 min.
        stops = data["routes"][0]["hos_stops"]
        assert stops[0]["kind"] == "break"
        assert stops[1]["kind"] == "rest"


def failing(**providers: Callable[..., object]) -> Callable[[], Providers]:
    def get() -> Providers:
        base = Providers(FakeRouting(), FakeWeather(), FakeGeocoder(), demo=True)
        return Providers(
            providers.get("routing", lambda: base.routing)(),  # type: ignore[arg-type]
            providers.get("weather", lambda: base.weather)(),  # type: ignore[arg-type]
            base.geocoder,
            demo=True,
        )

    return get


class Raises:
    def __init__(self, exc: ProviderError) -> None:
        self.exc = exc

    def routes(self, request: RouteRequest, alternatives: int) -> list[Route]:
        raise self.exc

    def hourly(
        self, points: Sequence[LatLon], start: datetime, hours: int
    ) -> list[ForecastSeries | None]:
        raise self.exc


class TestProviderErrors:
    @pytest.mark.parametrize(
        ("kind", "exc", "status", "code"),
        [
            ("routing", NoRoute("no route"), 422, "no_route"),
            ("routing", RoutingUnavailable("HERE: HTTP 503"), 502, "routing_unavailable"),
            ("weather", WeatherUnavailable("Open-Meteo: timed out"), 502, "weather_unavailable"),
        ],
    )
    def test_mapped_to_status_and_code(
        self,
        client: Client,
        monkeypatch: pytest.MonkeyPatch,
        kind: str,
        exc: ProviderError,
        status: int,
        code: str,
    ) -> None:
        monkeypatch.setattr(views, "get_providers", failing(**{kind: lambda: Raises(exc)}))

        response = post(client, body())

        assert response.status_code == status
        assert error(response)["code"] == code
        assert "fields" not in error(response)
        # The provider's own message stays in the logs.
        assert "HTTP" not in error(response)["message"]
        assert "timed out" not in error(response)["message"]


def test_wrong_method_uses_the_error_shape(client: Client) -> None:
    response = client.get(URL)

    assert response.status_code == 405
    assert error(response)["code"] == "method_not_allowed"


def test_unknown_api_path_is_a_404(client: Client) -> None:
    assert client.get("/api/v1/nope").status_code == 404


def test_hos_enabled_must_be_a_boolean(client: Client) -> None:
    assert "hos.enabled" in invalid(client, body(hos={**HOS, "enabled": "maybe"}))
