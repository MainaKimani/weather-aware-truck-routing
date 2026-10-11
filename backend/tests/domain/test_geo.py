import math
from itertools import pairwise

import pytest
from hypothesis import given
from hypothesis import strategies as st

from planner.domain.geo import (
    MI_PER_DEG_LAT,
    cumulative_mi,
    distance_to_line_mi,
    distance_to_segment_mi,
    haversine_mi,
    interpolate,
    lattice_near,
    point_at_mi,
    simplify,
    snap,
)
from planner.domain.types import LatLon

DALLAS = LatLon(32.7767, -96.7970)
DENVER = LatLon(39.7392, -104.9903)
CHICAGO = LatLon(41.8781, -87.6298)
MEMPHIS = LatLon(35.1495, -90.0490)
LOS_ANGELES = LatLon(34.0522, -118.2437)
NEW_YORK = LatLon(40.7128, -74.0060)
AMARILLO = LatLon(35.2220, -101.8313)
OKLAHOMA_CITY = LatLon(35.4676, -97.5164)
SEATTLE = LatLon(47.6062, -122.3321)
MIAMI = LatLon(25.7617, -80.1918)

# Reference: WGS84 geodesic distances from geographiclib (Geodesic.WGS84.Inverse).
CITY_PAIRS = [
    (DALLAS, DENVER, 662.57),
    (CHICAGO, MEMPHIS, 482.22),
    (LOS_ANGELES, NEW_YORK, 2450.95),
    (AMARILLO, OKLAHOMA_CITY, 244.29),
    (SEATTLE, MIAMI, 2734.33),
    (DALLAS, AMARILLO, 334.48),
]

us_points = st.builds(
    LatLon,
    st.floats(min_value=24.0, max_value=49.0),
    st.floats(min_value=-125.0, max_value=-66.0),
)


class TestHaversine:
    @pytest.mark.parametrize(("a", "b", "reference_mi"), CITY_PAIRS)
    def test_within_half_a_percent_of_geodesic(
        self, a: LatLon, b: LatLon, reference_mi: float
    ) -> None:
        assert haversine_mi(a, b) == pytest.approx(reference_mi, rel=0.005)

    def test_zero_for_same_point(self) -> None:
        assert haversine_mi(DALLAS, DALLAS) == 0.0

    @given(us_points, us_points)
    def test_symmetric(self, a: LatLon, b: LatLon) -> None:
        assert haversine_mi(a, b) == pytest.approx(haversine_mi(b, a))


class TestCumulative:
    def test_starts_at_zero_and_adds_legs(self) -> None:
        line = [DALLAS, AMARILLO, DENVER]

        cum = cumulative_mi(line)

        assert cum[0] == 0.0
        assert cum[1] == pytest.approx(haversine_mi(DALLAS, AMARILLO))
        assert cum[2] == pytest.approx(cum[1] + haversine_mi(AMARILLO, DENVER))

    def test_empty_line(self) -> None:
        assert cumulative_mi([]) == []

    @given(st.lists(us_points, min_size=1, max_size=30))
    def test_never_decreases(self, line: list[LatLon]) -> None:
        cum = cumulative_mi(line)
        assert all(b >= a for a, b in pairwise(cum))


class TestPointAt:
    LINE = (DALLAS, AMARILLO, DENVER)

    def test_ends_and_clamping(self) -> None:
        cum = cumulative_mi(self.LINE)

        assert point_at_mi(self.LINE, cum, 0) == DALLAS
        assert point_at_mi(self.LINE, cum, -5) == DALLAS
        assert point_at_mi(self.LINE, cum, cum[-1]) == DENVER
        assert point_at_mi(self.LINE, cum, cum[-1] + 100) == DENVER

    def test_vertex_is_returned_exactly(self) -> None:
        cum = cumulative_mi(self.LINE)

        assert point_at_mi(self.LINE, cum, cum[1]) == pytest.approx(AMARILLO)

    def test_distance_along_matches_request(self) -> None:
        cum = cumulative_mi(self.LINE)

        p = point_at_mi(self.LINE, cum, 100.0)

        assert haversine_mi(DALLAS, p) == pytest.approx(100.0, rel=1e-9)
        assert haversine_mi(p, AMARILLO) == pytest.approx(cum[1] - 100.0, rel=1e-9)

    def test_single_point_line(self) -> None:
        assert point_at_mi([DALLAS], [0.0], 10.0) == DALLAS

    def test_rejects_empty_or_mismatched_input(self) -> None:
        with pytest.raises(ValueError, match="empty"):
            point_at_mi([], [], 1.0)
        with pytest.raises(ValueError, match="match"):
            point_at_mi(self.LINE, [0.0], 1.0)

    @given(st.lists(us_points, min_size=2, max_size=20), st.floats(0, 1))
    def test_lies_on_the_line_at_the_requested_distance(
        self, line: list[LatLon], fraction: float
    ) -> None:
        cum = cumulative_mi(line)
        d = fraction * cum[-1]

        p = point_at_mi(line, cum, d)

        # The point splits its segment exactly: distance in from the segment's
        # start plus distance on to its end equals the segment's length.
        i = max(1, min(len(line) - 1, next((k for k, c in enumerate(cum) if c > d), len(cum) - 1)))
        a, b = line[i - 1], line[i]
        assert haversine_mi(a, p) + haversine_mi(p, b) == pytest.approx(
            haversine_mi(a, b), rel=1e-6, abs=1e-6
        )
        # And a straight line is never longer than the path.
        assert haversine_mi(line[0], p) <= d + 1e-6


class TestInterpolate:
    def test_ends_and_midpoint(self) -> None:
        mid = interpolate(DALLAS, DENVER, 0.5)

        assert interpolate(DALLAS, DENVER, 0.0) == pytest.approx(DALLAS)
        assert interpolate(DALLAS, DENVER, 1.0) == pytest.approx(DENVER)
        assert haversine_mi(DALLAS, mid) == pytest.approx(haversine_mi(mid, DENVER), rel=1e-9)

    def test_same_point(self) -> None:
        assert interpolate(DALLAS, DALLAS, 0.3) == DALLAS


class TestDistanceToLine:
    EAST_WEST = (LatLon(35.0, -100.0), LatLon(35.0, -98.0))

    def test_point_on_line_is_zero(self) -> None:
        assert distance_to_line_mi(LatLon(35.0, -99.0), self.EAST_WEST) == pytest.approx(
            0.0, abs=1e-9
        )

    def test_perpendicular_distance(self) -> None:
        north = LatLon(35.0 + 40 / MI_PER_DEG_LAT, -99.0)

        assert distance_to_line_mi(north, self.EAST_WEST) == pytest.approx(40.0, rel=1e-3)

    def test_beyond_an_end_measures_to_the_end(self) -> None:
        beyond = LatLon(35.0, -97.0)

        assert distance_to_segment_mi(beyond, *self.EAST_WEST) == pytest.approx(
            haversine_mi(beyond, self.EAST_WEST[1]), rel=1e-3
        )

    def test_single_point_line_and_empty_line(self) -> None:
        assert distance_to_line_mi(DALLAS, [DALLAS]) == 0.0
        with pytest.raises(ValueError, match="empty"):
            distance_to_line_mi(DALLAS, [])


class TestSimplify:
    def test_drops_collinear_points_and_keeps_ends(self) -> None:
        line = [LatLon(35.0, -100.0 + i * 0.1) for i in range(21)]

        assert simplify(line, tolerance_mi=0.6) == [line[0], line[-1]]

    def test_keeps_a_bend_bigger_than_tolerance(self) -> None:
        bend = LatLon(35.5, -99.0)
        line = [LatLon(35.0, -100.0), bend, LatLon(35.0, -98.0)]

        assert simplify(line, tolerance_mi=0.6) == line

    def test_short_lines_unchanged(self) -> None:
        assert simplify([], 1.0) == []
        assert simplify([DALLAS, DENVER], 1.0) == [DALLAS, DENVER]

    def test_deep_splits_do_not_hit_the_recursion_limit(self) -> None:
        # Bends that grow towards the end make every split land next to the
        # end, so a recursive version would go ~1,500 calls deep (limit 1,000).
        n = 1_500
        line = [
            LatLon(35.0 + (i / n) ** 4 * (0.5 if i % 2 else 0.0), -100.0 + i * 0.01)
            for i in range(n)
        ]

        simplified = simplify(line, tolerance_mi=0.001)

        assert simplified[0] == line[0]
        assert simplified[-1] == line[-1]

    @given(st.lists(us_points, min_size=3, max_size=40), st.floats(0.1, 50))
    def test_every_dropped_point_is_within_tolerance(
        self, line: list[LatLon], tolerance: float
    ) -> None:
        simplified = simplify(line, tolerance)

        assert simplified[0] == line[0]
        assert simplified[-1] == line[-1]
        # Douglas-Peucker guarantees each original point is within tolerance of
        # the segment that replaced it, so it's within tolerance of the result.
        for p in line:
            assert distance_to_line_mi(p, simplified) <= tolerance + 1e-6


class TestSnap:
    def test_rounds_to_nearest_lattice_point(self) -> None:
        assert snap(DALLAS, 0.1) == LatLon(32.8, -96.8)
        assert snap(DALLAS, 0.25) == LatLon(32.75, -96.75)

    def test_values_are_canonical_floats(self) -> None:
        # 0.1 * 7 is 0.7000000000000001 in binary floating point; keys must not
        # differ because of that.
        assert snap(LatLon(0.71, 0.69), 0.1) == LatLon(0.7, 0.7)

    def test_rejects_non_positive_step(self) -> None:
        with pytest.raises(ValueError, match="positive"):
            snap(DALLAS, 0)

    @given(us_points, st.sampled_from([0.1, 0.25, 0.5]))
    def test_idempotent_and_close(self, p: LatLon, step: float) -> None:
        s = snap(p, step)

        assert snap(s, step) == s
        assert abs(s.lat - p.lat) <= step / 2 + 1e-9
        assert abs(s.lon - p.lon) <= step / 2 + 1e-9


class TestLatticeNear:
    LINE = (DALLAS, AMARILLO, DENVER)

    def test_every_point_is_inside_the_buffer_and_on_the_lattice(self) -> None:
        points = lattice_near([self.LINE], radius_mi=40, step_deg=0.25)

        assert points
        for p in points:
            assert distance_to_line_mi(p, self.LINE) <= 40 + 1e-6
            assert snap(p, 0.25) == p

    def test_finds_every_lattice_point_inside_the_buffer(self) -> None:
        points = set(lattice_near([self.LINE], radius_mi=40, step_deg=0.25))

        # Brute force over the bounding box as the reference.
        expected = set()
        for i in range(int(31 / 0.25), int(42 / 0.25) + 1):
            for j in range(int(-107 / 0.25), int(-95 / 0.25) + 1):
                q = LatLon(round(i * 0.25, 6), round(j * 0.25, 6))
                if distance_to_line_mi(q, self.LINE) <= 40:
                    expected.add(q)
        assert points == expected

    def test_unique_and_sorted_across_overlapping_routes(self) -> None:
        other = (DALLAS, OKLAHOMA_CITY, DENVER)

        points = lattice_near([self.LINE, other], radius_mi=40, step_deg=0.25)

        assert len(points) == len(set(points))
        assert points == sorted(points)

    def test_area_scales_with_corridor_not_bounding_box(self) -> None:
        coast_to_coast = (LOS_ANGELES, DALLAS, NEW_YORK)

        points = lattice_near([coast_to_coast], radius_mi=40, step_deg=0.25)

        length = cumulative_mi(coast_to_coast)[-1]
        cell_area = (0.25 * MI_PER_DEG_LAT) * (0.25 * MI_PER_DEG_LAT * math.cos(math.radians(36)))
        corridor_cells = (2 * 40 * length) / cell_area
        assert len(points) == pytest.approx(corridor_cells, rel=0.25)

    def test_empty_inputs_and_invalid_arguments(self) -> None:
        assert lattice_near([], 40, 0.25) == []
        assert lattice_near([[]], 40, 0.25) == []
        assert lattice_near([[DALLAS]], 0, 0.25) == []  # (32.7767, -96.797) isn't on the lattice
        with pytest.raises(ValueError, match="positive"):
            lattice_near([self.LINE], 40, 0)
        with pytest.raises(ValueError, match="negative"):
            lattice_near([self.LINE], -1, 0.25)
