"""Trips in the Django admin: who planned what and when, for support.

Trips are records of what the planner said at the time, so the admin can
read them, flag them and delete them, but not edit what was planned.

Provider usage shows how much of each metered service's monthly budget is
spent. It's read-only: the counts are what HERE has been sent.
"""

from typing import Any

from django.contrib import admin
from django.db.models import QuerySet
from django.http import HttpRequest

from planner.models import ProviderUsage, Trip, TripRoute


class GuestFilter(admin.SimpleListFilter):
    title = "owner"
    parameter_name = "owner"

    def lookups(self, request: HttpRequest, model_admin: Any) -> list[tuple[str, str]]:
        return [("user", "Signed-in user"), ("guest", "Guest")]

    def queryset(self, request: HttpRequest, queryset: QuerySet[Trip]) -> QuerySet[Trip]:
        if self.value() == "user":
            return queryset.filter(user__isnull=False)
        if self.value() == "guest":
            return queryset.filter(user__isnull=True)
        return queryset


class TripRouteInline(admin.TabularInline[TripRoute, Trip]):
    model = TripRoute
    extra = 0
    can_delete = False
    fields = (
        "rank",
        "key",
        "name",
        "label",
        "recommended",
        "drivable",
        "distance_mi",
        "avg_risk",
        "worst_level",
        "arrival",
    )
    readonly_fields = fields
    show_change_link = False

    def has_add_permission(self, request: HttpRequest, obj: Trip | None = None) -> bool:
        return False


@admin.register(Trip)
class TripAdmin(admin.ModelAdmin[Trip]):
    list_display = ("__str__", "owner", "created_at", "saved", "shared", "demo")
    list_filter = ("saved", "shared", GuestFilter, "demo")
    search_fields = ("origin_label", "destination_label", "name", "user__email")
    date_hierarchy = "created_at"
    list_select_related = ("user",)
    inlines = (TripRouteInline,)
    fields = (
        "id",
        "user",
        "guest_id",
        "name",
        "saved",
        "shared",
        "created_at",
        "origin_label",
        "destination_label",
        "departure",
        "load_lb",
        "interval_mi",
        "hos",
        "recommendation_reason",
        "stale",
        "demo",
        "rules_version",
        "snapshot_version",
    )
    # `saved` stays read-only: only users save (a constraint), through the app.
    readonly_fields = tuple(f for f in fields if f not in ("name", "shared"))

    @admin.display(description="Owner")
    def owner(self, trip: Trip) -> str:
        return trip.user.email if trip.user else f"guest {str(trip.guest_id)[:8]}"

    def has_add_permission(self, request: HttpRequest) -> bool:
        return False


@admin.register(ProviderUsage)
class ProviderUsageAdmin(admin.ModelAdmin[ProviderUsage]):
    list_display = ("service", "month", "count", "updated_at")
    list_filter = ("service",)
    ordering = ("-month", "service")
    readonly_fields = ("service", "month", "count", "updated_at")

    def has_add_permission(self, request: HttpRequest) -> bool:
        return False

    def has_change_permission(self, request: HttpRequest, obj: ProviderUsage | None = None) -> bool:
        return False
