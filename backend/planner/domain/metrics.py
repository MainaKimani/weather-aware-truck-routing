"""Per-route aggregation of checkpoint risk (PRD §7.5, RFC §6.5)."""

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Final, Literal

from planner.domain.risk import Level

Bucket = Literal["LOW", "MODERATE", "HIGH", "SEVERE", "NO_TRAVEL", "UNKNOWN"]
BUCKETS: Final[tuple[Bucket, ...]] = ("LOW", "MODERATE", "HIGH", "SEVERE", "NO_TRAVEL", "UNKNOWN")


def bucket(level: Level | None) -> Bucket:
    if level is None:
        return "UNKNOWN"
    names: dict[Level, Bucket] = {
        Level.LOW: "LOW",
        Level.MODERATE: "MODERATE",
        Level.HIGH: "HIGH",
        Level.SEVERE: "SEVERE",
        Level.NO_TRAVEL: "NO_TRAVEL",
    }
    return names[level]


@dataclass(frozen=True)
class RatedCheckpoint:
    mile: float
    owned_mi: float
    level: Level | None  # None is Unknown


@dataclass(frozen=True)
class RouteMetrics:
    miles_by_level: dict[Bucket, float]
    avg_risk: float | None  # distance-weighted 0-4, Unknown excluded; None if all Unknown
    worst: Level | None
    worst_at_mile: float | None
    drivable: bool  # no No Travel checkpoint
    distance_mi: float

    def miles(self, b: Bucket) -> float:
        return self.miles_by_level[b]

    @property
    def unknown_miles(self) -> float:
        return self.miles_by_level["UNKNOWN"]

    @property
    def unknown_share(self) -> float:
        return self.unknown_miles / self.distance_mi if self.distance_mi > 0 else 0.0


def route_metrics(checkpoints: Sequence[RatedCheckpoint]) -> RouteMetrics:
    """Owned miles per level, average risk, worst point and drivability.

    Unknown miles are counted but excluded from the average, so missing data
    can't make a route look safer than the data we have says it is.
    """
    if not checkpoints:
        raise ValueError("a route needs checkpoints")
    miles: dict[Bucket, float] = dict.fromkeys(BUCKETS, 0.0)
    weighted = known_mi = 0.0
    worst: Level | None = None
    worst_at: float | None = None
    for cp in checkpoints:
        miles[bucket(cp.level)] += cp.owned_mi
        if cp.level is None:
            continue
        weighted += int(cp.level) * cp.owned_mi
        known_mi += cp.owned_mi
        if worst is None or cp.level > worst:
            worst, worst_at = cp.level, cp.mile
    return RouteMetrics(
        miles_by_level=miles,
        avg_risk=weighted / known_mi if known_mi > 0 else None,
        worst=worst,
        worst_at_mile=worst_at,
        drivable=all(cp.level != Level.NO_TRAVEL for cp in checkpoints),
        distance_mi=sum(cp.owned_mi for cp in checkpoints),
    )
