"""Driving time along a route, and forecast-hour selection (RFC §6.2, §6.3).

The provider reports each span's length and (traffic-aware) driving time.
`DriveProfile` turns that into a piecewise-linear map from distance to
driving time and back: forwards for checkpoint ETAs, backwards to place
Hours of Service stops on the map.
"""

from bisect import bisect_right
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Self

from planner.domain.types import Span


@dataclass(frozen=True)
class DriveProfile:
    """Cumulative distance (reported miles) against cumulative driving seconds."""

    miles: tuple[float, ...]
    seconds: tuple[float, ...]
    estimated: bool  # True when built from route totals only (no spans)

    @classmethod
    def build(cls, spans: Sequence[Span], distance_mi: float, duration_s: float) -> Self:
        """Profile from per-span data, scaled to the route's reported totals.

        Spans normally add up to the summary; scaling removes any small
        mismatch so distances agree with checkpoint miles and the last ETA
        agrees with the reported duration. Without spans, the whole route is
        one span: less accurate, since speed changes along the way are lost.
        """
        if distance_mi <= 0:
            raise ValueError("route distance must be positive")
        if duration_s < 0:
            raise ValueError("route duration must not be negative")
        if any(s.length_mi < 0 or s.duration_s < 0 for s in spans):
            raise ValueError("span lengths and durations must not be negative")

        span_mi = sum(s.length_mi for s in spans)
        span_s = sum(s.duration_s for s in spans)
        if not spans or span_mi <= 0:
            return cls((0.0, distance_mi), (0.0, float(duration_s)), estimated=True)

        mi_scale = distance_mi / span_mi
        s_scale = duration_s / span_s if span_s > 0 else 0.0
        miles, seconds = [0.0], [0.0]
        for span in spans:
            miles.append(miles[-1] + span.length_mi * mi_scale)
            seconds.append(seconds[-1] + span.duration_s * s_scale)
        # Pin the ends to the totals exactly; summing floats drifts a little.
        miles[-1], seconds[-1] = distance_mi, float(duration_s)
        return cls(tuple(miles), tuple(seconds), estimated=False)

    @property
    def distance_mi(self) -> float:
        return self.miles[-1]

    @property
    def duration_s(self) -> float:
        return self.seconds[-1]

    def drive_s_at(self, mile: float) -> float:
        """Driving seconds from the start to `mile`, clamped to the route."""
        return _interpolate(self.miles, self.seconds, mile)

    def mile_at(self, drive_s: float) -> float:
        """Miles covered after `drive_s` seconds of driving, clamped to the route."""
        return _interpolate(self.seconds, self.miles, drive_s)


def _interpolate(xs: Sequence[float], ys: Sequence[float], x: float) -> float:
    """Piecewise-linear y(x) over non-decreasing xs, clamped to the ends.

    Where xs repeats (a zero-length or zero-duration span), the later y wins,
    which puts a point at the far end of a stretch that takes no time.
    """
    if x <= xs[0]:
        return ys[0]
    if x >= xs[-1]:
        return ys[-1]
    i = bisect_right(xs, x)  # xs[i-1] <= x < xs[i]
    x0, x1, y0, y1 = xs[i - 1], xs[i], ys[i - 1], ys[i]
    return y1 if x1 == x0 else y0 + (y1 - y0) * (x - x0) / (x1 - x0)


def require_aware(t: datetime) -> datetime:
    if t.tzinfo is None or t.utcoffset() is None:
        raise ValueError("datetime must be timezone-aware")
    return t.astimezone(UTC)


def eta(departure: datetime, elapsed_s: float) -> datetime:
    """Clock time after `elapsed_s` seconds, in UTC."""
    return require_aware(departure) + timedelta(seconds=elapsed_s)


def ceil_to_hour(t: datetime) -> datetime:
    """The forecast hour a moment falls in (RFC §6.3).

    Hourly precipitation stamped T covers (T-1h, T], so a truck at 10:20 is
    in the hour stamped 11:00, and one at exactly 11:00 is in 11:00.
    """
    t = require_aware(t)
    floor = t.replace(minute=0, second=0, microsecond=0)
    return floor if floor == t else floor + timedelta(hours=1)
