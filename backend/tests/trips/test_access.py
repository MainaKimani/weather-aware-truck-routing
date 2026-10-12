"""Who sees and changes which trip (RFC §3.2): the full matrix of callers
(owner, another user, another guest, an anonymous visitor) against private and
shared trips, for trips owned by a user and by a guest."""

import re
import uuid
from pathlib import Path

import pytest
from django.contrib.auth.models import AnonymousUser
from django.contrib.sessions.backends.cached_db import SessionStore
from django.http import Http404, HttpRequest
from django.test import RequestFactory

from planner.access import (
    GUEST_KEY,
    Owner,
    current_owner,
    get_owned_trip,
    get_visible_trip,
)
from planner.models import Trip
from tests.trips.factories import make_trip, make_user

pytestmark = pytest.mark.django_db

CALLERS = ("owner", "other user", "other guest", "anonymous")


def caller(kind: str, trip: Trip) -> Owner | None:
    if kind == "owner":
        return Owner(user_id=trip.user_id) if trip.user_id else Owner(guest_id=trip.guest_id)
    if kind == "other user":
        return Owner(user_id=make_user(f"{uuid.uuid4().hex[:8]}@example.com").pk)
    if kind == "other guest":
        return Owner(guest_id=uuid.uuid4())
    return None


@pytest.fixture(params=["user", "guest"])
def owned_by(request: pytest.FixtureRequest) -> str:
    return str(request.param)


def trip_for(owned_by: str, *, shared: bool) -> Trip:
    if owned_by == "user":
        return make_trip(user=make_user(), shared=shared)
    return make_trip(shared=shared)


@pytest.mark.parametrize("who", CALLERS)
class TestAccessMatrix:
    def test_private_trip_is_visible_only_to_its_owner(self, owned_by: str, who: str) -> None:
        trip = trip_for(owned_by, shared=False)

        if who == "owner":
            assert get_visible_trip(trip.pk, caller(who, trip)) == trip
        else:
            with pytest.raises(Http404):
                get_visible_trip(trip.pk, caller(who, trip))

    def test_shared_trip_is_visible_to_anyone(self, owned_by: str, who: str) -> None:
        trip = trip_for(owned_by, shared=True)

        assert get_visible_trip(trip.pk, caller(who, trip)) == trip

    @pytest.mark.parametrize("shared", [False, True])
    def test_only_the_owner_may_change_a_trip_shared_or_not(
        self, owned_by: str, who: str, shared: bool
    ) -> None:
        trip = trip_for(owned_by, shared=shared)

        if who == "owner":
            assert get_owned_trip(trip.pk, caller(who, trip)) == trip
        else:
            with pytest.raises(Http404):
                get_owned_trip(trip.pk, caller(who, trip))


class TestUnknownTrips:
    @pytest.mark.parametrize("trip_id", [uuid.uuid4(), "not-a-uuid", ""])
    def test_missing_or_malformed_ids_are_404(self, trip_id: object) -> None:
        owner = Owner(guest_id=uuid.uuid4())
        with pytest.raises(Http404):
            get_visible_trip(trip_id, owner)  # type: ignore[arg-type]
        with pytest.raises(Http404):
            get_owned_trip(trip_id, owner)  # type: ignore[arg-type]

    def test_a_guest_id_does_not_reach_a_trip_moved_to_an_account(self) -> None:
        # A claimed trip keeps no guest id; this guards the query if one were left behind.
        guest = uuid.uuid4()
        trip = make_trip(user=make_user())
        Trip.objects.filter(pk=trip.pk).update(guest_id=None)

        with pytest.raises(Http404):
            get_visible_trip(trip.pk, Owner(guest_id=guest))


class TestOwner:
    def test_is_a_user_or_a_guest(self) -> None:
        with pytest.raises(ValueError, match="not both or neither"):
            Owner()
        with pytest.raises(ValueError, match="not both or neither"):
            Owner(user_id=1, guest_id=uuid.uuid4())

    def test_records_itself_on_a_trip(self) -> None:
        guest = uuid.uuid4()
        assert Owner(guest_id=guest).as_fields() == {"user_id": None, "guest_id": guest}
        assert Owner(user_id=7).as_fields() == {"user_id": 7, "guest_id": None}


def request_with_session(session_data: dict[str, str] | None = None) -> HttpRequest:
    request = RequestFactory().post("/api/v1/plans")
    request.user = AnonymousUser()
    request.session = SessionStore()
    for key, value in (session_data or {}).items():
        request.session[key] = value
    return request


class TestCurrentOwner:
    def test_signed_in_user(self) -> None:
        user = make_user()
        request = request_with_session({GUEST_KEY: str(uuid.uuid4())})
        request.user = user

        assert current_owner(request) == Owner(user_id=user.pk)

    def test_guest_from_the_session(self) -> None:
        guest = uuid.uuid4()

        assert current_owner(request_with_session({GUEST_KEY: str(guest)})) == Owner(guest_id=guest)

    def test_a_first_visit_owns_nothing_until_it_plans(self) -> None:
        request = request_with_session()

        assert current_owner(request) is None
        assert GUEST_KEY not in request.session

    def test_the_first_plan_makes_a_guest_and_keeps_it_in_the_session(self) -> None:
        request = request_with_session()

        owner = current_owner(request, create=True)

        assert owner is not None
        assert owner.is_guest
        assert request.session[GUEST_KEY] == str(owner.guest_id)
        assert current_owner(request, create=True) == owner

    def test_a_garbled_session_value_is_replaced(self) -> None:
        request = request_with_session({GUEST_KEY: "garbage"})

        assert current_owner(request) is None
        owner = current_owner(request, create=True)
        assert owner is not None
        assert request.session[GUEST_KEY] == str(owner.guest_id)


def test_no_view_queries_trips_directly() -> None:
    """Views go through planner/access.py, so no endpoint can forget the owner check."""
    api = Path(__file__).resolve().parents[2] / "planner" / "api"
    offenders = [
        f"{path.name}:{n}"
        for path in api.glob("*.py")
        for n, line in enumerate(path.read_text().splitlines(), start=1)
        if re.search(r"\b(Trip|TripRoute|TripHeatmap)\.objects\b", line)
    ]
    assert offenders == []
