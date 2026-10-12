"""Retention (RFC §3.1): `manage.py purge_trips` deletes exactly the trips past it."""

import logging
from datetime import timedelta
from io import StringIO

import pytest
from django.contrib.sessions.models import Session
from django.core.management import call_command
from django.utils import timezone

from planner.models import Trip, TripHeatmap, TripRoute
from tests.trips.factories import make_route, make_trip, make_user

pytestmark = pytest.mark.django_db


def aged(days: float, **fields: object) -> Trip:
    """A trip created `days` ago."""
    trip = make_trip(**fields)
    Trip.objects.filter(pk=trip.pk).update(created_at=timezone.now() - timedelta(days=days))
    return trip


def purge(*args: str) -> str:
    out = StringIO()
    call_command("purge_trips", *args, stdout=out)
    return out.getvalue()


def remaining() -> set[str]:
    return {str(pk) for pk in Trip.objects.values_list("pk", flat=True)}


@pytest.fixture
def trips() -> dict[str, Trip]:
    user = make_user()
    return {
        "guest_29d": aged(29),
        "guest_31d": aged(31),
        "unsaved_89d": aged(89, user=user),
        "unsaved_91d": aged(91, user=user),
        "saved_400d": aged(400, user=user, saved=True),
        "unsaved_31d": aged(31, user=user),  # a user's trip, so the guest limit doesn't apply
    }


def test_deletes_exactly_the_expired_trips(trips: dict[str, Trip]) -> None:
    output = purge()

    kept = {"guest_29d", "unsaved_89d", "saved_400d", "unsaved_31d"}
    assert remaining() == {str(trips[name].pk) for name in kept}
    assert output.strip() == "Deleted 1 guest trips and 1 unsaved user trips."


def test_routes_and_heatmaps_go_with_their_trips() -> None:
    old = aged(31)
    make_route(old)
    TripHeatmap.objects.create(
        trip=old, start_hour=timezone.now(), hours=49, cell_deg=0.25, points=[], risk=[]
    )

    purge()

    assert not TripRoute.objects.exists() and not TripHeatmap.objects.exists()


def test_a_dry_run_counts_and_deletes_nothing(trips: dict[str, Trip]) -> None:
    output = purge("--dry-run")

    assert len(remaining()) == len(trips)
    assert output.strip() == "Would delete 1 guest trips and 1 unsaved user trips."


def test_clears_expired_sessions_too() -> None:
    now = timezone.now()
    Session.objects.create(session_key="old", session_data="", expire_date=now - timedelta(days=1))
    Session.objects.create(session_key="live", session_data="", expire_date=now + timedelta(days=1))

    purge()

    assert list(Session.objects.values_list("session_key", flat=True)) == ["live"]


def test_logs_the_counts(trips: dict[str, Trip], caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.INFO, logger="planner.purge"):
        purge()

    (record,) = caplog.records
    assert record.getMessage() == "purged 1 guest and 1 unsaved trips"
    assert (record.event, record.guest_trips, record.unsaved_trips) == ("purge", 1, 1)  # type: ignore[attr-defined]
