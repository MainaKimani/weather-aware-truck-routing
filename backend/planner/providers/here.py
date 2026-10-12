"""HERE Routing v8 (truck mode) adapter (RFC §5.1).

One request asks for the main route plus alternatives with the truck's
gross weight, so a heavier load can be routed differently. Spans are split
by `dynamicSpeedInfo`, which starts a new span whenever the expected speed
changes; `length` and `duration` ride along as metadata. Requesting only
length and duration would give one span per section, and ETAs would lose
every speed change along the route.
"""

from collections.abc import Mapping, Sequence
from typing import Any, Final

from planner.domain.eta import require_aware
from planner.domain.polyline import decode_flexible
from planner.domain.types import LatLon, Route, Span
from planner.domain.units import lb_to_kg, m_to_mi
from planner.providers.base import NoRoute, RouteRequest, RoutingUnavailable
from planner.providers.http import HttpClient, HttpError

ROUTES_URL: Final = "https://router.hereapi.com/v8/routes"


def _fmt(p: LatLon) -> str:
    return f"{p.lat:.6f},{p.lon:.6f}"


class HereRouting:
    def __init__(self, api_key: str, http: HttpClient | None = None) -> None:
        if not api_key:
            raise ValueError("HERE_API_KEY is required for real routing")
        self._key = api_key
        self._http = http or HttpClient("HERE routing")

    def params(self, request: RouteRequest, alternatives: int) -> list[tuple[str, str]]:
        params = [
            ("transportMode", "truck"),
            ("origin", _fmt(request.origin)),
            ("destination", _fmt(request.destination)),
            ("departureTime", require_aware(request.departure).isoformat(timespec="seconds")),
            ("vehicle[grossWeight]", str(round(lb_to_kg(request.load_lb)))),
            ("alternatives", str(alternatives)),
            ("return", "polyline,summary,routeLabels"),
            ("spans", "dynamicSpeedInfo,length,duration"),
            ("apiKey", self._key),
        ]
        # passThrough: drive through the via point without treating it as a stop.
        params += [("via", f"{_fmt(v)}!passThrough=true") for v in request.via]
        return params

    def routes(self, request: RouteRequest, alternatives: int) -> list[Route]:
        try:
            body = self._http.get_json(ROUTES_URL, self.params(request, alternatives))
        except HttpError as exc:
            raise RoutingUnavailable(str(exc)) from exc
        return parse_routes(body)


def parse_routes(body: Any) -> list[Route]:
    """HERE's response as domain routes, fastest first.

    A response without routes is NoRoute; a route without geometry or
    durations is an error, never a zero-length route (RFC §18.4).
    """
    if not isinstance(body, Mapping):
        raise RoutingUnavailable("HERE routing: unexpected response")
    raw_routes = body.get("routes")
    if not isinstance(raw_routes, list):
        raise RoutingUnavailable("HERE routing: response has no routes list")
    if not raw_routes:
        notices = body.get("notices") or []
        detail = notices[0].get("title") if notices and isinstance(notices[0], Mapping) else None
        raise NoRoute(detail or "HERE found no truck route between these points")
    try:
        routes = [_parse_route(r) for r in raw_routes]
    except (KeyError, TypeError, ValueError) as exc:
        raise RoutingUnavailable(f"HERE routing: malformed route ({exc})") from exc
    return sorted(routes, key=lambda r: r.duration_s)


def _parse_route(raw: Mapping[str, Any]) -> Route:
    sections = raw["sections"]
    if not sections:
        raise ValueError("route has no sections")
    geometry: list[LatLon] = []
    spans: list[Span] = []
    length_m = duration_s = 0.0
    for section in sections:
        points = decode_flexible(section["polyline"])
        if len(points) < 2:
            raise ValueError("section geometry has fewer than two points")
        summary = section["summary"]
        section_m, section_s = float(summary["length"]), float(summary["duration"])
        length_m += section_m
        duration_s += section_s
        # Consecutive sections share their join point; keep one copy.
        geometry.extend(points[1:] if geometry and points[0] == geometry[-1] else points)
        spans.extend(_section_spans(section.get("spans"), section_m, section_s))
    if length_m <= 0:
        raise ValueError("route has zero length")
    return Route(
        geometry=tuple(geometry),
        distance_mi=m_to_mi(length_m),
        duration_s=duration_s,
        spans=tuple(spans),
        label=_label(raw.get("routeLabels")),
    )


def _section_spans(
    raw: Sequence[Mapping[str, Any]] | None, length_m: float, duration_s: float
) -> list[Span]:
    if not raw:
        return [Span(m_to_mi(length_m), duration_s)]
    return [Span(m_to_mi(float(s["length"])), float(s["duration"])) for s in raw]


def _label(raw: Any) -> str | None:
    """'via I-35, US-287' from HERE's route labels, when it sends them."""
    if not isinstance(raw, list):
        return None
    names = []
    for item in raw:
        name = item.get("name") if isinstance(item, Mapping) else None
        value = name.get("value") if isinstance(name, Mapping) else None
        if isinstance(value, str) and value and value not in names:
            names.append(value)
    return f"via {', '.join(names[:2])}" if names else None
