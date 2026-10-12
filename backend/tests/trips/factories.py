"""Minimal valid trips and routes for model and access tests."""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from accounts.models import User
from planner.models import Trip, TripRoute

DEPARTURE = datetime(2026, 10, 12, 12, tzinfo=UTC)


def make_trip(**overrides: Any) -> Trip:
    """A guest's trip unless `user` is given."""
    fields: dict[str, Any] = {
        "rules_version": "1.0.0",
        "snapshot_version": 1,
        "origin_label": "Dallas, TX",
        "origin_lat": "32.77670",
        "origin_lon": "-96.79700",
        "destination_label": "Denver, CO",
        "destination_lat": "39.73920",
        "destination_lon": "-104.99030",
        "departure": DEPARTURE,
        "load_lb": 42_000,
        "interval_mi": 25,
        "generated_at": DEPARTURE - timedelta(minutes=5),
        "reason_code": "only_route",
        "bbox": [-105.0, 32.7, -96.8, 39.8],
    }
    if "user" not in overrides:
        fields["guest_id"] = uuid.uuid4()
    fields.update(overrides)
    return Trip.objects.create(**fields)


def make_route(trip: Trip, **overrides: Any) -> TripRoute:
    fields: dict[str, Any] = {
        "trip": trip,
        "key": "r1",
        "rank": 1,
        "name": "Route A",
        "geometry": "_p~iF~ps|U_ulLnnqC",
        "distance_mi": 790.0,
        "duration_s": 45_000,
        "trip_duration_s": 45_000,
        "departure": DEPARTURE,
        "arrival": DEPARTURE + timedelta(hours=12.5),
        "low_mi": 790.0,
        "moderate_mi": 0.0,
        "high_mi": 0.0,
        "severe_mi": 0.0,
        "no_travel_mi": 0.0,
        "unknown_mi": 0.0,
        "avg_risk": 0.0,
        "worst_level": "LOW",
        "drivable": True,
        "checkpoints": [],
    }
    fields.update(overrides)
    return TripRoute.objects.create(**fields)


def make_user(email: str = "driver@example.com") -> User:
    return User.objects.create_user(email, password="pw-1234-long")
