"""Three distinct routes from a routing provider (RFC §5.1).

Ask for more alternatives than needed, drop any route that mostly runs along
a faster one, and keep the fastest three. If fewer than three survive, ask
for routes through via points either side of the trip's midpoint, which push
the router onto other corridors, then de-duplicate again. Still short: return
what we have with a warning. Never pad with near-duplicates.
"""

from dataclasses import dataclass, replace
from typing import Final, Literal

from planner.domain.alternatives import is_duplicate
from planner.domain.geo import offset_from_midpoint
from planner.domain.types import Route
from planner.providers.base import ProviderError, RouteRequest, RoutingProvider

WANTED: Final = 3
ASK_ALTERNATIVES: Final = 4
VIA_OFFSET: Final = 0.10  # of the trip length, either side of the midpoint


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
