import pytest
from hypothesis import given
from hypothesis import strategies as st

from planner.domain.metrics import BUCKETS, RatedCheckpoint, bucket, route_metrics
from planner.domain.risk import Level
from planner.domain.sampling import owned_miles

L, M, H, S, NT = Level.LOW, Level.MODERATE, Level.HIGH, Level.SEVERE, Level.NO_TRAVEL


def route(levels: list[Level | None], interval: float = 25.0) -> list[RatedCheckpoint]:
    miles = [i * interval for i in range(len(levels))]
    return [
        RatedCheckpoint(mile, own, level)
        for mile, own, level in zip(miles, owned_miles(miles), levels, strict=True)
    ]


class TestRouteMetrics:
    def test_miles_by_level_and_average(self) -> None:
        # Owned: 12.5, 25, 25, 12.5 over 75 mi.
        m = route_metrics(route([L, M, H, L]))

        assert m.miles_by_level == {
            "LOW": 25.0, "MODERATE": 25.0, "HIGH": 25.0,
            "SEVERE": 0.0, "NO_TRAVEL": 0.0, "UNKNOWN": 0.0,
        }  # fmt: skip
        assert m.avg_risk == pytest.approx((0 * 25 + 1 * 25 + 2 * 25) / 75)
        assert m.distance_mi == 75.0
        assert m.drivable

    def test_worst_level_and_where_it_first_occurs(self) -> None:
        m = route_metrics(route([L, S, M, S]))

        assert m.worst == S
        assert m.worst_at_mile == 25.0

    def test_unknown_is_counted_but_excluded_from_average(self) -> None:
        m = route_metrics(route([H, None, None, H]))

        assert m.unknown_miles == 50.0
        assert m.avg_risk == 2.0
        assert m.unknown_share == pytest.approx(50 / 75)

    def test_all_unknown_is_not_reported_as_safe(self) -> None:
        m = route_metrics(route([None, None, None]))

        assert m.avg_risk is None
        assert m.worst is None
        assert m.worst_at_mile is None
        assert m.miles("LOW") == 0.0
        assert m.unknown_miles == m.distance_mi

    def test_one_no_travel_checkpoint_makes_route_not_drivable(self) -> None:
        m = route_metrics(route([L, L, NT, L, L]))

        assert not m.drivable
        assert m.miles("NO_TRAVEL") == 25.0

    def test_needs_checkpoints(self) -> None:
        with pytest.raises(ValueError, match="checkpoints"):
            route_metrics([])

    def test_bucket_names(self) -> None:
        assert [bucket(level) for level in Level] == list(BUCKETS[:-1])
        assert bucket(None) == "UNKNOWN"


@given(st.lists(st.sampled_from([*Level, None]), min_size=2, max_size=60))
def test_miles_by_level_sum_to_route_distance(levels: list[Level | None]) -> None:
    cps = route(levels)

    m = route_metrics(cps)

    assert sum(m.miles_by_level.values()) == pytest.approx(cps[-1].mile)
    if m.avg_risk is not None:
        assert 0.0 <= m.avg_risk <= 4.0
    assert m.drivable == (NT not in levels)
