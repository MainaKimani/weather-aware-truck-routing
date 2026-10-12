"""Spherical geometry for routes and the corridor grid.

Distances are great-circle (haversine) on the mean Earth radius: within
about 0.5% of the WGS84 geodesic, which is well inside what route planning
needs. Planar work (segment distances, simplification, the corridor buffer)
uses a local equirectangular projection centred near the points involved,
accurate at the tens-of-miles scale it is used for. Routes are assumed not
to cross the antimeridian (the product is US-only).
"""

import math
from bisect import bisect_right
from collections.abc import Iterable, Sequence
from itertools import pairwise

from planner.domain.types import LatLon
from planner.domain.units import km_to_mi

EARTH_RADIUS_MI = km_to_mi(6371.0088)  # IUGG mean radius
MI_PER_DEG_LAT = EARTH_RADIUS_MI * math.pi / 180


def haversine_mi(a: LatLon, b: LatLon) -> float:
    """Great-circle distance between two points, in miles."""
    lat1, lat2 = math.radians(a.lat), math.radians(b.lat)
    dlat = lat2 - lat1
    dlon = math.radians(b.lon - a.lon)
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_MI * math.asin(min(1.0, math.sqrt(h)))


def cumulative_mi(line: Sequence[LatLon]) -> list[float]:
    """Distance from the start to each vertex; the first entry is 0."""
    out = [0.0] * len(line)
    for i in range(1, len(line)):
        out[i] = out[i - 1] + haversine_mi(line[i - 1], line[i])
    return out


def interpolate(a: LatLon, b: LatLon, t: float) -> LatLon:
    """The point a fraction `t` of the way from `a` to `b` along the great circle.

    The ends are returned exactly (no round trip through trigonometry), so a
    densified line still starts and ends on its original points.
    """
    if t <= 0:
        return a
    if t >= 1:
        return b
    lat1, lon1 = math.radians(a.lat), math.radians(a.lon)
    lat2, lon2 = math.radians(b.lat), math.radians(b.lon)
    delta = haversine_mi(a, b) / EARTH_RADIUS_MI  # angular distance
    if delta < 1e-12:
        return a
    sin_delta = math.sin(delta)
    wa = math.sin((1 - t) * delta) / sin_delta
    wb = math.sin(t * delta) / sin_delta
    x = wa * math.cos(lat1) * math.cos(lon1) + wb * math.cos(lat2) * math.cos(lon2)
    y = wa * math.cos(lat1) * math.sin(lon1) + wb * math.cos(lat2) * math.sin(lon2)
    z = wa * math.sin(lat1) + wb * math.sin(lat2)
    return LatLon(math.degrees(math.atan2(z, math.hypot(x, y))), math.degrees(math.atan2(y, x)))


def point_at_mi(line: Sequence[LatLon], cumulative: Sequence[float], d_mi: float) -> LatLon:
    """The point `d_mi` along `line`, clamped to its ends.

    `cumulative` is `cumulative_mi(line)`, passed in so callers sampling many
    distances compute it once. Interpolation follows the great circle, so the
    result is exactly `d_mi` along the line however long the segment.
    """
    if not line:
        raise ValueError("line is empty")
    if len(cumulative) != len(line):
        raise ValueError("cumulative does not match line")
    if d_mi <= 0 or len(line) == 1:
        return line[0]
    if d_mi >= cumulative[-1]:
        return line[-1]
    i = bisect_right(cumulative, d_mi)  # cumulative[i-1] <= d_mi < cumulative[i]
    a, b = line[i - 1], line[i]
    span = cumulative[i] - cumulative[i - 1]
    t = (d_mi - cumulative[i - 1]) / span if span > 0 else 0.0
    return interpolate(a, b, t)


def _xy(p: LatLon, origin: LatLon) -> tuple[float, float]:
    """`p` in miles east/north of `origin` (equirectangular, centred on origin)."""
    x = math.radians(p.lon - origin.lon) * EARTH_RADIUS_MI * math.cos(math.radians(origin.lat))
    y = math.radians(p.lat - origin.lat) * EARTH_RADIUS_MI
    return x, y


def distance_to_segment_mi(p: LatLon, a: LatLon, b: LatLon) -> float:
    """Shortest distance from `p` to the segment a-b, in miles."""
    ax, ay = _xy(a, p)
    bx, by = _xy(b, p)
    dx, dy = bx - ax, by - ay
    length_sq = dx * dx + dy * dy
    t = 0.0 if length_sq == 0 else max(0.0, min(1.0, -(ax * dx + ay * dy) / length_sq))
    return math.hypot(ax + t * dx, ay + t * dy)


def distance_to_line_mi(p: LatLon, line: Sequence[LatLon]) -> float:
    """Shortest distance from `p` to a polyline, in miles."""
    if not line:
        raise ValueError("line is empty")
    if len(line) == 1:
        return haversine_mi(p, line[0])
    return min(distance_to_segment_mi(p, a, b) for a, b in pairwise(line))


def simplify(line: Sequence[LatLon], tolerance_mi: float) -> list[LatLon]:
    """Douglas-Peucker simplification; keeps both ends.

    Iterative rather than recursive, so long routes (tens of thousands of
    vertices) can't hit the recursion limit.
    """
    n = len(line)
    if n < 3:
        return list(line)
    keep = [False] * n
    keep[0] = keep[-1] = True
    stack = [(0, n - 1)]
    while stack:
        start, end = stack.pop()
        farthest, max_d = -1, tolerance_mi
        for i in range(start + 1, end):
            d = distance_to_segment_mi(line[i], line[start], line[end])
            if d > max_d:
                farthest, max_d = i, d
        if farthest != -1:
            keep[farthest] = True
            stack.append((start, farthest))
            stack.append((farthest, end))
    return [p for p, k in zip(line, keep, strict=True) if k]


def snap(p: LatLon, step_deg: float) -> LatLon:
    """The nearest point on a fixed global lattice with spacing `step_deg`.

    A fixed lattice means nearby plans share points, so forecasts cached for
    one plan are reused by the next. Rounded to 6 dp so the same lattice
    point always has the same float value (and cache key).
    """
    if step_deg <= 0:
        raise ValueError("step_deg must be positive")
    return LatLon(
        round(round(p.lat / step_deg) * step_deg, 6),
        round(round(p.lon / step_deg) * step_deg, 6),
    )


def lattice_near(
    lines: Iterable[Sequence[LatLon]], radius_mi: float, step_deg: float
) -> list[LatLon]:
    """Lattice points within `radius_mi` of any of `lines` (the corridor buffer).

    Works segment by segment: only lattice points inside each segment's
    bounding box, grown by the radius, are tested. That keeps the work
    proportional to the corridor's area rather than the whole bounding box
    of a coast-to-coast trip. Results are unique and sorted.
    """
    if step_deg <= 0:
        raise ValueError("step_deg must be positive")
    if radius_mi < 0:
        raise ValueError("radius_mi must not be negative")
    lat_pad = radius_mi / MI_PER_DEG_LAT
    found: set[tuple[int, int]] = set()
    for line in lines:
        if not line:
            continue
        segments = list(pairwise(line)) or [(line[0], line[0])]
        for a, b in segments:
            lat_lo = min(a.lat, b.lat) - lat_pad
            lat_hi = max(a.lat, b.lat) + lat_pad
            # Longitude degrees shrink towards the poles: pad for the worst case.
            widest = max(abs(lat_lo), abs(lat_hi))
            lon_pad = radius_mi / (MI_PER_DEG_LAT * max(math.cos(math.radians(widest)), 1e-6))
            lon_lo = min(a.lon, b.lon) - lon_pad
            lon_hi = max(a.lon, b.lon) + lon_pad
            for i in range(math.ceil(lat_lo / step_deg), math.floor(lat_hi / step_deg) + 1):
                for j in range(math.ceil(lon_lo / step_deg), math.floor(lon_hi / step_deg) + 1):
                    if (i, j) in found:
                        continue
                    q = LatLon(i * step_deg, j * step_deg)
                    if distance_to_segment_mi(q, a, b) <= radius_mi:
                        found.add((i, j))
    return [LatLon(round(i * step_deg, 6), round(j * step_deg, 6)) for i, j in sorted(found)]


def offset_from_midpoint(a: LatLon, b: LatLon, fraction: float) -> LatLon:
    """A point beside the midpoint of a-b, `fraction` of the a-b distance away.

    Positive is to the left when travelling from a to b, negative to the
    right. Used for via points that push a router onto a different corridor.
    """
    mid = interpolate(a, b, 0.5)
    ax, ay = _xy(a, mid)
    bx, by = _xy(b, mid)
    dx, dy = bx - ax, by - ay
    norm = math.hypot(dx, dy)
    if norm == 0:
        return mid
    d = fraction * haversine_mi(a, b)
    east, north = -dy / norm * d, dx / norm * d
    return LatLon(
        mid.lat + north / MI_PER_DEG_LAT,
        mid.lon + east / (MI_PER_DEG_LAT * math.cos(math.radians(mid.lat))),
    )
