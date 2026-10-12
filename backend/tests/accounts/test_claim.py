"""A guest who signs up or logs in keeps the trips planned on this device (RFC §3.2)."""

import uuid

import pytest
from django.test import Client, RequestFactory

from accounts.models import User
from planner.access import GUEST_KEY, claim_guest_trips
from planner.models import Trip
from planner.signals import keep_guest_trips
from tests.accounts.test_auth import AUTH, browser, log_in, send, sign_up
from tests.api.test_plans import body
from tests.trips.factories import make_trip, make_user

pytestmark = pytest.mark.django_db


def plan(client: Client, times: int = 1) -> list[str]:
    return [send(client, "post", "/api/v1/plans", body()).json()["trip_id"] for _ in range(times)]


def test_signing_up_keeps_the_guests_trips() -> None:
    client = browser()
    planned = plan(client, 3)
    someone_else = make_trip()

    sign_up(client)

    user = User.objects.get()
    claimed = Trip.objects.filter(user=user).values_list("pk", flat=True)
    assert sorted(str(pk) for pk in claimed) == sorted(planned)
    assert list(Trip.objects.filter(guest_id__isnull=False)) == [someone_else]
    assert client.get("/api/v1/me").json() == {
        "user": {"email": "driver@example.com"},
        "guest": False,
        "recent_trip_count": 3,
    }


def test_logging_in_to_an_existing_account_keeps_them_too() -> None:
    user = make_user("driver@example.com")
    make_trip(user=user)
    client = browser()
    planned = plan(client, 2)

    log_in(client, "driver@example.com", "pw-1234-long")

    assert Trip.objects.filter(user=user).count() == 3
    assert set(planned) <= {str(pk) for pk in Trip.objects.values_list("pk", flat=True)}
    assert not Trip.objects.filter(guest_id__isnull=False).exists()


def test_after_logging_out_a_new_guest_starts_whose_trips_the_account_cannot_see() -> None:
    client = browser()
    sign_up(client)
    plan(client)
    send(client, "delete", f"{AUTH}/session")

    (guest_trip,) = plan(client)

    assert Trip.objects.get(pk=guest_trip).user is None
    assert client.get("/api/v1/me").json()["recent_trip_count"] == 1  # the guest's one
    log_in(client, "driver@example.com")
    # Logging back in claims that guest's trip as well: same device, same person.
    assert Trip.objects.filter(user__email="driver@example.com").count() == 2


def test_another_accounts_trips_are_never_claimed() -> None:
    other = make_user("other@example.com")
    theirs = make_trip(user=other)
    request = RequestFactory().get("/")
    request.session = Client().session
    request.session[GUEST_KEY] = str(uuid.uuid4())

    assert claim_guest_trips(request, make_user("me@example.com")) == 0
    assert Trip.objects.get(pk=theirs.pk).user == other


@pytest.mark.parametrize("stored", [None, "not-a-uuid"])
def test_nothing_to_claim_without_a_guest(stored: str | None) -> None:
    trip = make_trip()
    request = RequestFactory().get("/")
    request.session = Client().session
    if stored:
        request.session[GUEST_KEY] = stored

    assert claim_guest_trips(request, make_user()) == 0
    assert Trip.objects.get(pk=trip.pk).user is None
    assert GUEST_KEY not in request.session


def test_a_login_without_a_request_claims_nothing() -> None:
    # Logins outside a request (a script, a test client's force_login) have no session.
    trip = make_trip()

    keep_guest_trips(sender=None, request=None, user=make_user())

    assert Trip.objects.get(pk=trip.pk).user is None
