"""What the planner needs from outside services, as protocols.

Adapters for real services (HERE, Open-Meteo) and the deterministic fakes
used for tests and demo mode both implement these, so the rest of the code
never knows which one it has.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from planner.domain.forecast import ForecastSeries
from planner.domain.types import LatLon, Route


@dataclass(frozen=True)
class RouteRequest:
    origin: LatLon
    destination: LatLon
    departure: datetime  # timezone-aware
    load_lb: int
    via: tuple[LatLon, ...] = ()


@dataclass(frozen=True)
class Place:
    label: str
    position: LatLon
    tz: str | None  # IANA zone, e.g. "America/Chicago"


class RoutingProvider(Protocol):
    def routes(self, request: RouteRequest, alternatives: int) -> list[Route]:
        """Up to `1 + alternatives` routes, fastest first. Raises ProviderError."""
        ...


class WeatherProvider(Protocol):
    def hourly(
        self, points: Sequence[LatLon], start: datetime, hours: int
    ) -> list[ForecastSeries | None]:
        """One series per point (same order), covering `hours` hours from `start`.

        A point the provider has no data for is None. Raises ProviderError.
        """
        ...


class Geocoder(Protocol):
    def suggest(self, query: str, limit: int = 5) -> list[Place]:
        """Places matching a partial query, best first. Raises ProviderError."""
        ...


class ProviderError(Exception):
    """An outside service failed or returned something unusable."""


class RoutingUnavailable(ProviderError):
    code = "routing_unavailable"


class WeatherUnavailable(ProviderError):
    code = "weather_unavailable"


class GeocodingUnavailable(ProviderError):
    code = "geocoding_unavailable"


class NoRoute(ProviderError):
    """The provider answered, but there's no truck route between the points."""

    code = "no_route"
