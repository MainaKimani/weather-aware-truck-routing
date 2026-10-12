import io
import json
import logging
import sys
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import pytest
import respx
from django.test import Client

from config.observability import JsonFormatter, RequestIdFilter, request_id
from planner.api import views
from planner.domain.types import LatLon
from planner.providers.base import WeatherUnavailable
from planner.providers.fakes import FakeGeocoder, FakeRouting
from planner.providers.open_meteo import FORECAST_URL, OpenMeteoWeather
from planner.providers.registry import Providers


class LogLines(list[dict[str, Any]]):
    """Log lines as the production handler formats them, parsed on access."""

    def __init__(self, stream: io.StringIO) -> None:
        super().__init__()
        self.stream = stream

    def refresh(self) -> "LogLines":
        self[:] = [json.loads(line) for line in self.stream.getvalue().splitlines()]
        return self


@pytest.fixture
def logs() -> Iterator[LogLines]:
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.addFilter(RequestIdFilter())
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    old_level = root.level
    root.addHandler(handler)
    root.setLevel(logging.INFO)
    yield LogLines(stream)
    root.removeHandler(handler)
    root.setLevel(old_level)


def open_meteo_response(request: httpx.Request) -> httpx.Response:
    """A valid answer for however many points were asked for: calm weather."""
    params = request.url.params
    lats = params["latitude"].split(",")
    start = datetime.strptime(params["start_hour"], "%Y-%m-%dT%H:%M").replace(tzinfo=UTC)
    end = datetime.strptime(params["end_hour"], "%Y-%m-%dT%H:%M").replace(tzinfo=UTC)
    n = int((end - start) / timedelta(hours=1)) + 1
    times = [int((start + timedelta(hours=h)).timestamp()) for h in range(n)]
    location = {
        "hourly_units": {
            "time": "unixtime",
            "wind_speed_10m": "km/h",
            "wind_gusts_10m": "km/h",
            "rain": "mm",
            "showers": "mm",
            "snowfall": "cm",
        },
        "hourly": {
            "time": times,
            "wind_speed_10m": [10.0] * n,
            "wind_gusts_10m": [20.0] * n,
            "rain": [0.0] * n,
            "showers": [0.0] * n,
            "snowfall": [0.0] * n,
            "weather_code": [1] * n,
        },
    }
    return httpx.Response(200, json=[location] * len(lats))


def plan_body() -> dict[str, Any]:
    return {
        "origin": {"lat": 32.7767, "lon": -96.7970, "label": "Dallas, TX"},
        "destination": {"lat": 39.7392, "lon": -104.9903, "label": "Denver, CO"},
        "departure": (datetime.now(UTC) + timedelta(hours=1)).isoformat(),
        "load_lb": 42_000,
        "interval_mi": 10,  # ~250 forecast points: three parallel Open-Meteo batches
    }


@respx.mock
def test_a_plans_log_lines_share_its_request_id(
    client: Client, monkeypatch: pytest.MonkeyPatch, logs: LogLines
) -> None:
    route = respx.get(FORECAST_URL).mock(side_effect=open_meteo_response)
    providers = Providers(FakeRouting(), OpenMeteoWeather(), FakeGeocoder(), demo=False)
    monkeypatch.setattr(views, "get_providers", lambda: providers)

    response = client.post("/api/v1/plans", plan_body(), content_type="application/json")

    assert response.status_code == 200, response.content
    assert route.call_count >= 3
    rid = response["X-Request-ID"]
    log_lines = logs.refresh()
    lines = [line for line in log_lines if line["request_id"] == rid]
    by_logger: dict[str, list[dict[str, Any]]] = {}
    for line in lines:
        by_logger.setdefault(line["logger"], []).append(line)

    provider_calls = by_logger["planner.providers"]
    assert len(provider_calls) == route.call_count  # every call, from every worker thread
    assert all(c["provider"] == "Open-Meteo" and c["outcome"] == "ok" for c in provider_calls)
    (summary,) = by_logger["planner.plan"]
    assert summary["event"] == "plan"
    assert summary["routes"] == 3 and summary["checkpoints"] > 200
    assert summary["cache_hit_ratio"] == 0.0 and summary["stale"] is False
    assert {"routing_ms", "weather_ms", "total_ms", "forecast_points"} <= set(summary)
    (access,) = by_logger["http"]
    assert access["status"] == 200 and access["path"] == "/api/v1/plans"
    # No line from this request is missing its id.
    assert not [
        line
        for line in log_lines
        if line["logger"].startswith("planner") and line["request_id"] is None
    ]


def test_second_plan_reports_cache_hits(client: Client, logs: LogLines) -> None:
    for _ in range(2):
        client.post("/api/v1/plans", plan_body(), content_type="application/json")

    ratios = [line["cache_hit_ratio"] for line in logs.refresh() if line.get("event") == "plan"]

    assert ratios == [0.0, 1.0]


def test_incoming_request_id_is_kept(client: Client) -> None:
    response = client.get("/healthz", HTTP_X_REQUEST_ID="edge-1234abcd")

    assert response["X-Request-ID"] == "edge-1234abcd"


@pytest.mark.parametrize("bad", ["", "short", "has spaces in it", "x" * 65, "evil\nnewline-0000"])
def test_unusable_request_ids_are_replaced(client: Client, bad: str) -> None:
    response = client.get("/healthz", HTTP_X_REQUEST_ID=bad)

    assert response["X-Request-ID"] != bad
    assert len(response["X-Request-ID"]) == 32


def test_each_request_gets_its_own_id(client: Client) -> None:
    ids = {client.get("/healthz")["X-Request-ID"] for _ in range(3)}

    assert len(ids) == 3
    assert request_id.get() is None  # reset after each request


def test_provider_failures_are_logged_without_query_strings(
    logs: LogLines,
) -> None:

    with respx.mock:
        respx.get(FORECAST_URL).mock(return_value=httpx.Response(503))
        with pytest.raises(WeatherUnavailable):
            OpenMeteoWeather().hourly([LatLon(32.8, -96.8)], datetime.now(UTC), 2)

    (line,) = [entry for entry in logs.refresh() if entry["logger"] == "planner.providers"]
    assert line["level"] == "WARNING"
    assert line["outcome"] == "error" and line["status"] == 503 and line["attempts"] == 2
    assert "latitude" not in json.dumps(line)


def test_json_lines_carry_extras_and_exceptions() -> None:
    formatter = JsonFormatter()
    try:
        raise ValueError("boom")
    except ValueError:
        exc_info = sys.exc_info()
    record = logging.getLogger("t").makeRecord(
        "t", logging.ERROR, __file__, 1, "failed %s", ("x",), exc_info, extra={"k": 1}
    )
    entry = json.loads(formatter.format(record))

    assert entry["message"] == "failed x" and entry["k"] == 1 and entry["level"] == "ERROR"
    assert "ValueError: boom" in entry["exc"]
    assert entry["request_id"] is None


def test_httpx_does_not_log_urls_at_info() -> None:
    # HERE's API key is in the query string of every request.
    assert not logging.getLogger("httpx").isEnabledFor(logging.INFO)
    assert not logging.getLogger("httpcore").isEnabledFor(logging.INFO)
