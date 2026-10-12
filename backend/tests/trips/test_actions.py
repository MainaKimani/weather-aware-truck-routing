"""What the owner can do with a trip, and re-planning (RFC §7.4)."""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from django.test import Client
from django.utils import timezone

from planner.models import Trip, TripHeatmap, TripRoute
from tests.api.test_plans import HOS, body, post
from tests.trips.factories import make_user
from tests.trips.test_read import as_guest

pytestmark = pytest.mark.django_db

TRIPS = "/api/v1/trips"


def patch(client: Client, trip_id: object, data: dict[str, Any]) -> Any:
    return client.patch(f"{TRIPS}/{trip_id}", data, content_type="application/json")


def replan(client: Client, trip_id: object, key: uuid.UUID | None = None) -> Any:
    headers = {"Idempotency-Key": str(key)} if key else {}
    return client.post(f"{TRIPS}/{trip_id}/replan", headers=headers)


@pytest.fixture
def guest() -> Client:
    return Client()


@pytest.fixture
def guest_trip(guest: Client) -> str:
    """A trip planned by `guest`; its id."""
    trip_id: str = post(guest, body()).json()["trip_id"]
    return trip_id


@pytest.fixture
def user() -> Client:
    client = Client()
    client.force_login(make_user("owner@example.com"))
    return client


@pytest.fixture
def user_trip(user: Client) -> str:
    trip_id: str = post(user, body()).json()["trip_id"]
    return trip_id


def strangers() -> list[Client]:
    """Another user, another guest, and a visitor with neither."""
    other_user = Client()
    other_user.force_login(make_user("other@example.com"))
    other_guest = Client()
    as_guest(other_guest)
    return [other_user, other_guest, Client()]


class TestUpdate:
    def test_the_owner_renames_saves_and_shares(self, user: Client, user_trip: str) -> None:
        response = patch(user, user_trip, {"name": "  Weekly run  ", "saved": True, "shared": True})

        assert response.status_code == 200
        assert {k: response.json()[k] for k in ("name", "saved", "shared")} == {
            "name": "Weekly run",
            "saved": True,
            "shared": True,
        }
        trip = Trip.objects.get(pk=user_trip)
        assert (trip.name, trip.saved, trip.shared) == ("Weekly run", True, True)

    def test_only_the_fields_sent_change(self, user: Client, user_trip: str) -> None:
        patch(user, user_trip, {"name": "Kept", "saved": True})

        patch(user, user_trip, {"shared": True})

        trip = Trip.objects.get(pk=user_trip)
        assert (trip.name, trip.saved, trip.shared) == ("Kept", True, True)

    def test_a_guest_can_share_and_rename_but_not_save(
        self, guest: Client, guest_trip: str
    ) -> None:
        assert patch(guest, guest_trip, {"name": "Mine", "shared": True}).status_code == 200

        response = patch(guest, guest_trip, {"saved": True, "name": "Changed"})

        assert response.status_code == 403
        assert response.json()["error"]["code"] == "account_required"
        trip = Trip.objects.get(pk=guest_trip)
        assert (trip.name, trip.saved, trip.shared) == ("Mine", False, True)

    @pytest.mark.parametrize(
        "data", [{"name": "x" * 121}, {"saved": "sometimes"}, {"shared": None}]
    )
    def test_bad_values_are_400s(self, user: Client, user_trip: str, data: Any) -> None:
        response = patch(user, user_trip, data)

        assert response.status_code == 400
        assert response.json()["error"]["code"] == "invalid_input"

    def test_nobody_else_can_change_it_even_when_shared(self, user: Client, user_trip: str) -> None:
        patch(user, user_trip, {"shared": True})

        for stranger in strangers():
            response = patch(stranger, user_trip, {"name": "Mine now"})
            assert response.status_code == 404
            assert response.json()["error"]["code"] == "not_found"
        assert Trip.objects.get(pk=user_trip).name == ""

    def test_turning_sharing_off_closes_the_link_at_once(
        self, user: Client, user_trip: str
    ) -> None:
        reader = Client()
        patch(user, user_trip, {"shared": True})
        assert reader.get(f"{TRIPS}/{user_trip}").status_code == 200

        patch(user, user_trip, {"shared": False})

        assert reader.get(f"{TRIPS}/{user_trip}").status_code == 404
        assert reader.get(f"{TRIPS}/{user_trip}/heatmap").status_code == 404


class TestDelete:
    def test_the_owner_deletes_the_trip_its_routes_and_heatmap(
        self, guest: Client, guest_trip: str
    ) -> None:
        guest.get(f"{TRIPS}/{guest_trip}/heatmap")
        assert TripHeatmap.objects.filter(trip_id=guest_trip).exists()

        response = guest.delete(f"{TRIPS}/{guest_trip}")

        assert response.status_code == 204
        assert not Trip.objects.filter(pk=guest_trip).exists()
        assert not TripRoute.objects.filter(trip_id=guest_trip).exists()
        assert not TripHeatmap.objects.filter(trip_id=guest_trip).exists()
        assert guest.get(f"{TRIPS}/{guest_trip}").status_code == 404

    def test_nobody_else_can_delete_it_even_when_shared(
        self, guest: Client, guest_trip: str
    ) -> None:
        patch(guest, guest_trip, {"shared": True})

        for stranger in strangers():
            assert stranger.delete(f"{TRIPS}/{guest_trip}").status_code == 404
        assert Trip.objects.filter(pk=guest_trip).exists()

    @pytest.mark.parametrize("trip_id", ["not-a-uuid", uuid.UUID(int=0)])
    def test_unknown_or_malformed_ids_are_json_404s(self, user: Client, trip_id: object) -> None:
        response = user.delete(f"{TRIPS}/{trip_id}")

        assert response.status_code == 404
        assert response.json()["error"]["code"] == "not_found"


class TestReplan:
    def test_makes_a_new_trip_from_the_same_inputs(self, user: Client) -> None:
        original = post(user, body(load_lb=31_000, interval_mi=50, hos=HOS)).json()

        response = replan(user, original["trip_id"])

        assert response.status_code == 200
        new = response.json()
        assert new["trip_id"] != original["trip_id"]
        assert new["replanned_from"] == original["trip_id"]
        assert new["is_owner"] is True
        assert new["inputs"] == original["inputs"]
        assert (
            Trip.objects.get(pk=new["trip_id"]).user
            == Trip.objects.get(pk=original["trip_id"]).user
        )

    def test_a_past_departure_moves_to_now(self, user: Client, user_trip: str) -> None:
        Trip.objects.filter(pk=user_trip).update(departure=timezone.now() - timedelta(days=2))
        before = timezone.now().replace(microsecond=0)

        new = replan(user, user_trip).json()

        departure = datetime.fromisoformat(new["inputs"]["departure"].replace("Z", "+00:00"))
        assert before <= departure <= timezone.now()
        assert departure.tzinfo == UTC

    def test_anyone_can_replan_a_shared_trip_into_their_own(
        self, guest: Client, guest_trip: str
    ) -> None:
        patch(guest, guest_trip, {"shared": True})
        reader = Client()

        new = replan(reader, guest_trip).json()

        trip = Trip.objects.get(pk=new["trip_id"])
        source = Trip.objects.get(pk=guest_trip)
        assert trip.guest_id is not None and trip.guest_id != source.guest_id
        assert new["is_owner"] is True
        assert reader.get(f"{TRIPS}/{new['trip_id']}").json()["is_owner"] is True

    def test_a_trip_you_cannot_see_is_404_and_nothing_is_planned(self, guest_trip: str) -> None:
        for stranger in strangers():
            assert replan(stranger, guest_trip).status_code == 404
        assert Trip.objects.count() == 1

    def test_the_same_idempotency_key_returns_the_same_new_trip(
        self, user: Client, user_trip: str
    ) -> None:
        key = uuid.uuid4()

        first = replan(user, user_trip, key).json()
        second = replan(user, user_trip, key).json()

        assert first["trip_id"] == second["trip_id"]
        assert Trip.objects.count() == 2
