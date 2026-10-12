import threading
import time
from collections.abc import Iterator, Sequence
from datetime import UTC, datetime, timedelta

import pytest
from django.core.cache import cache

from planner.domain.forecast import ForecastSeries
from planner.domain.types import LatLon
from planner.providers.base import WeatherUnavailable
from planner.providers.fakes import FakeWeather
from planner.services import forecasts
from planner.services.forecasts import (
    CHECKPOINT_STEP_DEG,
    FORECAST_HOURS,
    ForecastStore,
    cache_key,
)

NOW = datetime(2026, 10, 12, 10, 25, tzinfo=UTC)
POINTS = [LatLon(32.78, -96.80), LatLon(35.22, -101.83), LatLon(39.74, -104.99)]


class Clock:
    def __init__(self, t: datetime = NOW) -> None:
        self.t = t

    def __call__(self) -> datetime:
        return self.t


class CountingWeather:
    """FakeWeather that counts calls, can be slowed down or switched off."""

    def __init__(self, delay_s: float = 0.0) -> None:
        self.inner = FakeWeather(anchor=NOW.replace(minute=0))
        self.calls: list[list[LatLon]] = []
        self.delay_s = delay_s
        self.down = False
        self._lock = threading.Lock()

    def hourly(
        self, points: Sequence[LatLon], start: datetime, hours: int
    ) -> list[ForecastSeries | None]:
        with self._lock:
            self.calls.append(list(points))
        time.sleep(self.delay_s)
        if self.down:
            raise WeatherUnavailable("Open-Meteo: HTTP 503")
        return self.inner.hourly(points, start, hours)


@pytest.fixture(autouse=True)
def clear_cache() -> Iterator[None]:
    cache.clear()
    yield
    cache.clear()


def store(weather: CountingWeather, clock: Clock | None = None) -> ForecastStore:
    return ForecastStore(weather, clock=clock or Clock(), lock_wait_s=2.0)


def test_second_identical_request_makes_no_provider_call() -> None:
    weather = CountingWeather()
    s = store(weather)

    first = s.get(POINTS, CHECKPOINT_STEP_DEG)
    second = s.get(POINTS, CHECKPOINT_STEP_DEG)

    assert len(weather.calls) == 1
    assert second.series == first.series
    assert not second.stale


def test_entries_cover_an_hour_ago_to_ten_days_ahead() -> None:
    lookup = store(CountingWeather()).get(POINTS[:1], CHECKPOINT_STEP_DEG)

    series = lookup.for_point(POINTS[0])
    assert series is not None
    assert series.start == datetime(2026, 10, 12, 9, tzinfo=UTC)
    assert len(series.hours) == FORECAST_HOURS
    assert series.at(datetime(2026, 10, 21, 10, tzinfo=UTC)) is not None


def test_nearby_points_share_one_lattice_entry() -> None:
    weather = CountingWeather()
    near = [LatLon(32.78, -96.80), LatLon(32.81, -96.77), LatLon(32.76, -96.83)]

    lookup = store(weather).get(near, CHECKPOINT_STEP_DEG)

    assert weather.calls == [[LatLon(32.8, -96.8)]]
    assert all(lookup.for_point(p) is lookup.series[LatLon(32.8, -96.8)] for p in near)


def test_concurrent_requests_for_a_cold_key_make_one_upstream_call() -> None:
    weather = CountingWeather(delay_s=0.3)
    results: list[object] = []
    barrier = threading.Barrier(10)

    def worker() -> None:
        s = store(weather)
        barrier.wait()
        results.append(s.get(POINTS[:1], CHECKPOINT_STEP_DEG).for_point(POINTS[0]))

    threads = [threading.Thread(target=worker) for _ in range(10)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert len(weather.calls) == 1
    assert len(results) == 10
    assert all(r is not None for r in results)


def test_provider_down_serves_stale_entry_flagged() -> None:
    weather, clock = CountingWeather(), Clock()
    s = store(weather, clock)
    fresh = s.get(POINTS, CHECKPOINT_STEP_DEG)

    clock.t = NOW + timedelta(hours=2)  # past freshness, within the stale window
    weather.down = True
    lookup = s.get(POINTS, CHECKPOINT_STEP_DEG)

    assert lookup.stale
    assert lookup.series == fresh.series
    assert lookup.oldest_fetch == NOW


def test_provider_down_with_nothing_cached_is_an_error() -> None:
    weather = CountingWeather()
    weather.down = True

    with pytest.raises(WeatherUnavailable, match="503"):
        store(weather).get(POINTS, CHECKPOINT_STEP_DEG)


def test_stale_window_ends_after_three_hours() -> None:
    weather, clock = CountingWeather(), Clock()
    s = store(weather, clock)
    s.get(POINTS, CHECKPOINT_STEP_DEG)

    clock.t = NOW + timedelta(hours=5)
    weather.down = True

    with pytest.raises(WeatherUnavailable):
        s.get(POINTS, CHECKPOINT_STEP_DEG)


def test_new_hour_refetches() -> None:
    weather, clock = CountingWeather(), Clock()
    s = store(weather, clock)
    s.get(POINTS, CHECKPOINT_STEP_DEG)

    clock.t = NOW + timedelta(hours=1)
    s.get(POINTS, CHECKPOINT_STEP_DEG)

    assert len(weather.calls) == 2


def test_bumping_rules_version_misses_every_old_key(monkeypatch: pytest.MonkeyPatch) -> None:
    weather = CountingWeather()
    s = store(weather)
    s.get(POINTS, CHECKPOINT_STEP_DEG)
    old_keys = [cache_key(LatLon(32.8, -96.8), NOW.replace(minute=0))]

    monkeypatch.setattr(forecasts, "RULES_VERSION", "2.0.0")
    s.get(POINTS, CHECKPOINT_STEP_DEG)

    assert len(weather.calls) == 2
    assert cache_key(LatLon(32.8, -96.8), NOW.replace(minute=0)) not in old_keys


def test_lock_is_released_after_a_failure() -> None:
    weather = CountingWeather()
    s = store(weather)
    weather.down = True
    with pytest.raises(WeatherUnavailable):
        s.get(POINTS, CHECKPOINT_STEP_DEG)

    weather.down = False
    lookup = s.get(POINTS, CHECKPOINT_STEP_DEG)

    assert all(v is not None for v in lookup.series.values())


def test_waiter_fetches_itself_when_the_lock_holder_never_delivers() -> None:
    weather = CountingWeather()
    point = LatLon(32.8, -96.8)
    cache.add(f"lock:{cache_key(point, NOW.replace(minute=0))}", 1, 30)  # someone else's lock

    lookup = ForecastStore(weather, clock=Clock(), lock_wait_s=0.1).get([point], 0.1)

    assert lookup.for_point(point) is not None
    assert len(weather.calls) == 1


def test_gaps_are_not_cached() -> None:
    class Gappy(CountingWeather):
        def hourly(
            self, points: Sequence[LatLon], start: datetime, hours: int
        ) -> list[ForecastSeries | None]:
            super().hourly(points, start, hours)
            return [None for _ in points]

    weather = Gappy()
    s = store(weather)
    assert s.get(POINTS[:1], 0.1).for_point(POINTS[0]) is None
    s.get(POINTS[:1], 0.1)

    assert len(weather.calls) == 2


def test_negative_zero_and_positive_zero_share_a_key() -> None:
    hour = NOW.replace(minute=0)

    assert cache_key(LatLon(-0.0, -0.0), hour) == cache_key(LatLon(0.0, 0.0), hour)


def test_unreachable_cache_does_not_wait_for_locks() -> None:
    from django.core.cache.backends.dummy import DummyCache

    class DownCache(DummyCache):
        """What django-redis does with IGNORE_EXCEPTIONS when Redis is down."""

        def add(self, *args: object, **kwargs: object) -> None:  # type: ignore[override]
            return None

    weather = CountingWeather()
    started = time.monotonic()

    lookup = ForecastStore(weather, backend=DownCache("down", {}), clock=Clock()).get(POINTS, 0.1)

    assert time.monotonic() - started < 1.0
    assert all(v is not None for v in lookup.series.values())
    assert len(weather.calls) == 1
