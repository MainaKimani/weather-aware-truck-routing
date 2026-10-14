"""Open-Meteo hourly forecast adapter (RFC §5.2, §6.3).

Many points go in one request (comma-separated coordinates), up to 100 per
batch, with batches fetched in parallel. Values come back in metric units,
which the response states in `hourly_units`; the parser checks them before
converting with `units.py`, so a silent unit change upstream fails loudly
instead of skewing every rating.

Each batch reserves its cost in the rate budget (providers/rate_budget.py)
before it goes out. When the budget is full, or Open-Meteo answers 429
anyway, the call raises `WeatherBusy` with how long to wait and the batches
that did come back, so the forecast store can keep those and a retry only
fetches the rest.
"""

import math
from collections.abc import Mapping, Sequence
from concurrent.futures import ThreadPoolExecutor
from contextvars import copy_context
from datetime import UTC, datetime, timedelta
from typing import Any, Final

from planner.domain.forecast import ForecastSeries
from planner.domain.types import Forecast, LatLon
from planner.domain.units import cm_to_in, kmh_to_mph, mm_to_in
from planner.providers.base import WeatherBusy, WeatherUnavailable
from planner.providers.http import HttpClient, HttpError
from planner.providers.rate_budget import OverRate, RateBudget, open_meteo_weight

FORECAST_URL: Final = "https://api.open-meteo.com/v1/forecast"
BATCH_SIZE: Final = 100
WORKERS: Final = 8
RATE_LIMITED_RETRY_S: Final = 60  # after a 429 from Open-Meteo itself
VARIABLES: Final = (
    "wind_speed_10m",
    "wind_gusts_10m",
    "rain",
    "showers",
    "snowfall",
    "weather_code",
)
EXPECTED_UNITS: Final = {
    "time": "unixtime",
    "wind_speed_10m": "km/h",
    "wind_gusts_10m": "km/h",
    "rain": "mm",
    "showers": "mm",
    "snowfall": "cm",
}


def _hour(t: datetime) -> datetime:
    return t.astimezone(UTC).replace(minute=0, second=0, microsecond=0)


class OpenMeteoWeather:
    def __init__(
        self,
        http: HttpClient | None = None,
        workers: int = WORKERS,
        budget: RateBudget | None = None,
    ) -> None:
        self._http = http or HttpClient("Open-Meteo")
        self._workers = workers
        self._budget = budget

    def params(self, points: Sequence[LatLon], start: datetime, hours: int) -> dict[str, str]:
        end = start + timedelta(hours=hours - 1)
        return {
            "latitude": ",".join(f"{p.lat:.4f}" for p in points),
            "longitude": ",".join(f"{p.lon:.4f}" for p in points),
            "hourly": ",".join(VARIABLES),
            "wind_speed_unit": "kmh",
            "precipitation_unit": "mm",
            "timeformat": "unixtime",
            "timezone": "GMT",
            "start_hour": start.strftime("%Y-%m-%dT%H:00"),
            "end_hour": end.strftime("%Y-%m-%dT%H:00"),
        }

    def hourly(
        self, points: Sequence[LatLon], start: datetime, hours: int
    ) -> list[ForecastSeries | None]:
        if hours < 1:
            raise ValueError("hours must be at least 1")
        if not points:
            return []
        start = _hour(start)
        batches = [points[i : i + BATCH_SIZE] for i in range(0, len(points), BATCH_SIZE)]
        if len(batches) == 1:
            results = [self._fetch_or_busy(batches[0], start, hours)]
        else:
            with ThreadPoolExecutor(max_workers=min(self._workers, len(batches))) as pool:
                # Each task runs in a copy of the caller's context, so its log
                # lines carry the request id.
                futures = [
                    pool.submit(copy_context().run, self._fetch_or_busy, b, start, hours)
                    for b in batches
                ]
                results = [f.result() for f in futures]
        busy = [r for r in results if isinstance(r, WeatherBusy)]
        if busy:
            fetched: dict[int, ForecastSeries | None] = {}
            offset = 0
            for batch, result in zip(batches, results, strict=True):
                if not isinstance(result, WeatherBusy):
                    fetched.update(enumerate(result, start=offset))
                offset += len(batch)
            wait = max(b.retry_after_s for b in busy)
            raise WeatherBusy(f"{busy[0]} ({len(busy)} of {len(batches)} batches)", wait, fetched)
        return [s for batch in results if not isinstance(batch, WeatherBusy) for s in batch]

    def _fetch_or_busy(
        self, points: Sequence[LatLon], start: datetime, hours: int
    ) -> list[ForecastSeries | None] | WeatherBusy:
        """A batch's series, or the WeatherBusy that stopped it; other errors raise."""
        try:
            return self._fetch(points, start, hours)
        except WeatherBusy as exc:
            return exc

    def _fetch(
        self, points: Sequence[LatLon], start: datetime, hours: int
    ) -> list[ForecastSeries | None]:
        if self._budget is not None:
            try:
                self._budget.reserve(open_meteo_weight(len(points), hours / 24, len(VARIABLES)))
            except OverRate as exc:
                raise WeatherBusy("Open-Meteo: rate budget full", exc.retry_after_s) from exc
        try:
            body = self._http.get_json(FORECAST_URL, self.params(points, start, hours))
        except HttpError as exc:
            if exc.status == 429:
                raise WeatherBusy(str(exc), RATE_LIMITED_RETRY_S) from exc
            raise WeatherUnavailable(str(exc)) from exc
        return parse_forecasts(body, len(points), start, hours)


def parse_forecasts(
    body: Any, expected: int, start: datetime, hours: int
) -> list[ForecastSeries | None]:
    """One series per requested point, each covering exactly `hours` from `start`.

    Hours the response doesn't cover, and null or NaN values, become missing
    (None) and rate as Unknown downstream, never Low.
    """
    locations = body if isinstance(body, list) else [body]  # one point -> one object
    if len(locations) != expected:
        raise WeatherUnavailable(
            f"Open-Meteo: asked for {expected} locations, got {len(locations)}"
        )
    return [_series(loc, start, hours) for loc in locations]


def _series(location: Any, start: datetime, hours: int) -> ForecastSeries | None:
    if not isinstance(location, Mapping) or not isinstance(location.get("hourly"), Mapping):
        return None
    units = location.get("hourly_units") or {}
    for name, unit in EXPECTED_UNITS.items():
        if units.get(name) != unit:
            raise WeatherUnavailable(
                f"Open-Meteo: expected {name} in {unit}, got {units.get(name)!r}"
            )
    hourly = location["hourly"]
    times = hourly.get("time")
    if not isinstance(times, list):
        return None
    index = {int(t): i for i, t in enumerate(times) if isinstance(t, int | float)}

    def value(name: str, i: int) -> float | None:
        column = hourly.get(name)
        if not isinstance(column, list) or i >= len(column):
            return None
        v = column[i]
        if not isinstance(v, int | float) or isinstance(v, bool) or not math.isfinite(v):
            return None
        return float(v)

    forecasts = []
    for h in range(hours):
        stamp = start + timedelta(hours=h)
        i = index.get(int(stamp.timestamp()))
        if i is None:
            forecasts.append(Forecast(stamp, None, None, None))
            continue
        gust, wind = value("wind_gusts_10m", i), value("wind_speed_10m", i)
        rain, showers, snow = value("rain", i), value("showers", i), value("snowfall", i)
        code = value("weather_code", i)
        forecasts.append(
            Forecast(
                valid_hour=stamp,
                gust_mph=None if gust is None else kmh_to_mph(gust),
                rain_in_hr=None if rain is None or showers is None else mm_to_in(rain + showers),
                snow_in_hr=None if snow is None else cm_to_in(snow),
                wind_mph=None if wind is None else kmh_to_mph(wind),
                weather_code=None if code is None else int(code),
            )
        )
    return ForecastSeries(start, tuple(forecasts))
