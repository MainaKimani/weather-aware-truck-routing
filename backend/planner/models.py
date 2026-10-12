"""Trips: every plan is saved, owned by a signed-in user or a guest (RFC §3.1).

What we filter, sort or summarise on is a real column with constraints.
What is always read together with its parent and never queried on its own
(checkpoints, HOS stops, the heatmap grid) is JSON on that parent.

The columns and JSON hold the plan response as the API returned it, in the
shape named by `snapshot_version`, so a trip read back gives the same
response (see planner/repositories.py).
"""

from typing import ClassVar
from uuid import uuid4

from django.conf import settings
from django.db import models
from django.db.models import CheckConstraint, F, Index, Q, UniqueConstraint

from planner.domain.risk import Level

MAX_LOAD_LB = 80_000
INTERVALS_MI = (10, 25, 50)
LEVEL_CHOICES = [(level.name, level.name) for level in Level]


class Trip(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="trips",
    )
    guest_id = models.UUIDField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    rules_version = models.CharField(max_length=16)
    snapshot_version = models.PositiveSmallIntegerField()
    # One per form submission, so a retried request can't create a second trip.
    idempotency_key = models.UUIDField(null=True, blank=True, unique=True)
    replanned_from = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL, related_name="replans"
    )

    # Set by the owner.
    name = models.CharField(max_length=120, blank=True)
    saved = models.BooleanField(default=False)
    shared = models.BooleanField(default=False)

    # Inputs.
    origin_label = models.CharField(max_length=200)
    origin_lat = models.DecimalField(max_digits=8, decimal_places=5)
    origin_lon = models.DecimalField(max_digits=8, decimal_places=5)
    origin_tz = models.CharField(max_length=64, null=True, blank=True)
    destination_label = models.CharField(max_length=200)
    destination_lat = models.DecimalField(max_digits=8, decimal_places=5)
    destination_lon = models.DecimalField(max_digits=8, decimal_places=5)
    destination_tz = models.CharField(max_length=64, null=True, blank=True)
    departure = models.DateTimeField()
    load_lb = models.PositiveIntegerField()
    interval_mi = models.PositiveSmallIntegerField(choices=[(i, f"{i} mi") for i in INTERVALS_MI])
    hos = models.JSONField(null=True, blank=True)  # the clocks, when HOS was on

    # Outcome.
    generated_at = models.DateTimeField()
    forecast_as_of = models.DateTimeField(null=True, blank=True)
    stale = models.BooleanField(default=False)
    demo = models.BooleanField(default=False)
    reason_code = models.CharField(max_length=24)
    recommendation_reason = models.CharField(max_length=200, blank=True)
    warnings = models.JSONField(default=list)
    plan_settings = models.JSONField(default=dict)  # wind basis, tolerance, HOS on, as applied
    bbox = models.JSONField()  # [west, south, east, north] of all routes

    routes: "models.Manager[TripRoute]"

    class Meta:
        constraints: ClassVar = [
            CheckConstraint(
                name="trip_has_exactly_one_owner",
                condition=Q(user__isnull=False, guest_id__isnull=True)
                | Q(user__isnull=True, guest_id__isnull=False),
            ),
            CheckConstraint(
                name="trip_only_users_save", condition=Q(saved=False) | Q(user__isnull=False)
            ),
            CheckConstraint(
                name="trip_load_in_range", condition=Q(load_lb__gte=1, load_lb__lte=MAX_LOAD_LB)
            ),
            CheckConstraint(name="trip_valid_interval", condition=Q(interval_mi__in=INTERVALS_MI)),
        ]
        indexes: ClassVar = [
            Index(fields=["user", "-created_at"], name="trip_user_recent"),
            Index(fields=["guest_id", "-created_at"], name="trip_guest_recent"),
        ]

    def __str__(self) -> str:
        return f"{self.origin_label} → {self.destination_label}"


class TripRoute(models.Model):
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name="routes")
    key = models.CharField(max_length=4)  # "r1".."r3", the route's id in the response
    rank = models.PositiveSmallIntegerField()  # 1 = best
    recommended = models.BooleanField(default=False)
    name = models.CharField(max_length=80)
    label = models.CharField(max_length=120, null=True, blank=True)
    geometry = models.TextField()  # encoded polyline, precision 5
    distance_mi = models.FloatField()
    duration_s = models.PositiveIntegerField()  # driving only
    trip_duration_s = models.PositiveIntegerField()  # driving plus HOS stops
    departure = models.DateTimeField()
    arrival = models.DateTimeField()
    eta_estimated = models.BooleanField(default=False)
    low_mi = models.FloatField()
    moderate_mi = models.FloatField()
    high_mi = models.FloatField()
    severe_mi = models.FloatField()
    no_travel_mi = models.FloatField()
    unknown_mi = models.FloatField()
    avg_risk = models.FloatField(null=True, blank=True)
    worst_level = models.CharField(max_length=10, choices=LEVEL_CHOICES, null=True, blank=True)
    worst_at_mile = models.FloatField(null=True, blank=True)
    drivable = models.BooleanField()
    checkpoints = models.JSONField()  # read as a whole, never queried
    hos_stops = models.JSONField(default=list)

    class Meta:
        ordering = ("rank",)
        constraints: ClassVar = [
            UniqueConstraint(fields=["trip", "rank"], name="route_unique_rank"),
            UniqueConstraint(fields=["trip", "key"], name="route_unique_key"),
            UniqueConstraint(
                fields=["trip"],
                condition=Q(recommended=True),
                name="route_one_recommended_per_trip",
            ),
            CheckConstraint(name="route_rank_1_to_3", condition=Q(rank__gte=1, rank__lte=3)),
            CheckConstraint(
                name="route_recommended_is_drivable",
                condition=Q(recommended=False) | Q(drivable=True),
            ),
            CheckConstraint(
                name="route_avg_risk_range",
                condition=Q(avg_risk__isnull=True) | Q(avg_risk__gte=0, avg_risk__lte=4),
            ),
            CheckConstraint(
                name="route_arrival_after_departure", condition=Q(arrival__gte=F("departure"))
            ),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.trip_id})"


class TripHeatmap(models.Model):
    """The corridor grid, computed on the first request and kept, so a reopened
    trip shows the heatmap exactly as it was (RFC §7.3)."""

    trip = models.OneToOneField(
        Trip, primary_key=True, on_delete=models.CASCADE, related_name="heatmap"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    start_hour = models.DateTimeField()
    hours = models.PositiveSmallIntegerField()
    cell_deg = models.FloatField()
    stale = models.BooleanField(default=False)
    forecast_as_of = models.DateTimeField(null=True, blank=True)
    points = models.JSONField()  # [[lon, lat], ...]
    risk = models.JSONField()  # risk[i][h]: level 0-4, null for Unknown

    def __str__(self) -> str:
        return f"Heatmap for {self.trip_id}"
