"""How much two routes overlap, for dropping near-duplicate alternatives (RFC §5.1).

Overlap is the share of route A that runs along route B: sample A every
`step_mi` and count samples within `tolerance_mi` of B. It isn't symmetric.
A long detour that contains the whole of a short route overlaps it only
partly, and that's right, because the detour is a real alternative.
"""

import math
from collections import defaultdict
from collections.abc import Sequence
from itertools import pairwise
from typing import Final

from planner.domain.geo import (
    MI_PER_DEG_LAT,
    cumulative_mi,
    distance_to_segment_mi,
    point_at_mi,
)
from planner.domain.types import LatLon

DUPLICATE_OVERLAP: Final = 0.85
_STEP_MI: Final = 2.0
_TOLERANCE_MI: Final = 0.3
_CELL_DEG: Final = 0.1  # spatial index cell, about 7 mi


class _SegmentIndex:
    """B's segments bucketed by grid cell, so each sample checks only nearby ones."""

    def __init__(self, line: Sequence[LatLon], pad_mi: float) -> None:
        self.cells: dict[tuple[int, int], list[tuple[LatLon, LatLon]]] = defaultdict(list)
        pad_lat = pad_mi / MI_PER_DEG_LAT
        for a, b in pairwise(line):
            pad_lon = pad_mi / (MI_PER_DEG_LAT * max(math.cos(math.radians(a.lat)), 0.1))
            i0 = math.floor((min(a.lat, b.lat) - pad_lat) / _CELL_DEG)
            i1 = math.floor((max(a.lat, b.lat) + pad_lat) / _CELL_DEG)
            j0 = math.floor((min(a.lon, b.lon) - pad_lon) / _CELL_DEG)
            j1 = math.floor((max(a.lon, b.lon) + pad_lon) / _CELL_DEG)
            for i in range(i0, i1 + 1):
                for j in range(j0, j1 + 1):
                    self.cells[(i, j)].append((a, b))

    def near(self, p: LatLon, tolerance_mi: float) -> bool:
        key = (math.floor(p.lat / _CELL_DEG), math.floor(p.lon / _CELL_DEG))
        return any(
            distance_to_segment_mi(p, a, b) <= tolerance_mi for a, b in self.cells.get(key, ())
        )


def overlap(
    a: Sequence[LatLon],
    b: Sequence[LatLon],
    step_mi: float = _STEP_MI,
    tolerance_mi: float = _TOLERANCE_MI,
) -> float:
    """Share (0-1) of route `a` that lies within `tolerance_mi` of route `b`."""
    if len(a) < 2 or len(b) < 2:
        raise ValueError("routes need at least two points")
    cum = cumulative_mi(a)
    n = max(1, math.ceil(cum[-1] / step_mi))
    samples = [point_at_mi(a, cum, cum[-1] * k / n) for k in range(n + 1)]
    index = _SegmentIndex(b, tolerance_mi)
    return sum(1 for p in samples if index.near(p, tolerance_mi)) / len(samples)


def is_duplicate(a: Sequence[LatLon], b: Sequence[LatLon]) -> bool:
    return overlap(a, b) > DUPLICATE_OVERLAP
