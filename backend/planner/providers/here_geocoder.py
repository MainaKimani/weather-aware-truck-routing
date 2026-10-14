"""HERE Autosuggest adapter for the origin and destination fields.

Biased to North America: `at` (centre of the contiguous US) gives the
ranking a focus, and `in=countryCode:...` filters results. HERE needs a
location focus alongside a country filter. `show=tz` adds each place's IANA
time zone, so the form can show departure times in the origin's zone.
"""

from collections.abc import Callable, Mapping
from typing import Any, Final

from planner.domain.types import LatLon
from planner.providers.base import GeocodingUnavailable, Place
from planner.providers.http import HttpClient, HttpError

AUTOSUGGEST_URL: Final = "https://autosuggest.search.hereapi.com/v1/autosuggest"
US_CENTRE: Final = "39.8283,-98.5795"
COUNTRIES: Final = "countryCode:USA,CAN,MEX"
MIN_QUERY: Final = 3


class HereGeocoder:
    def __init__(
        self,
        api_key: str,
        http: HttpClient | None = None,
        meter: Callable[[], None] | None = None,
    ) -> None:
        """`meter` is charged before each request (see providers/budget.py); unused with `http`."""
        if not api_key:
            raise ValueError("HERE_API_KEY is required for real geocoding")
        self._key = api_key
        self._http = http or HttpClient("HERE autosuggest", meter=meter)

    def suggest(self, query: str, limit: int = 5) -> list[Place]:
        q = query.strip()
        if len(q) < MIN_QUERY:
            return []  # no provider call for one or two characters
        params = {
            "q": q,
            "at": US_CENTRE,
            "in": COUNTRIES,
            "limit": str(limit),
            "lang": "en-US",
            "show": "tz",
            "apiKey": self._key,
        }
        try:
            body = self._http.get_json(AUTOSUGGEST_URL, params)
        except HttpError as exc:
            raise GeocodingUnavailable(str(exc)) from exc
        return parse_suggestions(body)[:limit]


def parse_suggestions(body: Any) -> list[Place]:
    """Places with coordinates, in HERE's order. Query suggestions (no position) are skipped."""
    if not isinstance(body, Mapping) or not isinstance(body.get("items"), list):
        raise GeocodingUnavailable("HERE autosuggest: unexpected response")
    places = []
    for item in body["items"]:
        place = _place(item)
        if place is not None:
            places.append(place)
    return places


def _place(item: Any) -> Place | None:
    if not isinstance(item, Mapping):
        return None
    position = item.get("position")
    if not isinstance(position, Mapping):
        return None
    try:
        point = LatLon(float(position["lat"]), float(position["lng"]))
    except (KeyError, TypeError, ValueError):
        return None
    address = item.get("address")
    label = address.get("label") if isinstance(address, Mapping) else None
    label = label or item.get("title")
    if not isinstance(label, str) or not label:
        return None
    tz = item.get("timeZone")
    tz_name = tz.get("name") if isinstance(tz, Mapping) else None
    return Place(_short(label), point, tz_name if isinstance(tz_name, str) else None)


def _short(label: str) -> str:
    """'Dallas, TX, United States' -> 'Dallas, TX'."""
    for suffix in (", United States", ", USA"):
        if label.endswith(suffix):
            return label[: -len(suffix)]
    return label
