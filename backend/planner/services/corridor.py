"""The corridor heatmap: risk on a lattice around the routes, hour by hour (RFC §8).

1. Simplify each route (Douglas-Peucker, ~1 km) and take lattice points
   within 40 miles of any of them. A fixed global lattice means plans in the
   same region share grid points and so share cached forecasts.
2. If that gives more than ~700 points, step the lattice up (0.25 deg, then
   0.5, then 1) until it doesn't, which bounds latency and quota on
   coast-to-coast trips.
3. Fetch forecasts cache-first and classify every point-hour with the same
   `classify` as the checkpoints, for the plan's load, so the map and the
   route cards can't disagree.

Hours run from now (PRD A10), not from departure. Hour 0 is the hour in
progress: like a checkpoint whose ETA falls in it, it reads the forecast
record stamped at the end of that hour (RFC §6.3).
"""

import logging
import time
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Final

from planner.domain.eta import ceil_to_hour
from planner.domain.geo import lattice_near, simplify
from planner.domain.risk import Level, classify
from planner.domain.types import LatLon
from planner.services.forecasts import ForecastStore

BUFFER_MI: Final = 40.0
SIMPLIFY_MI: Final = 0.62  # about 1 km
POINT_CAP: Final = 700
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
) -> HeatmapGrid:
    started = time.perf_counter()
    step, points = corridor_points(lines)
    start = ceil_to_hour(clock())
    weather_started = time.perf_counter()
    lookup = store.get(points, step)
    weather_ms = round((time.perf_counter() - weather_started) * 1000)
    hours = [start + timedelta(hours=h) for h in range(HOURS)]
    risk = []
    for p in points:
        series = lookup.for_point(p)
        risk.append(tuple(classify(series.at(t) if series else None, load_lb).level for t in hours))
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
    )
