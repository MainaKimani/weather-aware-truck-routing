"""Hours of Service planner (PRD §7.3.1, RFC §6.2.1).

A pure function from total driving time and the driver's starting clocks to
the stops the rules require, plus the mapping from driving time to elapsed
clock time. Integer seconds throughout, so limit checks are exact.

Simplifications (PRD §7.3.1): all trip time is driving; weekly hours don't
roll off during the trip; no sleeper-berth split or exemptions; stops are
taken where the limit is reached.
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Final, Literal

from planner.domain.eta import DriveProfile, eta
from planner.domain.sampling import RouteGeometry
from planner.domain.types import LatLon

HOUR: Final = 3600


@dataclass(frozen=True)
class HosRules:
    """US property-carrying limits. Constants, not settings."""

    max_drive_s: int = 11 * HOUR
    window_s: int = 14 * HOUR
    drive_before_break_s: int = 8 * HOUR
    break_s: int = 30 * 60
    rest_s: int = 10 * HOUR
    restart_s: int = 34 * HOUR


DEFAULT_RULES: Final = HosRules()


class Cycle(Enum):
    H70_8D = 70 * HOUR
    H60_7D = 60 * HOUR


@dataclass(frozen=True)
class HosClocks:
    """What the driver's ELD shows, all as time remaining."""

    cycle: Cycle
    drive_left_s: int
    window_left_s: int
    until_break_s: int
    cycle_left_s: int

    def __post_init__(self) -> None:
        limits = {
            "drive_left_s": DEFAULT_RULES.max_drive_s,
            "window_left_s": DEFAULT_RULES.window_s,
            "until_break_s": DEFAULT_RULES.drive_before_break_s,
            "cycle_left_s": self.cycle.value,
        }
        for name, limit in limits.items():
            value = getattr(self, name)
            if not 0 <= value <= limit:
                raise ValueError(f"{name} must be between 0 and {limit}, got {value}")

    @classmethod
    def rested(cls, cycle: Cycle = Cycle.H70_8D) -> "HosClocks":
        r = DEFAULT_RULES
        return cls(cycle, r.max_drive_s, r.window_s, r.drive_before_break_s, cycle.value)


class StopKind(Enum):
    BREAK = "break"  # 30 min
    REST = "rest"  # 10 h
    RESTART = "restart"  # 34 h


StopReason = Literal["break", "drive_limit", "window", "cycle"]


@dataclass(frozen=True)
class Stop:
    kind: StopKind
    at_drive_s: int  # driving completed when the stop starts
    duration_s: int
    reason: StopReason


@dataclass(frozen=True)
class HosPlan:
    total_drive_s: int
    stops: tuple[Stop, ...] = field(default_factory=tuple)

    def clock_offset(self, drive_s: float) -> float:
        """Elapsed clock time once `drive_s` of driving is done.

        A stop exactly at `drive_s` comes after the truck arrives there, so
        it isn't counted.
        """
        return drive_s + sum(s.duration_s for s in self.stops if s.at_drive_s < drive_s)

    @property
    def trip_duration_s(self) -> int:
        return self.total_drive_s + sum(s.duration_s for s in self.stops)

    def count(self, kind: StopKind) -> int:
        return sum(1 for s in self.stops if s.kind is kind)


MAX_ITERATIONS: Final = 1_000

# Checked longest stop first, so coinciding limits produce one stop that
# satisfies all of them: a restart covers everything, a rest covers a break.
_CHECK_ORDER: Final[tuple[StopReason, ...]] = ("cycle", "drive_limit", "window", "break")


def plan_hos(total_drive_s: int, clocks: HosClocks, rules: HosRules = DEFAULT_RULES) -> HosPlan:
    """Drive until the nearest limit, take the stop it needs, repeat."""
    if total_drive_s < 0:
        raise ValueError("total driving time must not be negative")

    stops: list[Stop] = []
    driven = 0
    drive_left = clocks.drive_left_s
    window_left = clocks.window_left_s
    until_break = clocks.until_break_s
    cycle_left = clocks.cycle_left_s

    for _ in range(MAX_ITERATIONS):
        step = max(0, min(total_drive_s - driven, cycle_left, drive_left, window_left, until_break))
        driven += step
        drive_left -= step
        window_left -= step
        until_break -= step
        cycle_left -= step
        if driven >= total_drive_s:
            return HosPlan(total_drive_s, tuple(stops))

        remaining = {
            "cycle": cycle_left,
            "drive_limit": drive_left,
            "window": window_left,
            "break": until_break,
        }
        hit = next(k for k in _CHECK_ORDER if remaining[k] <= 0)
        # A break that would use up the rest of the window is pointless: the
        # driver would need a 10 h rest straight after it, and that rest also
        # counts as the break.
        if hit == "break" and window_left - rules.break_s <= 0:
            hit = "window"

        if hit == "cycle":
            stops.append(Stop(StopKind.RESTART, driven, rules.restart_s, "cycle"))
            drive_left, window_left = rules.max_drive_s, rules.window_s
            until_break, cycle_left = rules.drive_before_break_s, clocks.cycle.value
        elif hit in ("drive_limit", "window"):
            stops.append(Stop(StopKind.REST, driven, rules.rest_s, hit))
            drive_left, window_left = rules.max_drive_s, rules.window_s
            until_break = rules.drive_before_break_s
        else:
            stops.append(Stop(StopKind.BREAK, driven, rules.break_s, "break"))
            until_break = rules.drive_before_break_s
            window_left -= rules.break_s  # breaks don't pause the 14 h window

    raise RuntimeError("HOS planner did not converge")  # pragma: no cover - guarded invariant


@dataclass(frozen=True)
class PlacedStop:
    stop: Stop
    mile: float
    position: LatLon
    start: datetime


def place_stops(
    plan: HosPlan, profile: DriveProfile, geometry: RouteGeometry, departure: datetime
) -> list[PlacedStop]:
    """Where and when each stop happens, using the reverse ETA lookup."""
    placed = []
    for stop in plan.stops:
        mile = profile.mile_at(stop.at_drive_s)
        start = eta(departure, plan.clock_offset(stop.at_drive_s))
        placed.append(PlacedStop(stop, mile, geometry.position_at(mile), start))
    return placed
