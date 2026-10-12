"""Checkpoint sampling along a route, and the miles each checkpoint owns (RFC §6.1).

Distances here are in the provider's reported miles. The decoded polyline is
a little shorter or longer than the distance the provider reports, so its
geometric length is scaled to match. Checkpoint miles then line up with the
route summary (a checkpoint at "mile 25" is 25 reported miles in) and owned
miles add up to the reported distance.
"""

from dataclasses import dataclass
from typing import Final, Self

from planner.domain.geo import cumulative_mi, point_at_mi
from planner.domain.types import LatLon

ALLOWED_INTERVALS_MI: Final = (10, 25, 50)

# Checkpoints closer than this to the destination are folded into it, so a
# route of exactly 50 mi sampled every 25 mi gives 0, 25, 50 and not a
# second checkpoint a rounding error away from the last.
_SAME_MILE: Final = 1e-6


@dataclass(frozen=True)
class RouteGeometry:
    """A route's polyline, with distances measured in reported miles."""

    line: tuple[LatLon, ...]
    cumulative: tuple[float, ...]  # geometric miles from the start to each vertex
    scale: float  # reported miles per geometric mile

    @classmethod
    def build(cls, line: tuple[LatLon, ...], reported_distance_mi: float | None = None) -> Self:
        if len(line) < 2:
            raise ValueError("a route needs at least two points")
        cumulative = tuple(cumulative_mi(line))
        geometric = cumulative[-1]
        if geometric <= 0:
            raise ValueError("route has zero length")
        if reported_distance_mi is not None and reported_distance_mi <= 0:
            raise ValueError("reported distance must be positive")
        scale = 1.0 if reported_distance_mi is None else reported_distance_mi / geometric
        return cls(line, cumulative, scale)

    @property
    def length_mi(self) -> float:
        return self.cumulative[-1] * self.scale

    def position_at(self, mile: float) -> LatLon:
        """The point `mile` reported miles from the start, clamped to the ends."""
        return point_at_mi(self.line, self.cumulative, mile / self.scale)


@dataclass(frozen=True)
class SamplePoint:
    index: int
    mile: float  # reported miles from the origin
    owned_mi: float  # half the gap to each neighbour
    position: LatLon


def checkpoint_miles(length_mi: float, interval_mi: int) -> list[float]:
    """0, N, 2N, ... below the route length, then the destination."""
    if interval_mi not in ALLOWED_INTERVALS_MI:
        raise ValueError(f"interval must be one of {ALLOWED_INTERVALS_MI}, got {interval_mi}")
    if length_mi <= 0:
        raise ValueError("route has zero length")
    miles = []
    k = 0
    while k * interval_mi < length_mi - _SAME_MILE:
        miles.append(float(k * interval_mi))
        k += 1
    miles.append(length_mi)
    return miles


def owned_miles(miles: list[float]) -> list[float]:
    """Each checkpoint owns from the midpoint with its predecessor to the one with its successor.

    The first and last own half a gap, so the total telescopes to the span
    from the first checkpoint to the last: the whole route.
    """
    n = len(miles)
    if n < 2:
        raise ValueError("need at least two checkpoints")
    owned = [0.0] * n
    owned[0] = (miles[1] - miles[0]) / 2
    owned[-1] = (miles[-1] - miles[-2]) / 2
    for i in range(1, n - 1):
        owned[i] = (miles[i + 1] - miles[i - 1]) / 2
    return owned


def sample_checkpoints(geometry: RouteGeometry, interval_mi: int) -> list[SamplePoint]:
    """Checkpoints every `interval_mi` reported miles, plus the destination."""
    miles = checkpoint_miles(geometry.length_mi, interval_mi)
    owned = owned_miles(miles)
    return [
        SamplePoint(i, mile, own, geometry.position_at(mile))
        for i, (mile, own) in enumerate(zip(miles, owned, strict=True))
    ]
