"""Saving plans as trips and reading them back (RFC §3.1).

A trip stores the plan response exactly as the API returned it, version 1
of the snapshot shape: the parts we filter or summarise on as columns, the
parts read only as a whole (checkpoints, HOS stops) as JSON. `save_trip`
takes that response and `load_snapshot` gives it back unchanged, plus the
trip's id, so a reopened trip shows what the driver saw.

The response, not the domain objects, is what's stored: it is already the
versioned, documented shape (openapi.yaml), and the domain can change
without old trips needing to be rebuilt from it.
"""

import uuid
from collections.abc import Mapping
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any, Final

from django.db import IntegrityError, transaction
from django.utils.dateparse import parse_datetime

from planner.access import Owner
from planner.domain.polyline import decode
from planner.domain.types import LatLon
from planner.models import Trip, TripHeatmap, TripRoute

SNAPSHOT_VERSION: Final = 1

Snapshot = dict[str, Any]

# Response level names and their TripRoute columns.
LEVEL_COLUMNS: Final = {
    "LOW": "low_mi",
    "MODERATE": "moderate_mi",
    "HIGH": "high_mi",
    "SEVERE": "severe_mi",
    "NO_TRAVEL": "no_travel_mi",
    "UNKNOWN": "unknown_mi",
}
WIRE_TIME: Final = "%Y-%m-%dT%H:%M:%SZ"


def save_trip(
    snapshot: Mapping[str, Any], owner: Owner, idempotency_key: uuid.UUID | None = None
) -> Trip:
    """Save a plan response as the owner's trip, with its routes, all or nothing."""
    inputs = snapshot["inputs"]
    origin, destination = inputs["origin"], inputs["destination"]
    recommended = snapshot["recommended_route_id"]
    with transaction.atomic():
        trip = Trip.objects.create(
            **owner.as_fields(),
            idempotency_key=idempotency_key,
            rules_version=snapshot["rules_version"],
            snapshot_version=SNAPSHOT_VERSION,
            origin_label=origin["label"],
            origin_lat=_coord(origin["lat"]),
            origin_lon=_coord(origin["lon"]),
            origin_tz=origin["tz"],
            destination_label=destination["label"],
            destination_lat=_coord(destination["lat"]),
            destination_lon=_coord(destination["lon"]),
            destination_tz=destination["tz"],
            departure=_time(inputs["departure"]),
            load_lb=inputs["load_lb"],
            interval_mi=inputs["interval_mi"],
            hos=inputs["hos"],
            generated_at=_time(snapshot["generated_at"]),
            forecast_as_of=_maybe_time(snapshot["forecast_as_of"]),
            stale=snapshot["stale"],
            demo=snapshot["demo"],
            reason_code=snapshot["reason_code"],
            recommendation_reason=snapshot["recommendation_reason"],
            warnings=snapshot["warnings"],
            plan_settings=snapshot["settings"],
            bbox=snapshot["corridor"]["bbox"],
        )
        TripRoute.objects.bulk_create(
            _route(trip, route, recommended=route["id"] == recommended)
            for route in snapshot["routes"]
        )
    return trip


def _route(trip: Trip, route: Mapping[str, Any], *, recommended: bool) -> TripRoute:
    metrics = route["metrics"]
    by_level = metrics["miles_by_level"]
    return TripRoute(
        trip=trip,
        key=route["id"],
        rank=route["rank"],
        recommended=recommended,
        name=route["name"],
        label=route["label"],
        geometry=route["geometry"],
        distance_mi=route["distance_mi"],
        duration_s=route["duration_s"],
        trip_duration_s=route["trip_duration_s"],
        departure=_time(route["departure"]),
        arrival=_time(route["arrival"]),
        eta_estimated=route["eta_estimated"],
        avg_risk=metrics["avg_risk"],
        worst_level=metrics["worst"],
        worst_at_mile=metrics["worst_at_mile"],
        drivable=metrics["drivable"],
        checkpoints=route["checkpoints"],
        hos_stops=route["hos_stops"],
        **{column: by_level[level] for level, column in LEVEL_COLUMNS.items()},
    )


def trip_for_key(idempotency_key: uuid.UUID) -> Trip | None:
    """The trip a request with this key already created, whoever owns it."""
    return Trip.objects.filter(idempotency_key=idempotency_key).first()


def load_snapshot(trip: Trip) -> Snapshot:
    """The plan response the trip was saved from, with its `trip_id`."""
    if trip.snapshot_version != SNAPSHOT_VERSION:
        raise ValueError(f"no reader for snapshot version {trip.snapshot_version}")
    routes = list(trip.routes.all())
    recommended = next((r.key for r in routes if r.recommended), None)
    return {
        "trip_id": str(trip.pk),
        "generated_at": _wire(trip.generated_at),
        "rules_version": trip.rules_version,
        "stale": trip.stale,
        "forecast_as_of": _wire(trip.forecast_as_of),
        "demo": trip.demo,
        "inputs": {
            "origin": _place(trip.origin_label, trip.origin_lat, trip.origin_lon, trip.origin_tz),
            "destination": _place(
                trip.destination_label,
                trip.destination_lat,
                trip.destination_lon,
                trip.destination_tz,
            ),
            "departure": _wire(trip.departure),
            "load_lb": trip.load_lb,
            "interval_mi": trip.interval_mi,
            "hos": trip.hos,
        },
        "settings": trip.plan_settings,
        "recommended_route_id": recommended,
        "reason_code": trip.reason_code,
        "recommendation_reason": trip.recommendation_reason,
        "warnings": trip.warnings,
        "routes": [_route_snapshot(r) for r in routes],
        "corridor": {"bbox": trip.bbox},
    }


def _route_snapshot(route: TripRoute) -> Snapshot:
    return {
        "id": route.key,
        "rank": route.rank,
        "name": route.name,
        "label": route.label,
        "geometry": route.geometry,
        "distance_mi": route.distance_mi,
        "duration_s": route.duration_s,
        "trip_duration_s": route.trip_duration_s,
        "departure": _wire(route.departure),
        "arrival": _wire(route.arrival),
        "eta_estimated": route.eta_estimated,
        "hos_stops": route.hos_stops,
        "metrics": {
            "miles_by_level": {
                level: getattr(route, column) for level, column in LEVEL_COLUMNS.items()
            },
            "avg_risk": route.avg_risk,
            "worst": route.worst_level,
            "worst_at_mile": route.worst_at_mile,
            "drivable": route.drivable,
        },
        "checkpoints": route.checkpoints,
    }


def route_lines(trip: Trip) -> list[list[LatLon]]:
    """Each route's polyline, for the corridor around them."""
    return [decode(geometry) for geometry in trip.routes.values_list("geometry", flat=True)]


# --- Heatmap -----------------------------------------------------------------


def load_heatmap(trip: Trip) -> Snapshot | None:
    """The trip's saved heatmap response, or None before it is first computed."""
    heatmap = TripHeatmap.objects.filter(trip=trip).first()
    return None if heatmap is None else _heatmap_snapshot(heatmap)


def save_heatmap(trip: Trip, snapshot: Mapping[str, Any]) -> Snapshot:
    """Keep a computed heatmap, and return what is kept.

    Two first requests can compute it at once; the second insert hits the
    one-to-one key, and both get the copy that was saved first.
    """
    try:
        with transaction.atomic():
            heatmap = TripHeatmap.objects.create(
                trip=trip,
                start_hour=_time(snapshot["start_hour"]),
                hours=snapshot["hours"],
                cell_deg=snapshot["cell_deg"],
                stale=snapshot["stale"],
                forecast_as_of=_maybe_time(snapshot["forecast_as_of"]),
                points=snapshot["points"],
                risk=snapshot["risk"],
            )
    except IntegrityError:
        heatmap = TripHeatmap.objects.get(trip=trip)
    return _heatmap_snapshot(heatmap)


def _heatmap_snapshot(heatmap: TripHeatmap) -> Snapshot:
    return {
        "start_hour": _wire(heatmap.start_hour),
        "hours": heatmap.hours,
        "cell_deg": heatmap.cell_deg,
        "stale": heatmap.stale,
        "forecast_as_of": _wire(heatmap.forecast_as_of),
        "points": heatmap.points,
        "risk": heatmap.risk,
    }


def _place(label: str, lat: Decimal, lon: Decimal, tz: str | None) -> Snapshot:
    return {"label": label, "lat": float(lat), "lon": float(lon), "tz": tz}


def _coord(value: float) -> Decimal:
    # The response already rounds coordinates to 5 places, which the column holds exactly.
    return Decimal(str(value))


def _time(value: str) -> datetime:
    parsed = parse_datetime(value)
    if parsed is None:
        raise ValueError(f"not a date-time: {value!r}")
    return parsed


def _maybe_time(value: str | None) -> datetime | None:
    return None if value is None else _time(value)


def _wire(value: datetime | None) -> str | None:
    return None if value is None else value.astimezone(UTC).strftime(WIRE_TIME)
