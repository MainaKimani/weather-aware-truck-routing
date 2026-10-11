import itertools

import pytest
from hypothesis import given
from hypothesis import strategies as st

from planner.domain.geo import haversine_mi
from planner.domain.sampling import (
    ALLOWED_INTERVALS_MI,
    RouteGeometry,
    checkpoint_miles,
    owned_miles,
    sample_checkpoints,
)
from planner.domain.types import LatLon

DALLAS = LatLon(32.7767, -96.7970)
AMARILLO = LatLon(35.2220, -101.8313)
DENVER = LatLon(39.7392, -104.9903)

us_points = st.builds(
    LatLon,
    st.floats(min_value=24.0, max_value=49.0),
    st.floats(min_value=-125.0, max_value=-66.0),
)
routes = st.lists(us_points, min_size=2, max_size=25).filter(
    lambda line: sum(haversine_mi(a, b) for a, b in itertools.pairwise(line)) > 1
)


class TestCheckpointMiles:
    def test_every_interval_then_destination(self) -> None:
        assert checkpoint_miles(60.0, 25) == [0.0, 25.0, 50.0, 60.0]

    def test_exact_multiple_does_not_duplicate_destination(self) -> None:
        assert checkpoint_miles(50.0, 25) == [0.0, 25.0, 50.0]
        assert checkpoint_miles(50.0 + 1e-9, 25) == [0.0, 25.0, 50.0 + 1e-9]

    def test_route_shorter_than_interval_has_origin_and_destination(self) -> None:
        assert checkpoint_miles(7.5, 10) == [0.0, 7.5]

    @pytest.mark.parametrize("interval", ALLOWED_INTERVALS_MI)
    def test_allowed_intervals(self, interval: int) -> None:
        miles = checkpoint_miles(795.0, interval)

        assert miles[0] == 0.0
        assert miles[-1] == 795.0
        assert all(b - a <= interval for a, b in itertools.pairwise(miles))

    @pytest.mark.parametrize("interval", [0, 5, 20, 30, 100, -25])
    def test_other_intervals_rejected(self, interval: int) -> None:
        with pytest.raises(ValueError, match="interval"):
            checkpoint_miles(100.0, interval)

    def test_zero_length_rejected(self) -> None:
        with pytest.raises(ValueError, match="zero length"):
            checkpoint_miles(0.0, 25)


class TestOwnedMiles:
    def test_half_gaps(self) -> None:
        assert owned_miles([0.0, 25.0, 50.0, 60.0]) == [12.5, 25.0, 17.5, 5.0]

    def test_two_checkpoints_split_the_route(self) -> None:
        assert owned_miles([0.0, 7.5]) == [3.75, 3.75]

    def test_needs_two_checkpoints(self) -> None:
        with pytest.raises(ValueError, match="two"):
            owned_miles([0.0])


class TestRouteGeometry:
    def test_scales_to_reported_distance(self) -> None:
        line = (DALLAS, AMARILLO, DENVER)
        geometric = haversine_mi(DALLAS, AMARILLO) + haversine_mi(AMARILLO, DENVER)

        g = RouteGeometry.build(line, reported_distance_mi=geometric * 1.05)

        assert g.length_mi == pytest.approx(geometric * 1.05)
        assert g.position_at(0) == DALLAS
        assert g.position_at(g.length_mi) == DENVER

    def test_without_reported_distance_uses_geometry(self) -> None:
        g = RouteGeometry.build((DALLAS, DENVER))

        assert g.scale == 1.0
        assert g.length_mi == pytest.approx(haversine_mi(DALLAS, DENVER))

    @pytest.mark.parametrize(
        ("line", "reported", "message"),
        [
            ((DALLAS,), None, "two points"),
            ((DALLAS, DALLAS), None, "zero length"),
            ((DALLAS, DENVER), 0.0, "positive"),
        ],
    )
    def test_rejects_bad_input(
        self, line: tuple[LatLon, ...], reported: float | None, message: str
    ) -> None:
        with pytest.raises(ValueError, match=message):
            RouteGeometry.build(line, reported)


class TestSampleCheckpoints:
    def test_dallas_to_denver(self) -> None:
        g = RouteGeometry.build((DALLAS, AMARILLO, DENVER), reported_distance_mi=795.0)

        points = sample_checkpoints(g, 25)

        assert [p.mile for p in points][:3] == [0.0, 25.0, 50.0]
        assert points[-1].mile == 795.0
        assert len(points) == 33  # 0..775 every 25 (32) + destination
        assert points[0].position == DALLAS
        assert points[-1].position == DENVER
        assert [p.index for p in points] == list(range(33))

    def test_short_route_gives_exactly_two_checkpoints(self) -> None:
        a, b = LatLon(35.0, -100.0), LatLon(35.0, -99.9)  # about 5.7 mi

        points = sample_checkpoints(RouteGeometry.build((a, b)), 10)

        assert len(points) == 2
        assert points[0].position == a
        assert points[1].position == b

    @given(
        routes,
        st.sampled_from(ALLOWED_INTERVALS_MI),
        st.floats(min_value=0.9, max_value=1.1),
    )
    def test_owned_miles_sum_to_reported_distance(
        self, line: list[LatLon], interval: int, ratio: float
    ) -> None:
        geometric = RouteGeometry.build(tuple(line)).length_mi
        g = RouteGeometry.build(tuple(line), reported_distance_mi=geometric * ratio)

        points = sample_checkpoints(g, interval)

        assert sum(p.owned_mi for p in points) == pytest.approx(g.length_mi, abs=0.01)
        assert all(p.owned_mi > 0 for p in points)
        assert all(b.mile > a.mile for a, b in itertools.pairwise(points))
        assert points[-1].mile == pytest.approx(g.length_mi)
