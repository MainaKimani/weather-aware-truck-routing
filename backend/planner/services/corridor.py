"""The corridor heatmap: risk on a lattice around the routes, hour by hour (RFC §8).

1. Simplify each route (Douglas-Peucker, ~1 km) and take lattice points
   within 30 miles of any of them. A fixed global lattice means plans in the
   same region share grid points and so share cached forecasts, including
   the checkpoints' (services/forecasts.py).
2. If that gives more than 500 points, step the lattice up (0.25 deg, then
   0.5, then 1) until it doesn't. Every point is an Open-Meteo call, and the
   free tier allows 600 a minute (540 after our margin), so a cold heatmap
   fits in one minute's budget. Dallas -> Denver at 0.25 deg is 453 points
   at 30 miles; at the earlier 40 miles it was 603. Demo data costs nothing,
   so its cap stays at 700 and the demo trip keeps the 0.25 deg lattice.
3. Fetch forecasts cache-first and classify every point-hour with the same
   `classify` as the checkpoints, for the plan's load, so the map and the
   route cards can't disagree. The levels of each condition (wind for the
   load, rain, snow) are kept too, for the map's metric switcher; they are
   the same levels a checkpoint's rating shows.

Hours run from now (PRD A10), not from departure. Hour 0 is the hour in
progress: like a checkpoint whose ETA falls in it, it reads the forecast
record stamped at the end of that hour (RFC §6.3).
"""

import logging
import time
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from itertools import repeat
from operator import attrgetter
from typing import Final

from planner.domain.eta import ceil_to_hour
from planner.domain.forecast import ForecastSeries
from planner.domain.geo import lattice_near, simplify
from planner.domain.risk import Level, classify
from planner.domain.types import Forecast, LatLon
from planner.services.forecasts import ForecastStore

BUFFER_MI: Final = 30.0
SIMPLIFY_MI: Final = 0.62  # about 1 km
POINT_CAP: Final = 500
DEMO_POINT_CAP: Final = 700
STEPS_DEG: Final = (0.25, 0.5, 1.0)
HOURS: Final = 49  # 0..48

logger = logging.getLogger("planner.corridor")


@dataclass(frozen=True)
class HeatmapGrid:
    start_hour: datetime  # the forecast hour read for slider hour 0
    hours: int
    cell_deg: float
    points: tuple[LatLon, ...]
    risk: tuple[tuple[Level | None, ...], ...]  # risk[i][h]; None is Unknown
    stale: bool
    forecast_as_of: datetime | None
    # Each condition's level, indexed like `risk`: wind after the load rules.
    wind: tuple[tuple[Level | None, ...], ...]
    rain: tuple[tuple[Level | None, ...], ...]
    snow: tuple[tuple[Level | None, ...], ...]


def corridor_points(
    lines: Sequence[Sequence[LatLon]], cap: int = POINT_CAP
) -> tuple[float, list[LatLon]]:
    """Lattice points within the buffer, on the finest lattice that fits the cap."""
    simplified = [simplify(line, SIMPLIFY_MI) for line in lines]
    for step in STEPS_DEG:
        points = lattice_near(simplified, BUFFER_MI, step)
        if len(points) <= cap:
            break
    return step, points  # the coarsest lattice if even that is over the cap


def corridor_grid(
    lines: Sequence[Sequence[LatLon]],
    load_lb: int,
    store: ForecastStore,
    clock: Callable[[], datetime] = lambda: datetime.now(UTC),
    cap: int = POINT_CAP,
) -> HeatmapGrid:
    started = time.perf_counter()
    step, points = corridor_points(lines, cap)
    start = ceil_to_hour(clock())
    weather_started = time.perf_counter()
    lookup = store.get(points, step)
    weather_ms = round((time.perf_counter() - weather_started) * 1000)
    risk, wind, rain, snow = [], [], [], []
    for p in points:
        # map and zip keep the per-hour loop in C: about 28,000 point-hours
        # coast to coast, so only `classify` itself runs per hour.
        ratings = map(classify, _window(lookup.for_point(p), start), repeat(load_lb))
        point_risk, point_wind, point_rain, point_snow = zip(*map(_LEVELS, ratings), strict=True)
        risk.append(point_risk)
        wind.append(point_wind)
        rain.append(point_rain)
        snow.append(point_snow)
    logger.info(
        "heatmap %d points at %g deg",
        len(points),
        step,
        extra={
            "event": "heatmap",
            "grid_points": len(points),
            "cell_deg": step,
            "cache_hit_ratio": round(lookup.cache_hits / len(points), 3) if points else None,
            "weather_ms": weather_ms,
            "total_ms": round((time.perf_counter() - started) * 1000),
            "stale": lookup.stale,
        },
    )
    return HeatmapGrid(
        start_hour=start,
        hours=HOURS,
        cell_deg=step,
        points=tuple(points),
        risk=tuple(risk),
        stale=lookup.stale,
        forecast_as_of=lookup.oldest_fetch,
        wind=tuple(wind),
        rain=tuple(rain),
        snow=tuple(snow),
    )


# Overall level, then each condition's: wind after the load rules, rain, snow.
_LEVELS: Final = attrgetter("level", "wind_adjusted", "rain", "snow")


def _window(series: ForecastSeries | None, start: datetime) -> Sequence[Forecast | None]:
    """The series' forecasts for the grid's hours, as `series.at` gives them hour by hour.

    The offset is found once per point rather than once per point-hour.
    """
    if series is None:
        return (None,) * HOURS
    # Both are on the hour (ForecastSeries requires it; `start` is rounded up).
    first = (start - series.start) // timedelta(hours=1)
    available = series.hours
    if first >= 0 and first + HOURS <= len(available):
        return available[first : first + HOURS]
    return [available[i] if 0 <= i < len(available) else None for i in range(first, first + HOURS)]
