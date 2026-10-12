"""Risk rules, table-driven from PRD §7.4.

Every boundary in the acceptance criteria is tested at the bound and either
side of it. Load is 1 lb unless a load rule is the point of the test.
"""

import math
from datetime import UTC, datetime

import pytest
from hypothesis import given
from hypothesis import strategies as st

from planner.domain.risk import (
    UNKNOWN,
    Level,
    apply_load_rules,
    band,
    classify,
)
from planner.domain.types import Forecast

L, M, H, S, NT = Level.LOW, Level.MODERATE, Level.HIGH, Level.SEVERE, Level.NO_TRAVEL
HOUR = datetime(2026, 10, 12, 12, tzinfo=UTC)
LIGHT = 1


def fc(
    gust: float | None = 0.0,
    rain: float | None = 0.0,
    snow: float | None = 0.0,
    wind: float | None = None,
) -> Forecast:
    return Forecast(HOUR, gust_mph=gust, rain_in_hr=rain, snow_in_hr=snow, wind_mph=wind)


# Wind (gust, mph): < 25 Low | 25-35 Moderate | 35-45 High | 45-55 Severe | >= 55 No Travel
@pytest.mark.parametrize(
    ("gust", "expected"),
    [
        (0, L), (24.99, L), (25, M), (34.99, M), (35, H), (44.99, H),
        (45, S), (54.99, S), (55, NT), (90, NT),
    ],
)  # fmt: skip
def test_wind_bands(gust: float, expected: Level) -> None:
    result = classify(fc(gust=gust), LIGHT)

    assert result.wind == expected
    assert result.level == expected


# Rain (in/hr): < 0.10 Low | 0.10-0.25 Moderate | 0.25-0.50 High | 0.50-1.00 Severe | > 1.00
@pytest.mark.parametrize(
    ("rain", "expected"),
    [
        (0, L), (0.0999, L), (0.10, M), (0.2499, M), (0.25, H), (0.4999, H),
        (0.50, S), (1.00, S), (1.0001, NT),
    ],
)  # fmt: skip
def test_rain_bands(rain: float, expected: Level) -> None:
    result = classify(fc(rain=rain), LIGHT)

    assert result.rain == expected
    assert result.level == expected


# Snow (in/hr): < 0.5 Low | 0.5-1.0 Moderate | 1.0-2.0 High | 2.0-3.0 Severe | > 3.0
@pytest.mark.parametrize(
    ("snow", "expected"),
    [
        (0, L), (0.499, L), (0.5, M), (0.999, M), (1.0, H), (1.999, H),
        (2.0, S), (3.0, S), (3.0001, NT),
    ],
)  # fmt: skip
def test_snow_bands(snow: float, expected: Level) -> None:
    result = classify(fc(snow=snow), LIGHT)

    assert result.snow == expected
    assert result.level == expected


class TestLoadRules:
    @pytest.mark.parametrize(
        ("gust", "load", "expected", "rule"),
        [
            # 45 <= gust < 55 and load > 30,000 -> No Travel
            (45, 30_000, S, None),
            (45, 30_001, NT, "wind_45_54_over_30k"),
            (54.99, 30_000, S, None),
            (54.99, 30_001, NT, "wind_45_54_over_30k"),
            # 35 <= gust < 45 and load > 40,000 -> Severe
            (35, 40_000, H, None),
            (35, 40_001, S, "wind_35_44_over_40k"),
            (44.99, 40_000, H, None),
            (44.99, 40_001, S, "wind_35_44_over_40k"),
            # Outside the rule's wind band, weight doesn't matter.
            (34.99, 80_000, M, None),
            # >= 55 is No Travel at any load, from the table, not a load rule.
            (55, 1, NT, None),
            (55, 80_000, NT, None),
        ],
    )
    def test_boundaries(self, gust: float, load: int, expected: Level, rule: str | None) -> None:
        result = classify(fc(gust=gust), load)

        assert result.wind_adjusted == expected
        assert result.level == expected
        assert result.load_rule == rule

    def test_gap_case_stays_high(self) -> None:
        # 35,000 lb is over neither rule's threshold for a 40 mph gust.
        result = classify(fc(gust=40), 35_000)

        assert result.level == H
        assert result.load_rule is None

    def test_base_wind_level_is_kept_for_explanation(self) -> None:
        result = classify(fc(gust=50), 45_000)

        assert result.wind == S
        assert result.wind_adjusted == NT

    def test_only_raises_never_lowers(self) -> None:
        assert apply_load_rules(40, Level.NO_TRAVEL, 80_000) == (NT, "wind_35_44_over_40k")


class TestDriver:
    def test_worst_condition_drives(self) -> None:
        result = classify(fc(gust=30, rain=0.3, snow=0.6), LIGHT)

        assert result.level == H
        assert result.driver == "rain"

    @pytest.mark.parametrize(
        ("gust", "rain", "snow", "driver"),
        [
            (40, 0.3, 1.5, "wind"),  # all High
            (0, 0.3, 1.5, "rain"),  # rain and snow High
            (40, 0, 1.5, "wind"),  # wind and snow High
        ],
    )
    def test_ties_break_wind_then_rain_then_snow(
        self, gust: float, rain: float, snow: float, driver: str
    ) -> None:
        result = classify(fc(gust=gust, rain=rain, snow=snow), LIGHT)

        assert result.level == H
        assert result.driver == driver

    def test_all_low_is_driven_by_wind(self) -> None:
        assert classify(fc(), LIGHT).driver == "wind"


class TestSustainedWind:
    def test_never_changes_the_result(self) -> None:
        result = classify(fc(gust=10, wind=80), 80_000)

        assert result.level == L
        assert result.wind == L


class TestMissingData:
    def test_no_forecast_is_unknown(self) -> None:
        assert classify(None, LIGHT) == UNKNOWN
        assert not UNKNOWN.known

    @pytest.mark.parametrize(
        "forecast",
        [
            fc(gust=None),
            fc(rain=None),
            fc(snow=None),
            fc(gust=math.nan),
            fc(rain=math.inf),
            fc(snow=-1.0),
        ],
    )
    def test_any_missing_value_is_unknown_never_low(self, forecast: Forecast) -> None:
        result = classify(forecast, LIGHT)

        assert result.level is None
        assert result.driver is None
        assert not result.known

    def test_known_values_are_kept_for_display(self) -> None:
        result = classify(fc(gust=None, rain=0.3), LIGHT)

        assert result.level is None
        assert result.rain == H
        assert result.wind is None

    def test_known_no_travel_is_not_hidden_by_missing_data(self) -> None:
        result = classify(fc(gust=60, rain=None, snow=None), LIGHT)

        assert result.level == NT
        assert result.driver == "wind"

    def test_known_severe_with_missing_data_stays_unknown(self) -> None:
        # Missing rain could still be No Travel, so Severe would understate it.
        assert classify(fc(gust=50, rain=None), LIGHT).level is None


def test_negative_load_rejected() -> None:
    with pytest.raises(ValueError, match="load"):
        classify(fc(), -1)


def test_band_below_every_bound_is_low() -> None:
    assert band(-5, ((1.0, H),)) == L


@given(
    st.floats(0, 120),
    st.floats(0, 3),
    st.floats(0, 6),
    st.integers(1, 80_000),
)
def test_level_is_the_worst_component(gust: float, rain: float, snow: float, load: int) -> None:
    r = classify(fc(gust=gust, rain=rain, snow=snow), load)

    assert r.wind is not None
    assert r.wind_adjusted is not None
    assert r.rain is not None
    assert r.snow is not None
    assert r.level == max(r.wind_adjusted, r.rain, r.snow)
    assert r.wind_adjusted >= r.wind


@given(st.floats(0, 120), st.integers(1, 80_000), st.integers(1, 80_000))
def test_heavier_load_is_never_safer(gust: float, a: int, b: int) -> None:
    light, heavy = sorted((a, b))
    light_level = classify(fc(gust=gust), light).level
    heavy_level = classify(fc(gust=gust), heavy).level

    assert light_level is not None
    assert heavy_level is not None
    assert heavy_level >= light_level
