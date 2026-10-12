"""A minimal plan pipeline over the domain modules, for provider and demo tests.

The plan service is the real orchestration (caching, HOS, persistence);
this is the same chain of pure functions without any of that.
"""

from datetime import datetime, timedelta

from planner.domain.eta import DriveProfile, ceil_to_hour, eta
from planner.domain.metrics import RatedCheckpoint, route_metrics
from planner.domain.ranking import Candidate, Ranking, rank_routes
from planner.domain.risk import classify
from planner.domain.sampling import RouteGeometry, sample_checkpoints
from planner.domain.types import Route
from planner.providers.base import WeatherProvider


def evaluate(
    routes: list[Route],
    weather: WeatherProvider,
    departure: datetime,
    load_lb: int,
    interval_mi: int = 25,
) -> Ranking:
    candidates = []
    for i, route in enumerate(routes):
        geometry = RouteGeometry.build(route.geometry, route.distance_mi)
        points = sample_checkpoints(geometry, interval_mi)
        profile = DriveProfile.build(route.spans, route.distance_mi, route.duration_s)
        etas = [eta(departure, profile.drive_s_at(p.mile)) for p in points]
        start = ceil_to_hour(departure) - timedelta(hours=1)
        hours = int((ceil_to_hour(etas[-1]) - start) / timedelta(hours=1)) + 1
        series = weather.hourly([p.position for p in points], start, hours)
        rated = []
        for p, t, s in zip(points, etas, series, strict=True):
            forecast = s.for_eta(t) if s else None
            rated.append(RatedCheckpoint(p.mile, p.owned_mi, classify(forecast, load_lb).level))
        candidates.append(
            Candidate(route.label or f"r{i + 1}", route_metrics(rated), route.duration_s)
        )
    return rank_routes(candidates)
