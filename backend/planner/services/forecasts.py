"""Cache-first forecasts for many points (RFC §9, §18.2-18.4).

- Points are snapped to a 0.25 deg lattice, for checkpoints and the heatmap
  grid alike, so nearby plans share entries and a trip's heatmap reuses its
  checkpoints' forecasts. Every point is an Open-Meteo call against a free
  tier of 600 a minute, which a finer checkpoint lattice would exhaust: a
  10 mi Dallas -> Denver plan needs 131 points at 0.25 deg, 217 at 0.1 deg.
  Long trips can put the heatmap on a coarser lattice (services/corridor.py).
- Keys carry the rules version, a payload schema version and the hour of the
  fetch. An entry is fresh for 3 hours (the US models Open-Meteo serves update
  every 1 to 6 hours), so lookups read this hour's key and the two before.
  Bumping either version misses every old entry.
- Single-flight: the first request for a cold key takes a lock (`cache.add`,
  which is Redis SET NX) and fetches; others wait up to 2 s for its value.
- Stale-while-revalidate: entries live 3 h past their freshness. If the
  provider fails, the newest of those is served and the result is flagged
  stale.
- Busy: when the provider's rate limit stops a fetch part way (WeatherBusy),
  what did come back is cached, stale entries cover what they can, and if any
  point is still missing the lookup raises WeatherBusy, so a retry after the
  wait only fetches the rest. Busy never turns into Unknown ratings.
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
from planner.providers.base import (
    ProviderError,
    WeatherBusy,
    WeatherProvider,
    WeatherUnavailable,
)

SCHEMA_VERSION: Final = 1
GRID_STEP_DEG: Final = 0.25
CHECKPOINT_STEP_DEG: Final = GRID_STEP_DEG
HOURS_BEFORE: Final = 1
FORECAST_HOURS: Final = 1 + 24 * 10  # an hour ago to ten days ahead
FRESH_HOURS: Final = 3
STALE_HOURS: Final = 3
LOCK_TTL_S: Final = 15
LOCK_WAIT_S: Final = 2.0
_POLL_S: Final = 0.05


def _hour(t: datetime) -> datetime:
    return t.astimezone(UTC).replace(minute=0, second=0, microsecond=0)


_HOUR: Final = timedelta(hours=1)


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
    rows = value["rows"]
    hours: tuple[Forecast, ...] = ()
    if rows:
        # map keeps the loop in C: a coast-to-coast heatmap decodes about
        # 140,000 hours from the cache. Each row is (gust, rain, snow, wind,
        # code), the fields after valid_hour in Forecast's order.
        stamps = map(start.__add__, map(_HOUR.__mul__, range(len(rows))))
        hours = tuple(map(Forecast, stamps, *zip(*rows, strict=True)))
    return ForecastSeries(start, hours), datetime.fromtimestamp(value["fetched_at"], UTC)


@dataclass(frozen=True)
class ForecastLookup:
    step_deg: float
    series: dict[LatLon, ForecastSeries | None]  # by snapped point
    stale: bool  # some data came from an older fetch because the provider failed
    oldest_fetch: datetime | None
    cache_hits: int = 0  # lattice points served fresh from the cache, of len(series)

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
        found: dict[LatLon, tuple[ForecastSeries, datetime]] = self._read_back(
            wanted, hour, range(FRESH_HOURS)
        )
        hits = len(found)

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
        busy: WeatherBusy | None = None

        def attempt(points: list[LatLon]) -> None:
            nonlocal failed, failure, busy
            try:
                found.update(self._fetch(points, hour))
            except _PartlyFetched as exc:
                found.update(exc.found)
                failed, failure, busy = [*failed, *exc.unfetched], exc.busy, exc.busy
            except ProviderError as exc:
                failed, failure = [*failed, *points], exc

        if mine:
            try:
                attempt(mine)
            finally:
                self._cache.delete_many([self._lock(p, hour) for p in mine])
        if theirs:
            found.update(self._wait_for(theirs, hour))
            late = [p for p in theirs if p not in found]
            if late:  # the other request failed or is slow: fetch ourselves
                attempt(late)

        stale = False
        if failed:
            back = range(FRESH_HOURS, FRESH_HOURS + STALE_HOURS)
            for p, value in self._read_back(failed, hour, back).items():
                found[p] = value
                stale = True
            if busy is not None and any(p not in found for p in failed):
                raise busy
            if not any(p in found for p in wanted):
                raise WeatherUnavailable(str(failure)) from failure

        fetches = [fetched for _, fetched in found.values()]
        return ForecastLookup(
            step_deg=step_deg,
            series={p: found[p][0] if p in found else None for p in wanted},
            stale=stale,
            oldest_fetch=min(fetches) if fetches else None,
            cache_hits=hits,
        )

    # -- cache -----------------------------------------------------------

    def _lock(self, p: LatLon, hour: datetime) -> str:
        return f"lock:{cache_key(p, hour)}"

    def _read(
        self, points: Iterable[LatLon], hour: datetime
    ) -> dict[LatLon, tuple[ForecastSeries, datetime]]:
        keys = {cache_key(p, hour): p for p in points}
        return {keys[k]: _decode(v) for k, v in self._cache.get_many(list(keys)).items()}

    def _read_back(
        self, points: list[LatLon], hour: datetime, hours_back: range
    ) -> dict[LatLon, tuple[ForecastSeries, datetime]]:
        """Each point's newest entry fetched `hours_back` hours before `hour`."""
        out: dict[LatLon, tuple[ForecastSeries, datetime]] = {}
        for back in hours_back:
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
        busy: WeatherBusy | None
        try:
            results: dict[int, ForecastSeries | None] = dict(
                enumerate(self._weather.hourly(points, start, FORECAST_HOURS))
            )
        except WeatherBusy as exc:
            results, busy = exc.fetched, exc
        else:
            busy = None
        # Fresh for FRESH_HOURS from this hour, then kept STALE_HOURS more as a fallback.
        ttl = (hour + timedelta(hours=FRESH_HOURS + STALE_HOURS) - fetched_at).total_seconds()
        out: dict[LatLon, tuple[ForecastSeries, datetime]] = {}
        to_store: dict[str, dict[str, Any]] = {}
        for i, series in results.items():
            if series is None:
                continue  # don't cache a gap; the next request tries again
            out[points[i]] = (series, fetched_at)
            to_store[cache_key(points[i], hour)] = _encode(series, fetched_at)
        self._cache.set_many(to_store, timeout=max(int(ttl), 1))
        if busy is not None:
            unfetched = [p for i, p in enumerate(points) if i not in results]
            raise _PartlyFetched(out, unfetched, busy)
        return out


class _PartlyFetched(Exception):
    """A fetch the rate limit stopped part way: what came back, and what didn't."""

    def __init__(
        self,
        found: dict[LatLon, tuple[ForecastSeries, datetime]],
        unfetched: list[LatLon],
        busy: WeatherBusy,
    ) -> None:
        super().__init__(str(busy))
        self.found = found
        self.unfetched = unfetched
        self.busy = busy
