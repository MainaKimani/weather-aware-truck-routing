"""Three distinct routes from a routing provider (RFC §5.1).

Ask for more alternatives than needed, drop any route that mostly runs along
a faster one, and keep the fastest three. If fewer than three survive, ask
for routes through via points either side of the trip's midpoint, which push
the router onto other corridors, then de-duplicate again. Still short: return
what we have with a warning. Never pad with near-duplicates.

`cached_find_routes` keeps the result for 6 hours, because every routing
call is metered (providers/budget.py). The key is the request with the
departure rounded down to the hour, so replanning the same trip, or planning
it again a few minutes later, costs no routing call. Geometry is stored as a
precision-6 polyline: HERE sends precision 6, so the round trip is exact.
"""

import hashlib
from dataclasses import dataclass, replace
from datetime import UTC
from typing import Any, Final, Literal

from django.core.cache import BaseCache, cache

from planner.domain.alternatives import is_duplicate
from planner.domain.eta import require_aware
from planner.domain.geo import offset_from_midpoint
from planner.domain.polyline import decode, encode
from planner.domain.types import Route, Span
from planner.domain.version import RULES_VERSION
from planner.providers.base import ProviderError, RouteRequest, RoutingProvider

WANTED: Final = 3
ASK_ALTERNATIVES: Final = 4
VIA_OFFSET: Final = 0.10  # of the trip length, either side of the midpoint
CACHE_TTL_S: Final = 6 * 3600
CACHE_SCHEMA_VERSION: Final = 1
GEOMETRY_PRECISION: Final = 6


@dataclass(frozen=True)
class RouteWarning:
    code: Literal["only_n_routes_found"]
    message: str


@dataclass(frozen=True)
class RouteOptions:
    routes: tuple[Route, ...]  # fastest first, at most WANTED
    warnings: tuple[RouteWarning, ...]
    via_fallback_used: bool


def distinct(routes: list[Route], limit: int = WANTED) -> list[Route]:
    """The fastest routes that aren't near-duplicates of a faster kept one."""
    kept: list[Route] = []
    for route in sorted(routes, key=lambda r: r.duration_s):
        if not any(is_duplicate(route.geometry, k.geometry) for k in kept):
            kept.append(route)
        if len(kept) == limit:
            break
    return kept


def find_routes(provider: RoutingProvider, request: RouteRequest) -> RouteOptions:
    """Up to three distinct routes. Errors from the main request propagate."""
    routes = distinct(provider.routes(request, ASK_ALTERNATIVES))
    used_fallback = False
    if len(routes) < WANTED:
        used_fallback = True
        extra: list[Route] = []
        for side in (VIA_OFFSET, -VIA_OFFSET):
            via = offset_from_midpoint(request.origin, request.destination, side)
            try:
                extra += provider.routes(replace(request, via=(via,)), alternatives=0)
            except ProviderError:
                continue  # a fallback that fails just doesn't add a route
        routes = distinct([*routes, *extra])

    warnings: tuple[RouteWarning, ...] = ()
    if len(routes) < WANTED:
        n = len(routes)
        warnings = (
            RouteWarning(
                "only_n_routes_found",
                f"Only {n} distinct route{'s' if n != 1 else ''} found for this trip",
            ),
        )
    return RouteOptions(tuple(routes), warnings, used_fallback)


def cache_key(request: RouteRequest) -> str:
    hour = require_aware(request.departure).astimezone(UTC)
    parts = [
        f"{p.lat + 0.0:.6f},{p.lon + 0.0:.6f}"
        for p in (request.origin, request.destination, *request.via)
    ]
    raw = f"{'|'.join(parts)}|{request.load_lb}|{hour:%Y%m%d%H}"
    digest = hashlib.sha256(raw.encode()).hexdigest()[:32]
    return f"v{RULES_VERSION}:rt{CACHE_SCHEMA_VERSION}:{digest}"


def _encode_route(r: Route) -> dict[str, Any]:
    return {
        "geometry": encode(r.geometry, GEOMETRY_PRECISION),
        "distance_mi": r.distance_mi,
        "duration_s": r.duration_s,
        "spans": [(s.length_mi, s.duration_s) for s in r.spans],
        "label": r.label,
    }


def _decode_route(v: dict[str, Any]) -> Route:
    return Route(
        geometry=tuple(decode(v["geometry"], GEOMETRY_PRECISION)),
        distance_mi=v["distance_mi"],
        duration_s=v["duration_s"],
        spans=tuple(Span(mi, s) for mi, s in v["spans"]),
        label=v["label"],
    )


def _encode(options: RouteOptions) -> dict[str, Any]:
    return {
        "routes": [_encode_route(r) for r in options.routes],
        "warnings": [(w.code, w.message) for w in options.warnings],
        "via_fallback_used": options.via_fallback_used,
    }


def _decode(value: dict[str, Any]) -> RouteOptions:
    return RouteOptions(
        routes=tuple(_decode_route(r) for r in value["routes"]),
        warnings=tuple(RouteWarning(code, message) for code, message in value["warnings"]),
        via_fallback_used=value["via_fallback_used"],
    )


def cached_find_routes(
    provider: RoutingProvider, request: RouteRequest, backend: BaseCache = cache
) -> RouteOptions:
    """`find_routes`, from the cache when the same trip was routed in the same hour.

    Only successful results are kept; a failure tries the provider again next time.
    """
    key = cache_key(request)
    cached = backend.get(key)
    if cached is not None:
        return _decode(cached)
    options = find_routes(provider, request)
    backend.set(key, _encode(options), CACHE_TTL_S)
    return options
