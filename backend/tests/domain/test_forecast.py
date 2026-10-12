from datetime import UTC, datetime, timedelta

import pytest

from planner.domain.forecast import ForecastSeries
from planner.domain.types import Forecast

START = datetime(2026, 10, 12, 6, tzinfo=UTC)


def series(n: int = 3) -> ForecastSeries:
    hours = tuple(
        Forecast(START + timedelta(hours=i), gust_mph=float(i), rain_in_hr=0.0, snow_in_hr=0.0)
        for i in range(n)
    )
    return ForecastSeries(START, hours)


def test_lookup_by_hour() -> None:
    s = series()

    assert s.at(START + timedelta(hours=2)) is s.hours[2]
    assert s.end == START + timedelta(hours=2)


def test_outside_or_between_hours_is_missing() -> None:
    s = series()

    assert s.at(START - timedelta(hours=1)) is None
    assert s.at(START + timedelta(hours=3)) is None
    assert s.at(START + timedelta(minutes=30)) is None


def test_eta_uses_the_hour_it_falls_in() -> None:
    s = series()

    assert s.for_eta(START + timedelta(minutes=20)) is s.hours[1]
    assert s.for_eta(START + timedelta(hours=1)) is s.hours[1]
    assert s.for_eta(START + timedelta(hours=2, seconds=1)) is None  # beyond the horizon


def test_must_start_on_the_hour() -> None:
    with pytest.raises(ValueError, match="on the hour"):
        ForecastSeries(START + timedelta(minutes=5), ())
