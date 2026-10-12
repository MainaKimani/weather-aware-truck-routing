import itertools
import time

import pytest

from planner.domain.alternatives import is_duplicate, overlap
from planner.domain.geo import interpolate
from planner.domain.types import LatLon

A, B = LatLon(35.0, -100.0), LatLon(35.0, -96.0)  # ~226 mi east-west


def line(*points: LatLon, steps: int = 200) -> list[LatLon]:
    out: list[LatLon] = []
    for a, b in itertools.pairwise(points):
        out += [interpolate(a, b, i / steps) for i in range(steps)]
    return [*out, points[-1]]


class TestOverlap:
    def test_identical_routes_overlap_fully(self) -> None:
        r = line(A, B)

        assert overlap(r, r) == 1.0
        assert is_duplicate(r, r)

    def test_different_vertices_same_road_still_overlap(self) -> None:
        assert overlap(line(A, B, steps=50), line(A, B, steps=333)) == 1.0

    def test_parallel_road_ten_miles_away_does_not_overlap(self) -> None:
        north = line(LatLon(35.145, -100.0), LatLon(35.145, -96.0))

        assert overlap(line(A, B), north) == 0.0

    def test_shared_stretch_is_partial(self) -> None:
        # Same first half (the A-B road's own points), then a detour north.
        direct = line(A, B)
        detour = [
            *direct[: len(direct) // 2],
            *line(direct[len(direct) // 2], LatLon(36.0, -97.0), B),
        ]

        share = overlap(detour, direct)

        assert 0.3 < share < 0.6
        assert not is_duplicate(detour, direct)

    def test_not_symmetric(self) -> None:
        long = line(A, B)
        short = long[: len(long) // 4]

        assert overlap(short, long) == 1.0
        assert overlap(long, short) < 0.35

    def test_needs_two_points(self) -> None:
        with pytest.raises(ValueError, match="two points"):
            overlap([A], [A, B])

    def test_fast_on_real_sized_routes(self) -> None:
        coast = line(
            LatLon(34.05, -118.24), LatLon(36.0, -100.0), LatLon(40.71, -74.0), steps=5_000
        )

        started = time.perf_counter()
        overlap(coast, coast)

        assert time.perf_counter() - started < 2.0
