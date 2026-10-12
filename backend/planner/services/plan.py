"""Plan a trip: routes, checkpoints, ETAs, forecasts, risk and a recommendation (RFC §6).

The pipeline is a chain of pure domain functions around two outside calls:

1. routes from the routing provider (up to three distinct ones);
2. checkpoints, drive-time profile and, with Hours of Service on, the stops
   that turn driving time into clock time, per route;
3. forecasts for every checkpoint of every route in one cache-first batch,
   so three routes cost one weather request, not three;
4. risk per checkpoint, metrics per route, then the ranking and its reason.

The result is domain objects. The API layer turns them into JSON; nothing
is saved here.
"""

from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Final, Literal

from planner.domain.eta import DriveProfile, eta, require_aware
from planner.domain.hos import HosClocks, HosPlan, PlacedStop, place_stops, plan_hos
from planner.domain.metrics import RatedCheckpoint, RouteMetrics, route_metrics
from planner.domain.ranking import Candidate, ReasonCode, rank_routes
from planner.domain.ranking import Warning as RankingWarning
from planner.domain.risk import RiskResult, classify
from planner.domain.sampling import RouteGeometry, SamplePoint, sample_checkpoints
from planner.domain.types import Forecast, LatLon, Route
from planner.domain.version import RULES_VERSION
from planner.providers.base import Place, RouteRequest
from planner.providers.registry import Providers
from planner.services.forecasts import CHECKPOINT_STEP_DEG, ForecastStore
from planner.services.routing import RouteWarning, find_routes

ROUTE_LETTERS: Final = "ABC"

WarningCode = Literal["only_n_routes_found", "high_unknown", "partial_forecast", "eta_estimated"]


@dataclass(frozen=True)
class PlanRequest:
    origin: Place
    destination: Place
    departure: datetime  # timezone-aware
    load_lb: int
    interval_mi: int
    hos: HosClocks | None = None  # None: Hours of Service off


@dataclass(frozen=True)
class Checkpoint:
    index: int
    mile: float
    owned_mi: float
    position: LatLon
    eta: datetime
    forecast: Forecast | None  # None: no data for this point and hour
    risk: RiskResult


@dataclass(frozen=True)
class PlannedRoute:
    id: str  # "r1".."r3" in provider order, fastest first; stable across re-ranking
    name: str  # "Route A".."Route C", same order
    rank: int  # 1 = best
    route: Route
    departure: datetime
    arrival: datetime
    trip_duration_s: float  # driving plus Hours of Service stops
    eta_estimated: bool  # no per-span speeds, so ETAs assume an even pace
    checkpoints: tuple[Checkpoint, ...]
    hos_stops: tuple[PlacedStop, ...]
    metrics: RouteMetrics


@dataclass(frozen=True)
class PlanWarning:
    code: WarningCode
    message: str
    route_id: str | None = None


@dataclass(frozen=True)
class Plan:
    request: PlanRequest
    routes: tuple[PlannedRoute, ...]  # best first
    recommended_id: str | None
    reason_code: ReasonCode
    reason: str
    warnings: tuple[PlanWarning, ...]
    rules_version: str
    generated_at: datetime
    stale: bool  # some forecasts came from an older fetch because the provider failed
    forecast_as_of: datetime | None  # when the oldest forecast used was fetched
    demo: bool  # computed from the fake providers


@dataclass(frozen=True)
class _Prepared:
    """A route with its checkpoints and timings, before weather."""

    id: str
    name: str
    route: Route
    geometry: RouteGeometry
    profile: DriveProfile
    hos: HosPlan | None
    points: list[SamplePoint]
    etas: list[datetime]  # one per point


def _prepare(i: int, route: Route, request: PlanRequest) -> _Prepared:
    geometry = RouteGeometry.build(route.geometry, route.distance_mi)
    profile = DriveProfile.build(route.spans, route.distance_mi, route.duration_s)
    hos = plan_hos(round(route.duration_s), request.hos) if request.hos else None

    def clock_s(drive_s: float) -> float:
        return hos.clock_offset(drive_s) if hos else drive_s

    points = sample_checkpoints(geometry, request.interval_mi)
    etas = [eta(request.departure, clock_s(profile.drive_s_at(p.mile))) for p in points]
    return _Prepared(
        f"r{i + 1}", f"Route {ROUTE_LETTERS[i]}", route, geometry, profile, hos, points, etas
    )


def plan_trip(
    request: PlanRequest,
    providers: Providers,
    forecasts: ForecastStore | None = None,
    clock: Callable[[], datetime] = lambda: datetime.now(UTC),
) -> Plan:
    """Plan a trip. Provider failures propagate as `ProviderError` subclasses."""
    departure = require_aware(request.departure)
    generated_at = clock()
    store = forecasts or ForecastStore(providers.weather, clock=clock)

    options = find_routes(
        providers.routing,
        RouteRequest(
            request.origin.position, request.destination.position, departure, request.load_lb
        ),
    )
    prepared = [_prepare(i, r, request) for i, r in enumerate(options.routes)]

    # One batch for every checkpoint of every route.
    lookup = store.get([pt.position for p in prepared for pt in p.points], CHECKPOINT_STEP_DEG)

    candidates: list[Candidate] = []
    built: dict[str, tuple[_Prepared, tuple[Checkpoint, ...], RouteMetrics, float]] = {}
    for p in prepared:
        checkpoints: list[Checkpoint] = []
        for pt, at in zip(p.points, p.etas, strict=True):
            series = lookup.for_point(pt.position)
            forecast = series.for_eta(at) if series else None
            risk = classify(forecast, request.load_lb)
            checkpoints.append(
                Checkpoint(pt.index, pt.mile, pt.owned_mi, pt.position, at, forecast, risk)
            )
        metrics = route_metrics(
            [RatedCheckpoint(c.mile, c.owned_mi, c.risk.level) for c in checkpoints]
        )
        # The planner works in whole seconds; add its stops to the exact drive
        # time so arrival equals the last checkpoint's ETA.
        stops_s = p.hos.trip_duration_s - p.hos.total_drive_s if p.hos else 0
        trip_s = p.route.duration_s + stops_s
        candidates.append(Candidate(p.id, metrics, trip_s))
        built[p.id] = (p, tuple(checkpoints), metrics, trip_s)

    ranking = rank_routes(candidates)
    routes = []
    for rank, candidate in enumerate(ranking.ranked, start=1):
        p, rated, metrics, trip_s = built[candidate.route_id]
        stops = place_stops(p.hos, p.profile, p.geometry, departure) if p.hos else []
        routes.append(
            PlannedRoute(
                id=p.id,
                name=p.name,
                rank=rank,
                route=p.route,
                departure=departure,
                arrival=eta(departure, trip_s),
                trip_duration_s=trip_s,
                eta_estimated=p.profile.estimated,
                checkpoints=rated,
                hos_stops=tuple(stops),
                metrics=metrics,
            )
        )

    return Plan(
        request=request,
        routes=tuple(routes),
        recommended_id=ranking.recommended_id,
        reason_code=ranking.reason_code,
        reason=ranking.reason,
        warnings=_warnings(options.warnings, ranking.warnings, routes),
        rules_version=RULES_VERSION,
        generated_at=generated_at,
        stale=lookup.stale,
        forecast_as_of=lookup.oldest_fetch,
        demo=providers.demo,
    )


def _warnings(
    route_warnings: Sequence[RouteWarning],
    ranking_warnings: Sequence[RankingWarning],
    routes: Sequence[PlannedRoute],
) -> tuple[PlanWarning, ...]:
    """Plan-level warnings first, then per-route ones in rank order (RFC §11)."""
    out = [PlanWarning(w.code, w.message) for w in route_warnings]
    out += [PlanWarning(w.code, w.message, w.route_id) for w in ranking_warnings]
    flagged = {w.route_id for w in ranking_warnings}
    for r in routes:
        unknown = r.metrics.unknown_miles
        # Over 20% Unknown already has a ranking warning; below that, still say so.
        if unknown > 0 and r.id not in flagged:
            message = f"No forecast for {round(unknown)} mi of this route"
            out.append(PlanWarning("partial_forecast", message, r.id))
        if r.eta_estimated:
            message = "Arrival times on this route assume an even pace (no speed data)"
            out.append(PlanWarning("eta_estimated", message, r.id))
    return tuple(out)
