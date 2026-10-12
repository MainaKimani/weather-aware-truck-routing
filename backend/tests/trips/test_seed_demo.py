"""The demo account (RFC §3.2): `manage.py seed_demo` makes, or resets, one user
with four saved trips from the fake providers.

Each seed plans four trips and their heatmaps, so the checks share as few
runs as they can.
"""

from io import StringIO

import pytest
from django.core.cache import cache
from django.core.management import CommandError, call_command
from django.test import override_settings

from accounts.models import User
from planner.models import Trip, TripHeatmap
from tests.accounts.test_auth import browser, error_codes, log_in
from tests.trips.factories import make_trip, make_user

pytestmark = pytest.mark.django_db

PASSWORD = "demo-password-for-tests"


def seed(**options: str) -> str:
    out = StringIO()
    call_command("seed_demo", password=options.pop("password", PASSWORD), stdout=out, **options)
    return out.getvalue()


def test_twice_leaves_one_demo_user_with_four_saved_trips_and_nothing_else_touched() -> None:
    other = make_trip(user=make_user("other@example.com"))
    guest = make_trip()

    seed()
    output = seed()

    user = User.objects.get(email="demo@example.com")
    trips = Trip.objects.filter(user=user)
    assert sorted(t.name for t in trips) == [
        "Dallas to Denver, storm day",
        "Dallas to Denver, weekly",
        "Houston to Kansas City",
        "Phoenix to Salt Lake City, with HOS",
    ]
    assert all(t.saved and t.demo for t in trips)
    assert output.strip() == "Demo account demo@example.com has 4 saved trips."

    # Each with its heatmap, conditions included.
    heatmaps = TripHeatmap.objects.filter(trip__user=user)
    assert heatmaps.count() == 4
    assert all(h.metrics and set(h.metrics) == {"wind", "rain", "snow"} for h in heatmaps)

    # Other users' and guests' trips stay; fake forecasts never reach the shared cache
    # (tests run on the local-memory cache, whose store is a dict; checked before the
    # logins below write their own entries).
    assert set(Trip.objects.exclude(user=user)) == {other, guest}
    assert not cache._cache  # type: ignore[attr-defined]

    # The demo user logs in with the password, and only with it.
    assert log_in(browser(), "demo@example.com", PASSWORD).status_code == 200
    assert error_codes(log_in(browser(), "demo@example.com", "wrong-password-1")) == [
        "email_password_mismatch"
    ]


def test_a_rerun_puts_back_what_a_reviewer_changed() -> None:
    seed()
    user = User.objects.get()
    user.set_password("changed-by-reviewer-1")
    user.save()
    Trip.objects.filter(user=user).first().delete()  # type: ignore[union-attr]

    seed()

    assert Trip.objects.filter(user=user).count() == 4
    assert log_in(browser(), "demo@example.com", PASSWORD).status_code == 200


@override_settings(DEMO_PASSWORD="")
def test_needs_a_password() -> None:
    with pytest.raises(CommandError, match="DEMO_PASSWORD"):
        call_command("seed_demo")
    assert not User.objects.exists()


def test_takes_another_email() -> None:
    seed(email="reviewer@example.com")

    assert User.objects.get().email == "reviewer@example.com"
