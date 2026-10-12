"""Risk classification (PRD §7.4, RFC §6.4).

Thresholds and load rules are data. A value takes the highest level whose
lower bound it meets (lower bounds inclusive); rain and snow become No Travel
only when strictly above their top limit, as the brief's table is written.
Wind thresholds apply to gusts.
"""

import math
from dataclasses import dataclass
from enum import IntEnum
from typing import Final, Literal

from planner.domain.types import Forecast


class Level(IntEnum):
    LOW = 0
    MODERATE = 1
    HIGH = 2
    SEVERE = 3
    NO_TRAVEL = 4


Condition = Literal["wind", "rain", "snow"]
LoadRule = Literal["wind_45_54_over_30k", "wind_35_44_over_40k"]
Bands = tuple[tuple[float, Level], ...]

# (lower bound, level), highest first.
WIND_MPH: Final[Bands] = (
    (55, Level.NO_TRAVEL),
    (45, Level.SEVERE),
    (35, Level.HIGH),
    (25, Level.MODERATE),
)
RAIN_IN_HR: Final[Bands] = ((0.50, Level.SEVERE), (0.25, Level.HIGH), (0.10, Level.MODERATE))
SNOW_IN_HR: Final[Bands] = ((2.0, Level.SEVERE), (1.0, Level.HIGH), (0.5, Level.MODERATE))
RAIN_NO_TRAVEL_ABOVE: Final = 1.00
SNOW_NO_TRAVEL_ABOVE: Final = 3.0


@dataclass(frozen=True)
class LoadRuleSpec:
    name: LoadRule
    gust_from: float  # inclusive
    gust_below: float  # exclusive
    over_lb: int  # applies when load is strictly greater
    level: Level  # the wind level becomes at least this


LOAD_RULES: Final = (
    LoadRuleSpec("wind_45_54_over_30k", 45, 55, 30_000, Level.NO_TRAVEL),
    LoadRuleSpec("wind_35_44_over_40k", 35, 45, 40_000, Level.SEVERE),
)

# When two conditions give the same level, the one named first is the driver.
CONDITION_ORDER: Final[tuple[Condition, ...]] = ("wind", "rain", "snow")


def band(value: float, bands: Bands) -> Level:
    for bound, level in bands:
        if value >= bound:
            return level
    return Level.LOW


def band_with_strict_top(value: float, bands: Bands, no_travel_above: float) -> Level:
    return Level.NO_TRAVEL if value > no_travel_above else band(value, bands)


def apply_load_rules(gust_mph: float, base: Level, load_lb: int) -> tuple[Level, LoadRule | None]:
    """Raise the wind level for heavy loads. Gusts of 55+ are No Travel at any load."""
    for rule in LOAD_RULES:
        if rule.gust_from <= gust_mph < rule.gust_below and load_lb > rule.over_lb:
            return max(base, rule.level), rule.name
    return base, None


@dataclass(frozen=True)
class RiskResult:
    """A checkpoint's rating, with every intermediate level so the UI can explain it.

    `level` is None when the rating is Unknown (missing forecast data).
    """

    level: Level | None
    driver: Condition | None
    wind: Level | None
    wind_adjusted: Level | None
    rain: Level | None
    snow: Level | None
    load_rule: LoadRule | None

    @property
    def known(self) -> bool:
        return self.level is not None


UNKNOWN: Final = RiskResult(None, None, None, None, None, None, None)


def _usable(value: float | None) -> float | None:
    """Provider values that are missing, NaN, infinite or negative count as missing."""
    if value is None or not math.isfinite(value) or value < 0:
        return None
    return value


def classify(forecast: Forecast | None, load_lb: int) -> RiskResult:
    """Rate one point-hour for a load. Missing data gives Unknown, never Low.

    The exception: if a known condition is already No Travel, the missing
    ones can't change the outcome, so the result is No Travel.
    """
    if load_lb < 0:
        raise ValueError("load must not be negative")
    if forecast is None:
        return UNKNOWN

    gust = _usable(forecast.gust_mph)
    rain = _usable(forecast.rain_in_hr)
    snow = _usable(forecast.snow_in_hr)

    wind_base = wind_adj = None
    load_rule: LoadRule | None = None
    if gust is not None:
        wind_base = band(gust, WIND_MPH)
        wind_adj, load_rule = apply_load_rules(gust, wind_base, load_lb)
    rain_level = (
        None if rain is None else band_with_strict_top(rain, RAIN_IN_HR, RAIN_NO_TRAVEL_ABOVE)
    )
    snow_level = (
        None if snow is None else band_with_strict_top(snow, SNOW_IN_HR, SNOW_NO_TRAVEL_ABOVE)
    )

    levels: dict[Condition, Level | None] = {
        "wind": wind_adj,
        "rain": rain_level,
        "snow": snow_level,
    }
    known = {k: v for k, v in levels.items() if v is not None}
    worst = max(known.values(), default=None)
    complete = len(known) == len(levels)

    if worst is None or (not complete and worst != Level.NO_TRAVEL):
        level, driver = None, None
    else:
        level = worst
        driver = next(k for k in CONDITION_ORDER if known.get(k) == worst)
    return RiskResult(level, driver, wind_base, wind_adj, rain_level, snow_level, load_rule)
