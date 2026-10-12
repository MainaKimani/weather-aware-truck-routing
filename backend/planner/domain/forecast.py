"""Hourly forecasts for one point, and the lookup by ETA (RFC §6.3)."""

from dataclasses import dataclass
from datetime import datetime, timedelta

from planner.domain.eta import ceil_to_hour, require_aware
from planner.domain.types import Forecast


@dataclass(frozen=True)
class ForecastSeries:
    """Consecutive hourly forecasts starting at `start` (UTC, on the hour)."""

    start: datetime
    hours: tuple[Forecast, ...]

    def __post_init__(self) -> None:
        start = require_aware(self.start)
        if start != start.replace(minute=0, second=0, microsecond=0):
            raise ValueError("series must start on the hour")

    @property
    def end(self) -> datetime:
        """The last hour covered."""
        return self.start + timedelta(hours=len(self.hours) - 1)

    def at(self, hour: datetime) -> Forecast | None:
        """The forecast stamped `hour`, or None outside the series."""
        offset = require_aware(hour) - self.start
        index, rest = divmod(offset, timedelta(hours=1))
        if rest or not 0 <= index < len(self.hours):
            return None
        return self.hours[index]

    def for_eta(self, t: datetime) -> Forecast | None:
        """The forecast for the hour a truck at time `t` is driving through."""
        return self.at(ceil_to_hour(t))
