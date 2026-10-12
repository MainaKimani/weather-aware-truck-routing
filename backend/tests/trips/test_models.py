"""Every trip and route constraint is enforced by Postgres, not just by the code
that writes trips: one IntegrityError test each."""

import uuid
from contextlib import AbstractContextManager
from datetime import timedelta

import pytest
from django.db import IntegrityError, transaction

from planner.models import Trip
from tests.trips.factories import DEPARTURE, make_route, make_trip, make_user

pytestmark = pytest.mark.django_db


def violates(name: str) -> AbstractContextManager[pytest.ExceptionInfo[IntegrityError]]:
    """Expect the write inside the block to break the named constraint."""
    return pytest.raises(IntegrityError, match=name)


class TestTripConstraints:
    def test_a_guest_trip_and_a_user_trip_are_valid(self) -> None:
        make_trip()
        make_trip(user=make_user())

        assert Trip.objects.count() == 2

    def test_needs_an_owner(self) -> None:
        with violates("trip_has_exactly_one_owner"), transaction.atomic():
            make_trip(guest_id=None)

    def test_cannot_have_two_owners(self) -> None:
        with violates("trip_has_exactly_one_owner"), transaction.atomic():
            make_trip(user=make_user(), guest_id=uuid.uuid4())

    def test_guests_cannot_save(self) -> None:
        with violates("trip_only_users_save"), transaction.atomic():
            make_trip(saved=True)

    def test_users_can_save(self) -> None:
        assert make_trip(user=make_user(), saved=True).saved

    @pytest.mark.parametrize("load_lb", [0, 80_001])
    def test_load_in_range(self, load_lb: int) -> None:
        with violates("trip_load_in_range"), transaction.atomic():
            make_trip(load_lb=load_lb)

    def test_interval_is_10_25_or_50(self) -> None:
        with violates("trip_valid_interval"), transaction.atomic():
            make_trip(interval_mi=20)

    def test_idempotency_key_is_unique(self) -> None:
        key = uuid.uuid4()
        make_trip(idempotency_key=key)

        with pytest.raises(IntegrityError), transaction.atomic():
            make_trip(idempotency_key=key)


class TestRouteConstraints:
    def test_duplicate_rank(self) -> None:
        trip = make_trip()
        make_route(trip)

        with violates("route_unique_rank"), transaction.atomic():
            make_route(trip, key="r2")

    def test_duplicate_key(self) -> None:
        trip = make_trip()
        make_route(trip)

        with violates("route_unique_key"), transaction.atomic():
            make_route(trip, rank=2)

    def test_two_recommended_routes(self) -> None:
        trip = make_trip()
        make_route(trip, recommended=True)

        with violates("route_one_recommended_per_trip"), transaction.atomic():
            make_route(trip, key="r2", rank=2, recommended=True)

    def test_rank_1_to_3(self) -> None:
        with violates("route_rank_1_to_3"), transaction.atomic():
            make_route(make_trip(), rank=4)

    def test_recommended_but_not_drivable(self) -> None:
        with violates("route_recommended_is_drivable"), transaction.atomic():
            make_route(make_trip(), recommended=True, drivable=False)

    def test_avg_risk_out_of_range(self) -> None:
        with violates("route_avg_risk_range"), transaction.atomic():
            make_route(make_trip(), avg_risk=4.5)

    def test_arrival_before_departure(self) -> None:
        with violates("route_arrival_after_departure"), transaction.atomic():
            make_route(make_trip(), arrival=DEPARTURE - timedelta(minutes=1))

    def test_deleting_a_trip_deletes_its_routes(self) -> None:
        trip = make_trip()
        make_route(trip)

        trip.delete()

        assert not Trip.objects.exists()
