"""Deterministic providers for tests, local development and demo mode.

No network and no keys. Dallas to Denver gets three scripted routes (via
Amarillo, Wichita and Lubbock, like the UI prototype); any other pair gets a
direct route and two bowed alternatives. Weather is a set of storm cells
that drift over time, so the heatmap moves as the slider plays.

Scenarios:
- "demo": a severe cell over Wichita (Route B) and one over Lubbock (Route C);
  Route A runs between them and is recommended for "Fewest severe miles".
- "strong": the Wichita cell's gusts reach No Travel, so Route B isn't
  drivable.
"""

import math
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from itertools import pairwise
from typing import Final, Literal

from planner.domain.forecast import ForecastSeries
from planner.domain.geo import EARTH_RADIUS_MI, haversine_mi, interpolate, offset_from_midpoint
from planner.domain.types import Forecast, LatLon, Route, Span
from planner.providers.base import NoRoute, Place, RouteRequest

Scenario = Literal["demo", "strong"]

# --- Routing ---------------------------------------------------------------

DALLAS: Final = LatLon(32.7767, -96.7970)
DENVER: Final = LatLon(39.7392, -104.9903)

# Waypoints along each scripted route, with the average speed (mph) of the
# leg that ends at each waypoint.
_SCRIPTED: Final[dict[str, tuple[tuple[LatLon, float], ...]]] = {
    "via Amarillo": (
        (DALLAS, 0),
        (LatLon(33.9137, -98.4934), 64),  # Wichita Falls
        (LatLon(35.2220, -101.8313), 66),  # Amarillo
        (LatLon(36.9034, -104.4392), 62),  # Raton
        (LatLon(38.2544, -104.6091), 66),  # Pueblo
        (LatLon(38.8339, -104.8214), 62),  # Colorado Springs
        (DENVER, 55),
    ),
    "via Wichita": (
        (DALLAS, 0),
        (LatLon(35.4676, -97.5164), 66),  # Oklahoma City
        (LatLon(37.6872, -97.3301), 70),  # Wichita
        (LatLon(38.8403, -97.6114), 70),  # Salina
        (LatLon(38.8792, -99.3268), 72),  # Hays
        (LatLon(39.2639, -103.6922), 72),  # Limon
        (DENVER, 62),
    ),
    "via Lubbock": (
        (DALLAS, 0),
        (LatLon(32.4487, -99.7331), 66),  # Abilene
        (LatLon(33.5779, -101.8552), 64),  # Lubbock
        (LatLon(34.4048, -103.2052), 62),  # Clovis
        (LatLon(35.1717, -103.7250), 64),  # Tucumcari
        (LatLon(36.9034, -104.4392), 64),  # Raton
        (DENVER, 62),
    ),
}

_ROAD_FACTOR: Final = 1.03  # roads are a little longer than the drawn line
_STEP_MI: Final = 2.0  # vertex spacing, like a real routing polyline
_SCRIPTED_MATCH_MI: Final = 30.0


def _densify(a: LatLon, b: LatLon) -> list[LatLon]:
    n = max(1, math.ceil(haversine_mi(a, b) / _STEP_MI))
    return [interpolate(a, b, i / n) for i in range(n)]


def _build_route(waypoints: Sequence[tuple[LatLon, float]], label: str) -> Route:
    geometry: list[LatLon] = []
    spans: list[Span] = []
    for (a, _), (b, mph) in pairwise(waypoints):
        geometry.extend(_densify(a, b))
        leg_mi = haversine_mi(a, b) * _ROAD_FACTOR
        spans.append(Span(leg_mi, leg_mi / mph * 3600))
    geometry.append(waypoints[-1][0])
    return Route(
        geometry=tuple(geometry),
        distance_mi=sum(s.length_mi for s in spans),
        duration_s=sum(s.duration_s for s in spans),
        spans=tuple(spans),
        label=label,
    )


class FakeRouting:
    """Scripted Dallas-Denver routes, or a direct route plus two bowed ones."""

    def __init__(self) -> None:
        self.calls: list[RouteRequest] = []

    def routes(self, request: RouteRequest, alternatives: int) -> list[Route]:
        self.calls.append(request)
        o, d = request.origin, request.destination
        if haversine_mi(o, d) < 1:
            raise NoRoute("origin and destination are the same place")
        if request.via:
            waypoints = [(o, 0.0), *((v, 62.0) for v in request.via), (d, 62.0)]
            return [_build_route(waypoints, "via waypoint")]
        if (
            haversine_mi(o, DALLAS) < _SCRIPTED_MATCH_MI
            and haversine_mi(d, DENVER) < _SCRIPTED_MATCH_MI
        ):
            routes = [_build_route(w, label) for label, w in _SCRIPTED.items()]
        else:
            routes = [
                _build_route([(o, 0), (d, 63)], "direct"),
                _build_route([(o, 0), (offset_from_midpoint(o, d, 0.12), 64), (d, 64)], "northern"),
                _build_route(
                    [(o, 0), (offset_from_midpoint(o, d, -0.12), 64), (d, 64)], "southern"
                ),
            ]
        routes.sort(key=lambda r: r.duration_s)
        return routes[: 1 + alternatives]


# --- Weather ---------------------------------------------------------------


@dataclass(frozen=True)
class StormCell:
    """A storm that circles its centre, so it moves on the heatmap but stays put for the demo.

    A drifting storm would leave the routes a few hours after the anchor,
    and the demo outcome would depend on exactly when a reviewer departs.
    """

    center: LatLon
    orbit_mi: float  # radius of the circle the cell's centre moves on
    period_h: float  # time for one lap
    radius_mi: float  # where intensity falls to 1/e
    gust_mph: float  # added to the background at the centre
    rain_in_hr: float
    snow_in_hr: float = 0.0

    def position(self, hours: float) -> LatLon:
        angle = 2 * math.pi * hours / self.period_h
        east, north = self.orbit_mi * math.cos(angle), self.orbit_mi * math.sin(angle)
        lat = self.center.lat + math.degrees(north / EARTH_RADIUS_MI)
        lon = self.center.lon + math.degrees(
            east / (EARTH_RADIUS_MI * math.cos(math.radians(self.center.lat)))
        )
        return LatLon(lat, lon)


_BACKGROUND_GUST: Final = 12.0
_BACKGROUND_WIND_RATIO: Final = 0.6  # sustained wind relative to gusts

# Sized so the outcome holds for any departure in the 48 h window, any load
# and any sampling interval. Each storm's centre stays within its orbit of
# the city its route passes through, so the road is never more than that far
# from the core. Severe rain (>= 0.5 in/hr) then reaches at least 40 mi
# either side along the road, more than a 50 mi interval can skip.
SCENARIOS: Final[dict[Scenario, tuple[StormCell, ...]]] = {
    "demo": (
        StormCell(LatLon(37.69, -97.34), 20, 18, 60, gust_mph=30, rain_in_hr=0.95),  # Wichita
        StormCell(LatLon(33.58, -101.86), 20, 14, 60, gust_mph=24, rain_in_hr=0.95),  # Lubbock
    ),
    # As demo, but the Wichita storm's gusts reach No Travel (>= 55 mph) at any load.
    "strong": (
        StormCell(LatLon(37.69, -97.34), 20, 18, 70, gust_mph=62, rain_in_hr=0.95),
        StormCell(LatLon(33.58, -101.86), 20, 14, 60, gust_mph=24, rain_in_hr=0.95),
    ),
}


def _floor_hour(t: datetime) -> datetime:
    return t.astimezone(UTC).replace(minute=0, second=0, microsecond=0)


class FakeWeather:
    """Storm cells over a calm background, a pure function of place and time."""

    def __init__(
        self,
        scenario: Scenario = "demo",
        anchor: datetime | None = None,
        clock: Callable[[], datetime] = lambda: datetime.now(UTC),
    ) -> None:
        self.cells = SCENARIOS[scenario]
        self._anchor = anchor
        self._clock = clock
        self.calls = 0  # upstream calls, for cache tests

    @property
    def anchor(self) -> datetime:
        """The hour the storms are at their scripted centres."""
        return self._anchor or _floor_hour(self._clock())

    def forecast(self, p: LatLon, hour: datetime) -> Forecast:
        hours = (hour - self.anchor).total_seconds() / 3600
        gust, rain, snow = _BACKGROUND_GUST, 0.0, 0.0
        for cell in self.cells:
            weight = math.exp(-((haversine_mi(p, cell.position(hours)) / cell.radius_mi) ** 2))
            gust += cell.gust_mph * weight
            rain += cell.rain_in_hr * weight
            snow += cell.snow_in_hr * weight
        return Forecast(
            valid_hour=hour,
            gust_mph=round(gust, 1),
            rain_in_hr=round(rain, 3),
            snow_in_hr=round(snow, 2),
            wind_mph=round(gust * _BACKGROUND_WIND_RATIO, 1),
            weather_code=63 if rain >= 0.1 else 3,
        )

    def hourly(
        self, points: Sequence[LatLon], start: datetime, hours: int
    ) -> list[ForecastSeries | None]:
        self.calls += 1
        start = _floor_hour(start)
        stamps = [start + timedelta(hours=h) for h in range(hours)]
        return [ForecastSeries(start, tuple(self.forecast(p, t) for t in stamps)) for p in points]


# --- Geocoding -------------------------------------------------------------

_PLACES: Final = (
    Place("Dallas, TX", DALLAS, "America/Chicago"),
    Place("Denver, CO", DENVER, "America/Denver"),
    Place("Amarillo, TX", LatLon(35.2220, -101.8313), "America/Chicago"),
    Place("Albuquerque, NM", LatLon(35.0844, -106.6504), "America/Denver"),
    Place("Chicago, IL", LatLon(41.8781, -87.6298), "America/Chicago"),
    Place("Memphis, TN", LatLon(35.1495, -90.0490), "America/Chicago"),
    Place("Oklahoma City, OK", LatLon(35.4676, -97.5164), "America/Chicago"),
    Place("Houston, TX", LatLon(29.7604, -95.3698), "America/Chicago"),
    Place("Kansas City, MO", LatLon(39.0997, -94.5786), "America/Chicago"),
    Place("Phoenix, AZ", LatLon(33.4484, -112.0740), "America/Phoenix"),
    Place("Salt Lake City, UT", LatLon(40.7608, -111.8910), "America/Denver"),
    Place("Los Angeles, CA", LatLon(34.0522, -118.2437), "America/Los_Angeles"),
    Place("Atlanta, GA", LatLon(33.7490, -84.3880), "America/New_York"),
    Place("New York, NY", LatLon(40.7128, -74.0060), "America/New_York"),
    Place("Seattle, WA", LatLon(47.6062, -122.3321), "America/Los_Angeles"),
)


class FakeGeocoder:
    def suggest(self, query: str, limit: int = 5) -> list[Place]:
        q = query.strip().lower()
        if len(q) < 2:
            return []
        starts = [p for p in _PLACES if p.label.lower().startswith(q)]
        contains = [p for p in _PLACES if q in p.label.lower() and p not in starts]
        return (starts + contains)[:limit]
