"""Plain value types shared across the domain package."""

from typing import NamedTuple


class LatLon(NamedTuple):
    """A WGS84 position in decimal degrees."""

    lat: float
    lon: float
