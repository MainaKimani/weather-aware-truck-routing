"""Plain value types shared across the domain package."""

from dataclasses import dataclass
from typing import NamedTuple


class LatLon(NamedTuple):
    """A WGS84 position in decimal degrees."""

    lat: float
    lon: float


@dataclass(frozen=True)
class Span:
    """A consecutive stretch of a route with the provider's length and driving time."""

    length_mi: float
    duration_s: float
