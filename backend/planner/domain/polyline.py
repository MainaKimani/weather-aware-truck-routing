"""Polyline formats.

- Encoded polyline (Google's algorithm, precision 5): what our API returns
  for route geometry, and what the frontend decodes.
- HERE flexible polyline: what HERE Routing returns. Decoded with HERE's
  own `flexpolyline` package rather than a reimplementation.
"""

import math
from collections.abc import Iterable

import flexpolyline

from planner.domain.types import LatLon


def _encode_value(value: int) -> str:
    value = ~(value << 1) if value < 0 else value << 1
    chunks = []
    while value >= 0x20:
        chunks.append(chr((0x20 | (value & 0x1F)) + 63))
        value >>= 5
    chunks.append(chr(value + 63))
    return "".join(chunks)


def _scaled(value: float, factor: int) -> int:
    # Round half up, as the reference (JavaScript Math.round) does; Python's
    # round() would round half to even.
    return math.floor(value * factor + 0.5)


def encode(points: Iterable[LatLon], precision: int = 5) -> str:
    """Encode points as a polyline string.

    Each absolute coordinate is rounded before taking deltas, so rounding
    errors don't accumulate along a long route.
    """
    factor = 10**precision
    out = []
    prev_lat = prev_lon = 0
    for p in points:
        lat, lon = _scaled(p.lat, factor), _scaled(p.lon, factor)
        out.append(_encode_value(lat - prev_lat))
        out.append(_encode_value(lon - prev_lon))
        prev_lat, prev_lon = lat, lon
    return "".join(out)


def decode(encoded: str, precision: int = 5) -> list[LatLon]:
    """Decode a polyline string. Raises ValueError on malformed input."""
    factor = 10**precision
    points = []
    index = lat = lon = 0
    n = len(encoded)
    while index < n:
        deltas = []
        for _ in range(2):
            result = shift = 0
            while True:
                if index >= n:
                    raise ValueError("truncated polyline")
                byte = ord(encoded[index]) - 63
                index += 1
                if not 0 <= byte < 64:
                    raise ValueError(f"invalid polyline character at {index - 1}")
                result |= (byte & 0x1F) << shift
                shift += 5
                if byte < 0x20:
                    break
            deltas.append(~(result >> 1) if result & 1 else result >> 1)
        lat += deltas[0]
        lon += deltas[1]
        points.append(LatLon(lat / factor, lon / factor))
    return points


def decode_flexible(encoded: str) -> list[LatLon]:
    """Decode a HERE flexible polyline, dropping any third dimension.

    Raises ValueError on malformed input.
    """
    try:
        raw = flexpolyline.decode(encoded)
    # A missing header surfaces as RuntimeError (StopIteration escaping a
    # generator); bad characters and versions as ValueError.
    except (ValueError, IndexError, KeyError, RuntimeError) as exc:
        raise ValueError(f"invalid flexible polyline: {exc}") from exc
    return [LatLon(float(p[0]), float(p[1])) for p in raw]
