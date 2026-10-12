from datetime import UTC, datetime, timedelta
from itertools import pairwise

import pytest
from hypothesis import given
from hypothesis import strategies as st

from planner.domain.eta import DriveProfile
from planner.domain.hos import (
    DEFAULT_RULES,
    HOUR,
    Cycle,
    HosClocks,
    HosPlan,
    Stop,
    StopKind,
    place_stops,
    plan_hos,
)
from planner.domain.sampling import RouteGeometry
from planner.domain.types import LatLon

R = DEFAULT_RULES
BREAK, REST, RESTART = StopKind.BREAK, StopKind.REST, StopKind.RESTART


def clocks(
    drive: float = 11,
    window: float = 14,
    until_break: float = 8,
    cycle_left: float = 70,
    cycle: Cycle = Cycle.H70_8D,
) -> HosClocks:
    return HosClocks(
        cycle,
        int(drive * HOUR),
        int(window * HOUR),
        int(until_break * HOUR),
        int(cycle_left * HOUR),
    )


def kinds(plan: HosPlan) -> list[tuple[StopKind, float, str]]:
    return [(s.kind, s.at_drive_s / HOUR, s.reason) for s in plan.stops]


class TestScenarios:
    def test_rested_driver_twelve_hours(self) -> None:
        plan = plan_hos(12 * HOUR, clocks())

        assert kinds(plan) == [(BREAK, 8, "break"), (REST, 11, "drive_limit")]
        assert plan.trip_duration_s == 12 * HOUR + 30 * 60 + 10 * HOUR

    def test_window_runs_out_first(self) -> None:
        plan = plan_hos(11 * HOUR, clocks(drive=11, window=3))

        assert kinds(plan) == [(REST, 3, "window")]

    def test_cycle_restart(self) -> None:
        plan = plan_hos(12 * HOUR, clocks(cycle_left=5))

        assert kinds(plan)[0] == (RESTART, 5, "cycle")
        assert plan.stops[0].duration_s == 34 * HOUR

    def test_coinciding_limits_produce_one_stop_the_longest(self) -> None:
        # Drive limit and break both fall at 8 h: the rest covers the break.
        plan = plan_hos(10 * HOUR, clocks(drive=8, until_break=8))

        assert kinds(plan) == [(REST, 8, "drive_limit")]

    def test_cycle_and_drive_limit_together_take_the_restart(self) -> None:
        plan = plan_hos(10 * HOUR, clocks(drive=6, cycle_left=6))

        assert kinds(plan) == [(RESTART, 6, "cycle")]

    def test_trip_ending_exactly_on_a_limit_adds_no_stop(self) -> None:
        assert plan_hos(8 * HOUR, clocks()).stops == ()
        assert kinds(plan_hos(11 * HOUR, clocks())) == [(BREAK, 8, "break")]

    def test_break_that_would_end_the_window_becomes_a_rest(self) -> None:
        # At 8 h only 20 min of the window is left; a 30 min break would leave
        # the driver needing a rest anyway, so the planner rests once.
        plan = plan_hos(10 * HOUR, clocks(window=8 + 20 / 60))

        assert kinds(plan) == [(REST, 8, "window")]

    def test_starting_with_no_drive_time_rests_first(self) -> None:
        plan = plan_hos(2 * HOUR, clocks(drive=0))

        assert kinds(plan) == [(REST, 0, "drive_limit")]

    def test_zero_drive_trip(self) -> None:
        assert plan_hos(0, clocks(drive=0)).stops == ()

    def test_long_trip_alternates_breaks_and_rests(self) -> None:
        # The trip ends at 30 h, exactly when the third break would fall: no stop.
        plan = plan_hos(30 * HOUR, clocks())

        assert kinds(plan) == [
            (BREAK, 8, "break"),
            (REST, 11, "drive_limit"),
            (BREAK, 19, "break"),
            (REST, 22, "drive_limit"),
        ]

    def test_sixty_hour_cycle(self) -> None:
        plan = plan_hos(4 * HOUR, clocks(cycle_left=2, cycle=Cycle.H60_7D))

        assert kinds(plan) == [(RESTART, 2, "cycle")]


class TestClockOffset:
    def test_adds_stops_strictly_before(self) -> None:
        plan = plan_hos(12 * HOUR, clocks())

        assert plan.clock_offset(8 * HOUR) == 8 * HOUR  # break starts on arrival
        assert plan.clock_offset(9 * HOUR) == 9 * HOUR + 30 * 60
        assert plan.clock_offset(12 * HOUR) == plan.trip_duration_s

    def test_counts(self) -> None:
        plan = plan_hos(12 * HOUR, clocks())

        assert plan.count(BREAK) == 1
        assert plan.count(REST) == 1
        assert plan.count(RESTART) == 0


class TestValidation:
    @pytest.mark.parametrize(
        ("drive", "window", "until_break", "cycle_left", "cycle"),
        [
            (11.5, 14, 8, 70, Cycle.H70_8D),
            (11, 14.5, 8, 70, Cycle.H70_8D),
            (11, 14, 8.5, 70, Cycle.H70_8D),
            (11, 14, 8, 71, Cycle.H70_8D),
            (11, 14, 8, 61, Cycle.H60_7D),
            (-1, 14, 8, 70, Cycle.H70_8D),
        ],
    )
    def test_clock_ranges(
        self, drive: float, window: float, until_break: float, cycle_left: float, cycle: Cycle
    ) -> None:
        with pytest.raises(ValueError, match="between"):
            clocks(drive, window, until_break, cycle_left, cycle)

    def test_negative_drive_time(self) -> None:
        with pytest.raises(ValueError, match="negative"):
            plan_hos(-1, clocks())

    def test_rested_defaults(self) -> None:
        assert HosClocks.rested() == clocks()
        assert HosClocks.rested(Cycle.H60_7D).cycle_left_s == 60 * HOUR


class TestPlaceStops:
    def test_mile_position_and_start(self) -> None:
        a, b = LatLon(35.0, -100.0), LatLon(35.0, -90.0)
        geometry = RouteGeometry.build((a, b), reported_distance_mi=720.0)
        profile = DriveProfile.build([], 720.0, 12 * HOUR)  # 60 mph
        departure = datetime(2026, 10, 12, 6, tzinfo=UTC)
        plan = plan_hos(12 * HOUR, clocks())

        placed = place_stops(plan, profile, geometry, departure)

        assert [round(p.mile) for p in placed] == [480, 660]
        assert placed[0].start == departure + timedelta(hours=8)
        assert placed[1].start == departure + timedelta(hours=11, minutes=30)
        assert placed[0].position == geometry.position_at(480.0)


def check_legal(plan: HosPlan, c: HosClocks) -> None:
    """Independent replay: no stretch of driving breaks any limit."""
    drive_used = R.max_drive_s - c.drive_left_s
    window_used = R.window_s - c.window_left_s
    since_break = R.drive_before_break_s - c.until_break_s
    cycle_used = c.cycle.value - c.cycle_left_s
    at = 0
    for stop in [*plan.stops, Stop(BREAK, plan.total_drive_s, 0, "break")]:
        stretch = stop.at_drive_s - at
        drive_used += stretch
        window_used += stretch
        since_break += stretch
        cycle_used += stretch
        if stretch > 0:
            assert drive_used <= R.max_drive_s
            assert window_used <= R.window_s
            assert since_break <= R.drive_before_break_s
            assert cycle_used <= c.cycle.value
        at = stop.at_drive_s
        if stop.kind is BREAK:
            since_break = 0
            window_used += stop.duration_s
        elif stop.kind is REST:
            drive_used = window_used = since_break = 0
        else:
            drive_used = window_used = since_break = cycle_used = 0


clock_strategy = st.builds(
    lambda cycle, d, w, b, cl: HosClocks(cycle, d * 60, w * 60, b * 60, min(cl * 60, cycle.value)),
    st.sampled_from(Cycle),
    st.integers(0, 11 * 60),
    st.integers(0, 14 * 60),
    st.integers(0, 8 * 60),
    st.integers(0, 70 * 60),
)


@given(st.integers(0, 120 * HOUR), clock_strategy)
def test_invariants(total: int, c: HosClocks) -> None:
    plan = plan_hos(total, c)

    check_legal(plan, c)
    # Stops are in order and never at the same point, so they can't overlap.
    assert all(a.at_drive_s < b.at_drive_s for a, b in pairwise(plan.stops))
    assert all(0 <= s.at_drive_s < total for s in plan.stops)
    # Clock time never runs backwards.
    samples = [total * i / 50 for i in range(51)]
    offsets = [plan.clock_offset(d) for d in samples]
    assert all(b >= a for a, b in pairwise(offsets))
    assert plan.clock_offset(total) == plan.trip_duration_s
