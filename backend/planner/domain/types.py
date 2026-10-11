"""Plain value types shared across the domain package."""

from dataclasses import dataclass
from datetime import datetime
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


@dataclass(frozen=True)
class Forecast:
    """One hour of weather at one point, in US units.

    `None` means the provider had no usable value. Thresholds use gusts;
    sustained wind is carried for display only (PRD §7.4).
    """

    valid_hour: datetime
    gust_mph: float | None
    rain_in_hr: float | None  # rain + showers over the hour
    snow_in_hr: float | None  # snowfall depth over the hour
    wind_mph: float | None = None
    weather_code: int | None = None


@dataclass(frozen=True)
class Route:
    """One routing option as the provider returned it."""

    geometry: tuple[LatLon, ...]
    distance_mi: float  # the provider's reported distance
    duration_s: float  # the provider's driving time (traffic-aware when available)
    spans: tuple[Span, ...] = ()
    label: str | None = None  # e.g. "via Amarillo" or the main roads
