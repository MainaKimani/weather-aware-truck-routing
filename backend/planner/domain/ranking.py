"""Route ranking and the recommendation reason (PRD §7.6, RFC §6.6).

Routes sort by No Travel miles, then Severe, then High (each rounded to the
whole mile), then average risk in 0.05 steps, then travel time. Quantising
average risk into fixed steps, rather than comparing "within 0.05 of each
other", keeps the order transitive: near-equal risk falls to travel time.
"""

import math
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Final, Literal

from planner.domain.metrics import RouteMetrics

RISK_AVG_TOLERANCE: Final = 0.05
UNKNOWN_WARNING_SHARE: Final = 0.20
_UNKNOWN_RISK_STEP: Final = 10**6  # all-Unknown routes sort after any known risk

Criterion = Literal["no_travel", "severe", "high", "avg_risk", "duration"]
ReasonCode = Literal[Criterion, "tie", "only_route", "no_drivable_route"]
CRITERIA: Final[tuple[Criterion, ...]] = ("no_travel", "severe", "high", "avg_risk", "duration")


@dataclass(frozen=True)
class Candidate:
    route_id: str
    metrics: RouteMetrics
    duration_s: float  # total trip time when Hours of Service is on


@dataclass(frozen=True)
class Warning:
    code: Literal["high_unknown"]
    route_id: str
    message: str


@dataclass(frozen=True)
class Ranking:
    ranked: tuple[Candidate, ...]
    recommended_id: str | None
    reason_code: ReasonCode
    reason: str
    warnings: tuple[Warning, ...]


def whole_miles(miles: float) -> int:
    return math.floor(miles + 0.5)


def risk_step(avg_risk: float | None, step: float = RISK_AVG_TOLERANCE) -> int:
    """Which 0.05-wide band the average falls in: 1.02 and 1.04 share one."""
    if avg_risk is None:
        return _UNKNOWN_RISK_STEP
    return math.floor(avg_risk / step + 1e-9)  # 0.15 / 0.05 is 2.999...


def _criteria(c: Candidate) -> dict[Criterion, int]:
    m = c.metrics
    return {
        "no_travel": whole_miles(m.miles("NO_TRAVEL")),
        "severe": whole_miles(m.miles("SEVERE")),
        "high": whole_miles(m.miles("HIGH")),
        "avg_risk": risk_step(m.avg_risk),
        "duration": round(c.duration_s / 60),  # whole minutes
    }


def rank_key(c: Candidate) -> tuple[int, int, int, int, int, str]:
    k = _criteria(c)
    return (k["no_travel"], k["severe"], k["high"], k["avg_risk"], k["duration"], c.route_id)


def rank_routes(candidates: Sequence[Candidate]) -> Ranking:
    if not candidates:
        raise ValueError("nothing to rank")
    ranked = tuple(sorted(candidates, key=rank_key))
    best = ranked[0]
    warnings = tuple(
        Warning(
            "high_unknown",
            c.route_id,
            f"No forecast for {round(c.metrics.unknown_share * 100)}% of this route",
        )
        for c in ranked
        if c.metrics.unknown_share > UNKNOWN_WARNING_SHARE
    )

    if not best.metrics.drivable:
        # No Travel miles sort first, so if the best has any, they all do.
        return Ranking(
            ranked,
            None,
            "no_drivable_route",
            "Every route has No Travel conditions. Try a later departure.",
            warnings,
        )
    if len(ranked) == 1:
        return Ranking(ranked, best.route_id, "only_route", "Only route found", warnings)

    code, reason = _reason(best, ranked[1])
    return Ranking(ranked, best.route_id, code, reason, warnings)


def _reason(best: Candidate, runner_up: Candidate) -> tuple[ReasonCode, str]:
    """The first criterion that separates the winner from the runner-up, as a sentence."""
    a, b = _criteria(best), _criteria(runner_up)
    for criterion in CRITERIA:
        if a[criterion] != b[criterion]:
            return criterion, _sentence(criterion, best, runner_up)
    return "tie", "Same risk and travel time as the next route"


def _sentence(criterion: Criterion, best: Candidate, other: Candidate) -> str:
    if criterion == "no_travel":
        return _fewest("No Travel", best, other, "NO_TRAVEL")
    if criterion == "severe":
        return _fewest("severe", best, other, "SEVERE")
    if criterion == "high":
        return _fewest("high-risk", best, other, "HIGH")
    if criterion == "avg_risk":
        theirs = other.metrics.avg_risk
        theirs_text = "unknown" if theirs is None else f"{theirs:.2f}"
        return f"Lowest average risk ({best.metrics.avg_risk:.2f} vs {theirs_text})"
    return f"Same risk, {format_duration(other.duration_s - best.duration_s)} faster"


def _fewest(
    label: str, best: Candidate, other: Candidate, b: Literal["NO_TRAVEL", "SEVERE", "HIGH"]
) -> str:
    ours, theirs = whole_miles(best.metrics.miles(b)), whole_miles(other.metrics.miles(b))
    return f"Fewest {label} miles ({ours} vs {theirs})"


def format_duration(seconds: float) -> str:
    minutes = round(seconds / 60)
    hours, minutes = divmod(minutes, 60)
    if hours and minutes:
        return f"{hours} h {minutes} min"
    if hours:
        return f"{hours} h"
    return f"{minutes} min"
