from datetime import UTC, datetime, timedelta, timezone
from itertools import pairwise

import pytest
from hypothesis import given
from hypothesis import strategies as st

from planner.domain.eta import DriveProfile, ceil_to_hour, eta
from planner.domain.types import Span

# Fast highway, slow city stretch, highway again.
SPANS = [Span(60.0, 3600.0), Span(10.0, 1800.0), Span(30.0, 1800.0)]

spans_strategy = st.lists(
    st.builds(
        Span,
        st.floats(min_value=0.01, max_value=200),
        st.floats(min_value=1, max_value=20_000),
    ),
    min_size=1,
    max_size=30,
)


class TestDriveProfile:
    def test_follows_span_speeds(self) -> None:
        p = DriveProfile.build(SPANS, distance_mi=100.0, duration_s=7200.0)

        assert p.drive_s_at(0) == 0.0
        assert p.drive_s_at(30) == pytest.approx(1800.0)  # 60 mph
        assert p.drive_s_at(65) == pytest.approx(3600.0 + 900.0)  # 20 mph through town
        assert p.drive_s_at(100) == 7200.0
        assert not p.estimated

    def test_scales_spans_to_reported_totals(self) -> None:
        p = DriveProfile.build(SPANS, distance_mi=105.0, duration_s=7920.0)

        assert p.distance_mi == 105.0
        assert p.duration_s == 7920.0
        assert p.drive_s_at(105.0 * 0.6) == pytest.approx(7920.0 * 0.5)

    def test_without_spans_interpolates_whole_route(self) -> None:
        p = DriveProfile.build([], distance_mi=100.0, duration_s=6000.0)

        assert p.estimated
        assert p.drive_s_at(50) == pytest.approx(3000.0)

    def test_clamps_outside_route(self) -> None:
        p = DriveProfile.build(SPANS, 100.0, 7200.0)

        assert p.drive_s_at(-5) == 0.0
        assert p.drive_s_at(500) == 7200.0
        assert p.mile_at(-5) == 0.0
        assert p.mile_at(10**6) == 100.0

    def test_reverse_lookup(self) -> None:
        p = DriveProfile.build(SPANS, 100.0, 7200.0)

        assert p.mile_at(4500.0) == pytest.approx(65.0)

    def test_zero_duration_span_maps_back_to_its_far_end(self) -> None:
        p = DriveProfile.build([Span(10, 600), Span(5, 0), Span(10, 600)], 25.0, 1200.0)

        assert p.mile_at(600.0) == pytest.approx(15.0)
        assert p.drive_s_at(12.0) == pytest.approx(600.0)

    @pytest.mark.parametrize(
        ("spans", "distance", "duration", "message"),
        [
            (SPANS, 0.0, 100.0, "distance"),
            (SPANS, 10.0, -1.0, "duration"),
            ([Span(-1.0, 10.0)], 10.0, 10.0, "negative"),
        ],
    )
    def test_rejects_bad_input(
        self, spans: list[Span], distance: float, duration: float, message: str
    ) -> None:
        with pytest.raises(ValueError, match=message):
            DriveProfile.build(spans, distance, duration)

    @given(spans_strategy, st.lists(st.floats(0, 1), min_size=2, max_size=40))
    def test_etas_never_decrease(self, spans: list[Span], fractions: list[float]) -> None:
        total = sum(s.length_mi for s in spans)
        p = DriveProfile.build(spans, total, sum(s.duration_s for s in spans))

        times = [p.drive_s_at(f * total) for f in sorted(fractions)]

        assert all(b >= a for a, b in pairwise(times))

    @given(spans_strategy, st.floats(0, 1))
    def test_forward_then_reverse_returns_the_distance(
        self, spans: list[Span], fraction: float
    ) -> None:
        total = sum(s.length_mi for s in spans)
        p = DriveProfile.build(spans, total, sum(s.duration_s for s in spans))
        mile = fraction * total

        assert p.mile_at(p.drive_s_at(mile)) == pytest.approx(mile, abs=0.01)


class TestEta:
    def test_adds_elapsed_time_in_utc(self) -> None:
        departure = datetime(2026, 10, 12, 6, 0, tzinfo=timezone(timedelta(hours=-5)))

        assert eta(departure, 5400) == datetime(2026, 10, 12, 12, 30, tzinfo=UTC)

    def test_rejects_naive_datetime(self) -> None:
        naive = datetime(2026, 10, 12, 6, 0)  # noqa: DTZ001 - the point of the test

        with pytest.raises(ValueError, match="timezone-aware"):
            eta(naive, 60)


class TestCeilToHour:
    def test_exactly_on_the_hour_selects_that_hour(self) -> None:
        t = datetime(2026, 10, 12, 11, 0, tzinfo=UTC)

        assert ceil_to_hour(t) == t

    def test_one_second_past_selects_the_next(self) -> None:
        t = datetime(2026, 10, 12, 11, 0, 1, tzinfo=UTC)

        assert ceil_to_hour(t) == datetime(2026, 10, 12, 12, 0, tzinfo=UTC)

    def test_one_microsecond_past_selects_the_next(self) -> None:
        t = datetime(2026, 10, 12, 11, 0, 0, 1, tzinfo=UTC)

        assert ceil_to_hour(t) == datetime(2026, 10, 12, 12, 0, tzinfo=UTC)

    def test_crosses_midnight_and_normalises_to_utc(self) -> None:
        t = datetime(2026, 10, 12, 18, 30, tzinfo=timezone(timedelta(hours=-6)))

        assert ceil_to_hour(t) == datetime(2026, 10, 13, 1, 0, tzinfo=UTC)

    def test_half_hour_offset_zone(self) -> None:
        # India is UTC+5:30: 10:00 local is 04:30 UTC, in the 05:00 hour.
        t = datetime(2026, 10, 12, 10, 0, tzinfo=timezone(timedelta(hours=5, minutes=30)))

        assert ceil_to_hour(t) == datetime(2026, 10, 12, 5, 0, tzinfo=UTC)
