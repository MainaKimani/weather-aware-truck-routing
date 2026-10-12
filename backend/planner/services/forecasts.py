"""Cache-first forecasts for many points (RFC §9, §18.2-18.4).

- Points are snapped to a lattice (0.1 deg for checkpoints, 0.25 deg for the
  heatmap grid), so nearby plans share entries.
- Keys carry the rules version, a payload schema version and the hour, so
  bumping either version or reaching a new hour misses every old entry.
- Single-flight: the first request for a cold key takes a lock (`cache.add`,
  which is Redis SET NX) and fetches; others wait up to 2 s for its value.
- Stale-while-revalidate: entries live 3 h past their hour. If the provider
  fails, the newest of those is served and the result is flagged stale.
"""

import time
from collections.abc import Callable, Iterable, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Final

from django.core.cache import BaseCache, cache

from planner.domain.forecast import ForecastSeries
from planner.domain.geo import snap
from planner.domain.types import Forecast, LatLon
from planner.domain.version import RULES_VERSION
from planner.providers.base import ProviderError, WeatherProvider, WeatherUnavailable

SCHEMA_VERSION: Final = 1
CHECKPOINT_STEP_DEG: Final = 0.1
GRID_STEP_DEG: Final = 0.25
HOURS_BEFORE: Final = 1
FORECAST_HOURS: Final = 1 + 24 * 10  # an hour ago to ten days ahead
STALE_HOURS: Final = 3
LOCK_TTL_S: Final = 15
LOCK_WAIT_S: Final = 2.0
_POLL_S: Final = 0.05


def _hour(t: datetime) -> datetime:
    return t.astimezone(UTC).replace(minute=0, second=0, microsecond=0)


def cache_key(p: LatLon, hour: datetime) -> str:
    # + 0.0 turns -0.0 into 0.0, so the same lattice point has one key.
    return (
        f"v{RULES_VERSION}:fc{SCHEMA_VERSION}:{p.lat + 0.0:.2f}:{p.lon + 0.0:.2f}:{hour:%Y%m%d%H}"
    )


def _encode(series: ForecastSeries, fetched_at: datetime) -> dict[str, Any]:
    return {
        "fetched_at": fetched_at.timestamp(),
        "start": series.start.timestamp(),
        "rows": [
            (f.gust_mph, f.rain_in_hr, f.snow_in_hr, f.wind_mph, f.weather_code)
            for f in series.hours
        ],
    }


def _decode(value: dict[str, Any]) -> tuple[ForecastSeries, datetime]:
    start = datetime.fromtimestamp(value["start"], UTC)
    hours = tuple(
        Forecast(start + timedelta(hours=i), gust, rain, snow, wind, code)
        for i, (gust, rain, snow, wind, code) in enumerate(value["rows"])
    )
    return ForecastSeries(start, hours), datetime.fromtimestamp(value["fetched_at"], UTC)


@dataclass(frozen=True)
class ForecastLookup:
    step_deg: float
    series: dict[LatLon, ForecastSeries | None]  # by snapped point
    stale: bool  # some data came from an older fetch because the provider failed
    oldest_fetch: datetime | None

    def for_point(self, p: LatLon) -> ForecastSeries | None:
        return self.series.get(snap(p, self.step_deg))


class ForecastStore:
    def __init__(
        self,
        weather: WeatherProvider,
        backend: BaseCache = cache,
        clock: Callable[[], datetime] = lambda: datetime.now(UTC),
        lock_wait_s: float = LOCK_WAIT_S,
    ) -> None:
        self._weather = weather
        self._cache = backend
        self._clock = clock
        self._lock_wait_s = lock_wait_s

    def get(self, points: Sequence[LatLon], step_deg: float) -> ForecastLookup:
        hour = _hour(self._clock())
        wanted = list(dict.fromkeys(snap(p, step_deg) for p in points))
        found: dict[LatLon, tuple[ForecastSeries, datetime]] = self._read(wanted, hour)

        missing = [p for p in wanted if p not in found]
        mine: list[LatLon] = []
        theirs: list[LatLon] = []
        for p in missing:
            # add() is True when we took the lock and False when someone else
            # holds it. django-redis returns None when Redis is unreachable
            # (IGNORE_EXCEPTIONS): there's no one to wait for, so fetch now.
            took = self._cache.add(self._lock(p, hour), 1, LOCK_TTL_S)
            (theirs if took is False else mine).append(p)

        failed: list[LatLon] = []
        failure: ProviderError | None = None
        if mine:
            try:
                found.update(self._fetch(mine, hour))
            except ProviderError as exc:
                failed, failure = mine, exc
            finally:
                self._cache.delete_many([self._lock(p, hour) for p in mine])
        if theirs:
            found.update(self._wait_for(theirs, hour))
            late = [p for p in theirs if p not in found]
            if late:  # the other request failed or is slow: fetch ourselves
                try:
                    found.update(self._fetch(late, hour))
                except ProviderError as exc:
                    failed, failure = [*failed, *late], exc

        stale = False
        if failed:
            for p, value in self._read_stale(failed, hour).items():
                found[p] = value
                stale = True
            if not any(p in found for p in wanted):
                raise WeatherUnavailable(str(failure)) from failure

        fetches = [fetched for _, fetched in found.values()]
        return ForecastLookup(
            step_deg=step_deg,
            series={p: found[p][0] if p in found else None for p in wanted},
            stale=stale,
            oldest_fetch=min(fetches) if fetches else None,
        )

    # -- cache -----------------------------------------------------------

    def _lock(self, p: LatLon, hour: datetime) -> str:
        return f"lock:{cache_key(p, hour)}"

    def _read(
        self, points: Iterable[LatLon], hour: datetime
    ) -> dict[LatLon, tuple[ForecastSeries, datetime]]:
        keys = {cache_key(p, hour): p for p in points}
        return {keys[k]: _decode(v) for k, v in self._cache.get_many(list(keys)).items()}

    def _read_stale(
        self, points: list[LatLon], hour: datetime
    ) -> dict[LatLon, tuple[ForecastSeries, datetime]]:
        out: dict[LatLon, tuple[ForecastSeries, datetime]] = {}
        for back in range(1, STALE_HOURS + 1):
            remaining = [p for p in points if p not in out]
            if not remaining:
                break
            out.update(self._read(remaining, hour - timedelta(hours=back)))
        return out

    def _wait_for(
        self, points: list[LatLon], hour: datetime
    ) -> dict[LatLon, tuple[ForecastSeries, datetime]]:
        found: dict[LatLon, tuple[ForecastSeries, datetime]] = {}
        deadline = time.monotonic() + self._lock_wait_s
        while True:
            found.update(self._read([p for p in points if p not in found], hour))
            if len(found) == len(points) or time.monotonic() >= deadline:
                return found
            time.sleep(_POLL_S)

    def _fetch(
        self, points: list[LatLon], hour: datetime
    ) -> dict[LatLon, tuple[ForecastSeries, datetime]]:
        start = hour - timedelta(hours=HOURS_BEFORE)
        fetched_at = self._clock()
        results = self._weather.hourly(points, start, FORECAST_HOURS)
        # Fresh until the next hour, then kept STALE_HOURS more as a fallback.
        ttl = int((hour + timedelta(hours=1 + STALE_HOURS) - fetched_at).total_seconds())
        out: dict[LatLon, tuple[ForecastSeries, datetime]] = {}
        to_store: dict[str, dict[str, Any]] = {}
        for p, series in zip(points, results, strict=True):
            if series is None:
                continue  # don't cache a gap; the next request tries again
            out[p] = (series, fetched_at)
            to_store[cache_key(p, hour)] = _encode(series, fetched_at)
        self._cache.set_many(to_store, timeout=max(ttl, 1))
        return out
