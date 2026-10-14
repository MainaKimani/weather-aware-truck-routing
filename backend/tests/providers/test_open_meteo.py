import copy
import json
import re
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlsplit

import httpx
import pytest
import respx

from planner.domain.risk import classify
from planner.domain.types import LatLon
from planner.providers.base import WeatherBusy, WeatherUnavailable
from planner.providers.open_meteo import FORECAST_URL, OpenMeteoWeather, parse_forecasts
from planner.providers.rate_budget import RateBudget

# Recorded from api.open-meteo.com: Dallas, Wichita, Denver; 6 hours.
FIXTURE = Path(__file__).parent / "fixtures" / "open_meteo_3_points.json"
POINTS = [LatLon(32.7767, -96.797), LatLon(37.6872, -97.3301), LatLon(39.7392, -104.9903)]


def body() -> list[dict[str, Any]]:
    data: list[dict[str, Any]] = json.loads(FIXTURE.read_text())
    return data


START = datetime.fromtimestamp(body()[0]["hourly"]["time"][0], UTC)


class TestParse:
    def test_one_series_per_point_covering_the_hours(self) -> None:
        series = parse_forecasts(body(), 3, START, 6)

        assert len(series) == 3
        for s in series:
            assert s is not None
            assert s.start == START
            assert len(s.hours) == 6

    def test_converts_units_with_known_values(self) -> None:
        raw = body()
        h = raw[0]["hourly"]
        h["wind_gusts_10m"][0], h["wind_speed_10m"][0] = 80.4672, 40.2336  # 50 and 25 mph
        h["rain"][0], h["showers"][0] = 10.0, 2.7  # 12.7 mm = 0.5 in
        h["snowfall"][0] = 5.08  # cm = 2 in

        (first, *_) = parse_forecasts(raw, 3, START, 6)

        assert first is not None
        f = first.hours[0]
        assert f.gust_mph == pytest.approx(50.0)
        assert f.wind_mph == pytest.approx(25.0)
        assert f.rain_in_hr == pytest.approx(0.5)
        assert f.snow_in_hr == pytest.approx(2.0)
        assert f.valid_hour == START

    def test_null_gust_is_unknown_downstream_never_low(self) -> None:
        raw = body()
        raw[1]["hourly"]["wind_gusts_10m"][2] = None

        series = parse_forecasts(raw, 3, START, 6)[1]

        assert series is not None
        forecast = series.hours[2]
        assert forecast.gust_mph is None
        assert classify(forecast, 42_000).level is None

    def test_missing_showers_makes_rain_missing(self) -> None:
        raw = body()
        raw[0]["hourly"]["showers"][0] = None

        series = parse_forecasts(raw, 3, START, 6)[0]

        assert series is not None
        assert series.hours[0].rain_in_hr is None

    def test_hours_outside_the_response_are_missing(self) -> None:
        (first, *_) = parse_forecasts(body(), 3, START, 8)

        assert first is not None
        assert len(first.hours) == 8
        assert first.hours[5].gust_mph is not None
        assert first.hours[6].gust_mph is None
        assert first.hours[7].rain_in_hr is None
        assert classify(first.hours[7], 1).level is None

    def test_single_location_comes_back_as_an_object(self) -> None:
        (series,) = parse_forecasts(body()[0], 1, START, 6)

        assert series is not None

    def test_wrong_location_count(self) -> None:
        with pytest.raises(WeatherUnavailable, match="asked for 4"):
            parse_forecasts(body(), 4, START, 6)

    def test_changed_units_fail_loudly(self) -> None:
        raw = body()
        raw[0]["hourly_units"]["wind_gusts_10m"] = "mph"

        with pytest.raises(WeatherUnavailable, match="wind_gusts_10m in km/h"):
            parse_forecasts(raw, 3, START, 6)

    def test_location_without_hourly_data_is_none(self) -> None:
        raw = body()
        del raw[2]["hourly"]

        assert parse_forecasts(raw, 3, START, 6)[2] is None


def fake_open_meteo(request: httpx.Request) -> httpx.Response:
    """Answers any batch size by repeating the recorded first location."""
    n = len(parse_qs(request.url.query.decode())["latitude"][0].split(","))
    template = body()[0]
    return httpx.Response(200, json=[copy.deepcopy(template) for _ in range(n)])


class TestRequests:
    @respx.mock
    def test_request_parameters(self) -> None:
        route = respx.get(FORECAST_URL).mock(return_value=httpx.Response(200, json=body()))

        OpenMeteoWeather().hourly(POINTS, START + timedelta(minutes=40), 6)

        params = parse_qs(urlsplit(str(route.calls.last.request.url)).query)
        assert params["latitude"] == ["32.7767,37.6872,39.7392"]
        assert params["longitude"] == ["-96.7970,-97.3301,-104.9903"]
        assert params["hourly"] == [
            "wind_speed_10m,wind_gusts_10m,rain,showers,snowfall,weather_code"
        ]
        assert params["wind_speed_unit"] == ["kmh"]
        assert params["precipitation_unit"] == ["mm"]
        assert params["timeformat"] == ["unixtime"]
        assert params["timezone"] == ["GMT"]
        assert params["start_hour"] == [START.strftime("%Y-%m-%dT%H:00")]
        assert params["end_hour"] == [(START + timedelta(hours=5)).strftime("%Y-%m-%dT%H:00")]

    @respx.mock
    def test_batches_of_at_most_100_in_order(self) -> None:
        route = respx.get(FORECAST_URL).mock(side_effect=fake_open_meteo)
        points = [LatLon(30 + i * 0.01, -100.0) for i in range(250)]

        series = OpenMeteoWeather().hourly(points, START, 6)

        sizes = sorted(
            len(parse_qs(c.request.url.query.decode())["latitude"][0].split(","))
            for c in route.calls
        )
        assert sizes == [50, 100, 100]
        assert len(series) == 250

    @respx.mock
    def test_provider_error_is_weather_unavailable(self) -> None:
        respx.get(FORECAST_URL).mock(
            return_value=httpx.Response(400, json={"error": True, "reason": "bad"})
        )

        with pytest.raises(WeatherUnavailable, match="HTTP 400"):
            OpenMeteoWeather().hourly(POINTS, START, 6)

    def test_no_points_no_call(self) -> None:
        assert OpenMeteoWeather().hourly([], START, 6) == []

    def test_hours_must_be_positive(self) -> None:
        with pytest.raises(ValueError, match="hours"):
            OpenMeteoWeather().hourly(POINTS, START, 0)


class TestRateLimits:
    def budget(self, per_minute: int) -> RateBudget:
        return RateBudget("om-test", [(60, per_minute)], clock=lambda: 60 * 1000.0 + 5)

    @respx.mock
    def test_each_batch_reserves_its_points_before_going_out(self) -> None:
        respx.get(FORECAST_URL).mock(side_effect=fake_open_meteo)
        budget = self.budget(1000)  # 900 a minute
        points = [LatLon(30 + i * 0.01, -100.0) for i in range(250)]

        OpenMeteoWeather(budget=budget).hourly(points, START, 6)

        budget.reserve(650)  # 250 taken: exactly 650 left
        with pytest.raises(Exception, match="rate budget full"):
            budget.reserve(1)

    @respx.mock
    def test_a_full_budget_keeps_the_batches_that_fit_and_says_when_to_retry(self) -> None:
        route = respx.get(FORECAST_URL).mock(side_effect=fake_open_meteo)
        points = [LatLon(30 + i * 0.01, -100.0) for i in range(250)]
        # 150 a minute; one worker sends the batches in order: 100 fits, 100 doesn't, 50 does.
        weather = OpenMeteoWeather(workers=1, budget=self.budget(167))

        with pytest.raises(WeatherBusy) as raised:
            weather.hourly(points, START, 6)

        assert route.call_count == 2
        assert sorted(raised.value.fetched) == [*range(100), *range(200, 250)]
        assert all(s is not None for s in raised.value.fetched.values())
        # 55 s to the next minute, then 30 s more until this minute's 100 has decayed
        # enough for another 100 (the 50 that fitted is taken after the refusal).
        assert raised.value.retry_after_s == 85
        assert raised.value.code == "weather_busy"

    @respx.mock
    def test_a_429_is_busy_for_a_minute_and_keeps_open_meteos_reason(self) -> None:
        respx.get(FORECAST_URL).mock(
            return_value=httpx.Response(
                429, json={"error": True, "reason": "Minutely API request limit exceeded"}
            )
        )

        with pytest.raises(WeatherBusy, match="Minutely API request limit exceeded") as raised:
            OpenMeteoWeather().hourly(POINTS, START, 6)

        assert raised.value.retry_after_s == 60
        assert raised.value.fetched == {}


def test_unit_factors_appear_only_in_units_module() -> None:
    """Conversion factors live in domain/units.py and nowhere else (RFC §18.4)."""
    root = Path(__file__).resolve().parents[2] / "planner"
    factors = re.compile(r"1\.609|1609\.3|25\.4\b|2\.54\b|0\.4535|0\.6213")
    offenders = [
        str(path.relative_to(root))
        for path in root.rglob("*.py")
        if path.name != "units.py" and factors.search(path.read_text())
    ]
    assert offenders == []
