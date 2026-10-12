"""The reviewer's demo account: a user with four saved trips (RFC §3.2).

Idempotent: each run resets the account to the same state, password and
trips included, so the host can run it again after a reviewer has changed
or deleted things. The trips come from the fake providers whatever
PROVIDERS says, with their heatmaps, so they look the same everywhere and
say "Demo data". Their forecasts go through a private cache, so fake
weather never reaches the shared forecast cache.
"""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from django.conf import settings
from django.core.cache.backends.locmem import LocMemCache
from django.core.management.base import BaseCommand, CommandError, CommandParser
from django.db import transaction

from accounts.models import User
from planner.access import Owner
from planner.api.serializers import HeatmapSerializer, PlanSnapshotSerializer
from planner.domain.hos import Cycle, HosClocks
from planner.providers.base import Place
from planner.providers.fakes import FakeGeocoder, FakeRouting, FakeWeather, Scenario
from planner.providers.registry import Providers
from planner.repositories import route_lines, save_heatmap, save_trip
from planner.services.corridor import corridor_grid
from planner.services.forecasts import ForecastStore
from planner.services.plan import PlanRequest, plan_trip

HOUR = 3600
# A rested driver at the start of a week.
RESTED = HosClocks(Cycle.H70_8D, 11 * HOUR, 14 * HOUR, 8 * HOUR, 70 * HOUR)


@dataclass(frozen=True)
class DemoTrip:
    name: str
    origin: str
    destination: str
    load_lb: int
    interval_mi: int
    leaves_in_h: int
    scenario: Scenario = "demo"
    hos: HosClocks | None = None


TRIPS = (
    DemoTrip("Dallas to Denver, weekly", "Dallas, TX", "Denver, CO", 42_000, 25, 1),
    DemoTrip("Dallas to Denver, storm day", "Dallas, TX", "Denver, CO", 42_000, 25, 3, "strong"),
    DemoTrip("Houston to Kansas City", "Houston, TX", "Kansas City, MO", 36_000, 10, 24),
    DemoTrip(
        "Phoenix to Salt Lake City, with HOS",
        "Phoenix, AZ",
        "Salt Lake City, UT",
        28_000,
        50,
        48,
        hos=RESTED,
    ),
)


class Command(BaseCommand):
    help = "Create or reset the demo account and its four saved trips."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--email", default=settings.DEMO_EMAIL)
        parser.add_argument(
            "--password", default=settings.DEMO_PASSWORD, help="Defaults to DEMO_PASSWORD."
        )

    def handle(self, *args: Any, email: str, password: str, **options: Any) -> None:
        if not password:
            raise CommandError("Set DEMO_PASSWORD (or pass --password) for the demo account.")
        now = datetime.now(UTC).replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
        with transaction.atomic():
            user = User.objects.filter(email__iexact=email).first()
            if user is None:
                user = User.objects.create_user(email, password)
            else:
                user.set_password(password)
                user.is_active = True
                user.save(update_fields=["password", "is_active"])
            user.trips.all().delete()  # routes and heatmaps cascade
            for demo in TRIPS:
                _seed(demo, Owner(user_id=user.pk), now)
        self.stdout.write(f"Demo account {email} has {len(TRIPS)} saved trips.")


def _seed(demo: DemoTrip, owner: Owner, now: datetime) -> None:
    weather = FakeWeather(demo.scenario)
    providers = Providers(FakeRouting(), weather, FakeGeocoder(), demo=True)
    forecasts = ForecastStore(weather, LocMemCache("seed-demo", {}))
    request = PlanRequest(
        origin=_place(demo.origin),
        destination=_place(demo.destination),
        departure=now + timedelta(hours=demo.leaves_in_h - 1),
        load_lb=demo.load_lb,
        interval_mi=demo.interval_mi,
        hos=demo.hos,
    )
    plan = plan_trip(request, providers, forecasts)
    trip = save_trip(PlanSnapshotSerializer(plan).data, owner)
    trip.name, trip.saved = demo.name, True
    trip.save(update_fields=["name", "saved"])
    grid = corridor_grid(route_lines(trip), trip.load_lb, forecasts)
    save_heatmap(trip, HeatmapSerializer(grid, context={"include_metrics": True}).data)


def _place(label: str) -> Place:
    (place,) = [p for p in FakeGeocoder().suggest(label) if p.label == label]
    return place
