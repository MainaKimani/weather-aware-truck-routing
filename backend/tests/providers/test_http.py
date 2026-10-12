from collections.abc import Iterator
from datetime import UTC, datetime

import httpx
import pytest
import respx

from planner.domain.types import LatLon
from planner.providers import http
from planner.providers.base import RoutingUnavailable, WeatherUnavailable
from planner.providers.http import (
    FAILURE_THRESHOLD,
    CircuitBreaker,
    CircuitOpen,
    HttpClient,
    HttpError,
    breaker_for,
)
from planner.providers.open_meteo import FORECAST_URL, OpenMeteoWeather

URL = "https://provider.example/api"


class FakeClock:
    def __init__(self) -> None:
        self.t = 1000.0

    def __call__(self) -> float:
        return self.t


@pytest.fixture
def pauses() -> list[float]:
    return []


@pytest.fixture
def clock() -> FakeClock:
    return FakeClock()


@pytest.fixture
def client(pauses: list[float], clock: FakeClock) -> Iterator[HttpClient]:
    yield HttpClient("Test", breaker=CircuitBreaker(clock=clock), sleep=pauses.append)


class TestRetries:
    @respx.mock
    def test_timeout_is_retried_once(self, client: HttpClient, pauses: list[float]) -> None:
        route = respx.get(URL).mock(side_effect=httpx.ReadTimeout("slow"))

        with pytest.raises(HttpError, match="timed out"):
            client.get_json(URL, {})

        assert route.call_count == 2
        assert len(pauses) == 1

    @respx.mock
    def test_5xx_then_success(self, client: HttpClient) -> None:
        route = respx.get(URL).mock(
            side_effect=[httpx.Response(503), httpx.Response(200, json={"ok": True})]
        )

        assert client.get_json(URL, {}) == {"ok": True}
        assert route.call_count == 2

    @respx.mock
    def test_connection_error_is_retried(self, client: HttpClient) -> None:
        route = respx.get(URL).mock(
            side_effect=[httpx.ConnectError("refused"), httpx.Response(200, json=[])]
        )

        assert client.get_json(URL, {}) == []
        assert route.call_count == 2

    @respx.mock
    @pytest.mark.parametrize("status", [400, 401, 404, 429])
    def test_4xx_is_not_retried(self, client: HttpClient, pauses: list[float], status: int) -> None:
        route = respx.get(URL).mock(return_value=httpx.Response(status))

        with pytest.raises(HttpError, match=f"HTTP {status}") as info:
            client.get_json(URL, {})

        assert route.call_count == 1
        assert pauses == []
        assert info.value.status == status

    @respx.mock
    def test_bad_json_is_not_retried(self, client: HttpClient) -> None:
        route = respx.get(URL).mock(return_value=httpx.Response(200, text="<html>"))

        with pytest.raises(HttpError, match="not JSON"):
            client.get_json(URL, {})

        assert route.call_count == 1


class TestCircuitBreaker:
    @respx.mock
    def test_opens_after_five_failures_and_fails_fast(
        self, client: HttpClient, clock: FakeClock
    ) -> None:
        route = respx.get(URL).mock(return_value=httpx.Response(500))
        for _ in range(FAILURE_THRESHOLD):
            with pytest.raises(HttpError):
                client.get_json(URL, {})
        calls_before = route.call_count

        with pytest.raises(CircuitOpen, match="circuit open"):
            client.get_json(URL, {})

        assert route.call_count == calls_before  # no request went out
        assert calls_before == FAILURE_THRESHOLD * 2  # each failure included its retry

    @respx.mock
    def test_closes_after_a_successful_half_open_call(
        self, client: HttpClient, clock: FakeClock
    ) -> None:
        route = respx.get(URL).mock(return_value=httpx.Response(500))
        for _ in range(FAILURE_THRESHOLD):
            with pytest.raises(HttpError):
                client.get_json(URL, {})

        clock.t += 30
        route.return_value = httpx.Response(200, json={"ok": 1})

        assert client.get_json(URL, {}) == {"ok": 1}
        assert client.get_json(URL, {}) == {"ok": 1}  # closed: calls flow again

    @respx.mock
    def test_failed_half_open_call_reopens(self, client: HttpClient, clock: FakeClock) -> None:
        respx.get(URL).mock(return_value=httpx.Response(500))
        for _ in range(FAILURE_THRESHOLD):
            with pytest.raises(HttpError):
                client.get_json(URL, {})

        clock.t += 30
        with pytest.raises(HttpError, match="HTTP 500"):
            client.get_json(URL, {})  # the trial call fails

        with pytest.raises(CircuitOpen):
            client.get_json(URL, {})

    def test_still_open_before_thirty_seconds(self, clock: FakeClock) -> None:
        breaker = CircuitBreaker(clock=clock)
        for _ in range(FAILURE_THRESHOLD):
            breaker.record_failure()

        clock.t += 29.9
        assert breaker.state == "open"
        assert not breaker.allow()

    @respx.mock
    def test_4xx_does_not_count_towards_opening(self, client: HttpClient) -> None:
        respx.get(URL).mock(return_value=httpx.Response(400))
        for _ in range(FAILURE_THRESHOLD + 2):
            with pytest.raises(HttpError, match="400"):
                client.get_json(URL, {})

    def test_success_resets_the_count(self, clock: FakeClock) -> None:
        breaker = CircuitBreaker(clock=clock)
        for _ in range(FAILURE_THRESHOLD - 1):
            breaker.record_failure()
        breaker.record_success()
        for _ in range(FAILURE_THRESHOLD - 1):
            breaker.record_failure()

        assert breaker.state == "closed"

    def test_only_one_trial_at_a_time(self, clock: FakeClock) -> None:
        breaker = CircuitBreaker(threshold=1, clock=clock)
        breaker.record_failure()
        clock.t += 30

        assert breaker.allow()
        assert not breaker.allow()
        assert breaker.state == "half_open"

    def test_breakers_are_shared_by_provider_name(self) -> None:
        assert breaker_for("Open-Meteo") is breaker_for("Open-Meteo")
        assert breaker_for("Open-Meteo") is not breaker_for("HERE routing")


class TestMappedErrors:
    @respx.mock
    def test_open_breaker_surfaces_as_weather_unavailable(self) -> None:
        respx.get(FORECAST_URL).mock(return_value=httpx.Response(503))
        weather = OpenMeteoWeather(HttpClient("Open-Meteo", sleep=lambda _: None))
        point, start = [LatLon(32.8, -96.8)], datetime(2026, 10, 12, 6, tzinfo=UTC)
        for _ in range(FAILURE_THRESHOLD):
            with pytest.raises(WeatherUnavailable, match="HTTP 503"):
                weather.hourly(point, start, 1)

        with pytest.raises(WeatherUnavailable, match="circuit open"):
            weather.hourly(point, start, 1)

    def test_error_codes(self) -> None:
        assert RoutingUnavailable.code == "routing_unavailable"
        assert WeatherUnavailable.code == "weather_unavailable"


def test_retry_pause_is_jittered_between_100_and_400_ms(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(http, "RETRY_PAUSE_S", (0.1, 0.4))
    pauses: list[float] = []
    client = HttpClient("Jitter", breaker=CircuitBreaker(), sleep=pauses.append)

    with respx.mock:
        respx.get(URL).mock(side_effect=httpx.ReadTimeout("slow"))
        for _ in range(4):
            with pytest.raises(HttpError):
                client.get_json(URL, {})

    assert len(pauses) == 4
    assert all(0.1 <= p <= 0.4 for p in pauses)
    assert len(set(pauses)) > 1
