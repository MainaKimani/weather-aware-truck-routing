"""Plans saved as trips (RFC §3.1, §7.2): what is read back is what was returned."""

import ast
import json
import uuid
from dataclasses import replace
from pathlib import Path
from typing import Any

import pytest
from django.db import IntegrityError
from django.test import Client

from accounts.models import User
from planner.access import GUEST_KEY, Owner
from planner.api import views
from planner.api.serializers import PlanSnapshotSerializer
from planner.domain.hos import Cycle, HosClocks
from planner.models import Trip, TripRoute
from planner.providers.base import RoutingUnavailable
from planner.repositories import load_snapshot, save_trip, trip_for_key
from tests.api.test_plans import HOS, Raises, body, failing, post
from tests.test_plan_service import REQUEST, SlowWeather, run

pytestmark = pytest.mark.django_db

GUEST = Owner(guest_id=uuid.uuid4())


def snapshot_of(**request_changes: Any) -> dict[str, Any]:
    """The plan response for the demo trip, as the API serializes it before saving."""
    weather = SlowWeather(scenario="strong") if request_changes.pop("strong", False) else None
    plan = run(replace(REQUEST, **request_changes), weather=weather)
    data: dict[str, Any] = json.loads(json.dumps(PlanSnapshotSerializer(plan).data))
    return data


class TestRoundTrip:
    def test_the_demo_plan_reads_back_identical(self) -> None:
        snapshot = snapshot_of()

        trip = save_trip(snapshot, GUEST)

        assert load_snapshot(Trip.objects.get(pk=trip.pk)) == {
            **snapshot,
            "trip_id": str(trip.pk),
        }

    def test_hos_stops_and_an_undrivable_route_read_back_identical(self) -> None:
        clocks = HosClocks(Cycle.H70_8D, 11 * 3600, 14 * 3600, 8 * 3600, 60 * 3600)
        snapshot = snapshot_of(hos=clocks, strong=True)
        assert any(r["hos_stops"] for r in snapshot["routes"])
        assert not all(r["metrics"]["drivable"] for r in snapshot["routes"])

        trip = save_trip(snapshot, GUEST)

        assert load_snapshot(Trip.objects.get(pk=trip.pk)) == {
            **snapshot,
            "trip_id": str(trip.pk),
        }

    def test_columns_hold_what_lists_and_filters_use(self) -> None:
        snapshot = snapshot_of()

        trip = save_trip(snapshot, GUEST, idempotency_key=uuid.UUID(int=7))

        assert trip.guest_id == GUEST.guest_id
        assert trip.user is None
        assert trip.idempotency_key == uuid.UUID(int=7)
        assert trip.snapshot_version == 1
        assert trip.origin_label == "Dallas, TX"
        recommended = trip.routes.get(recommended=True)
        assert recommended.key == snapshot["recommended_route_id"]
        assert [r.rank for r in trip.routes.all()] == [1, 2, 3]
        assert recommended.severe_mi == recommended_metrics(snapshot)["SEVERE"]

    def test_an_unknown_snapshot_version_is_refused_not_misread(self) -> None:
        trip = save_trip(snapshot_of(), GUEST)
        Trip.objects.filter(pk=trip.pk).update(snapshot_version=2)

        with pytest.raises(ValueError, match="snapshot version 2"):
            load_snapshot(Trip.objects.get(pk=trip.pk))


def recommended_metrics(snapshot: dict[str, Any]) -> dict[str, float]:
    route = next(r for r in snapshot["routes"] if r["id"] == snapshot["recommended_route_id"])
    miles: dict[str, float] = route["metrics"]["miles_by_level"]
    return miles


def test_a_failure_while_saving_routes_leaves_no_trip(monkeypatch: pytest.MonkeyPatch) -> None:
    def fail(*args: object, **kwargs: object) -> None:
        raise IntegrityError("simulated")

    monkeypatch.setattr(TripRoute.objects, "bulk_create", fail)

    with pytest.raises(IntegrityError):
        save_trip(snapshot_of(), GUEST)

    assert not Trip.objects.exists()


def plan_with_key(client: Client, key: str, **extra: Any) -> Any:
    return client.post(
        "/api/v1/plans",
        body(),
        content_type="application/json",
        headers={"Idempotency-Key": key},
        **extra,
    )


class TestPlanEndpoint:
    def test_a_guests_first_plan_makes_them_a_guest_and_saves_the_trip(
        self, client: Client
    ) -> None:
        response = post(client, body())

        assert response.status_code == 200
        trip = Trip.objects.get()
        assert response.json()["trip_id"] == str(trip.pk)
        assert str(trip.guest_id) == client.session[GUEST_KEY]
        assert trip.user is None
        assert response.json() == load_snapshot(trip)

    def test_a_guests_later_plans_are_filed_under_the_same_guest(self, client: Client) -> None:
        post(client, body())
        post(client, body(hos=HOS))

        assert Trip.objects.values("guest_id").distinct().count() == 1
        assert Trip.objects.count() == 2

    def test_a_signed_in_users_plan_is_theirs(self, client: Client) -> None:
        user = User.objects.create_user("driver@example.com", password="pw-1234-long")
        client.force_login(user)

        post(client, body())

        trip = Trip.objects.get()
        assert trip.user == user
        assert trip.guest_id is None
        assert GUEST_KEY not in client.session

    def test_an_invalid_request_saves_nothing_and_makes_no_guest(self, client: Client) -> None:
        response = post(client, body(load_lb=0))

        assert response.status_code == 400
        assert not Trip.objects.exists()
        assert GUEST_KEY not in client.session

    def test_a_provider_failure_saves_nothing(
        self, client: Client, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        down = Raises(RoutingUnavailable("HERE: HTTP 503"))
        monkeypatch.setattr(views, "get_providers", failing(routing=lambda: down))

        assert post(client, body()).status_code == 502
        assert not Trip.objects.exists()


class TestIdempotency:
    def test_the_same_key_gives_one_trip_and_the_same_response(self, client: Client) -> None:
        key = str(uuid.uuid4())

        first = plan_with_key(client, key)
        second = plan_with_key(client, key)

        assert first.status_code == second.status_code == 200
        assert second.json() == first.json()
        assert Trip.objects.count() == 1

    def test_a_repeat_does_not_plan_again(
        self, client: Client, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        key = str(uuid.uuid4())
        plan_with_key(client, key)

        def no_planning(*args: object, **kwargs: object) -> None:
            raise AssertionError("planned again")

        monkeypatch.setattr(views, "plan_trip", no_planning)
        assert plan_with_key(client, key).status_code == 200

    def test_different_keys_give_different_trips(self, client: Client) -> None:
        plan_with_key(client, str(uuid.uuid4()))
        plan_with_key(client, str(uuid.uuid4()))

        assert Trip.objects.count() == 2

    def test_another_callers_key_is_a_conflict_not_their_trip(self, client: Client) -> None:
        key = str(uuid.uuid4())
        plan_with_key(client, key)

        stranger = Client()
        response = plan_with_key(stranger, key)

        assert response.status_code == 409
        assert response.json()["error"]["code"] == "idempotency_conflict"
        assert "trip_id" not in response.json()

    def test_a_key_must_be_a_uuid(self, client: Client) -> None:
        response = plan_with_key(client, "retry-1")

        assert response.status_code == 400
        assert response.json()["error"]["fields"] == {"Idempotency-Key": ["Must be a UUID."]}

    def test_two_requests_racing_with_one_key_give_one_trip(
        self, client: Client, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        key = str(uuid.uuid4())
        first = plan_with_key(client, key)
        # The second request checked for the key before the first had saved: its first
        # lookup finds nothing, so it plans, and saving hits the unique key.
        lookups: list[uuid.UUID] = []

        def racing_lookup(k: uuid.UUID) -> Trip | None:
            lookups.append(k)
            return None if len(lookups) == 1 else trip_for_key(k)

        monkeypatch.setattr(views, "trip_for_key", racing_lookup)

        second = plan_with_key(client, key)

        assert second.status_code == 200
        assert second.json()["trip_id"] == first.json()["trip_id"]
        assert Trip.objects.count() == 1
        assert len(lookups) == 2  # missed, then found after the failed save


def test_a_save_failure_that_is_not_a_key_race_is_not_hidden(
    client: Client, monkeypatch: pytest.MonkeyPatch
) -> None:
    def fail(*args: object, **kwargs: object) -> None:
        raise IntegrityError("not about the key")

    monkeypatch.setattr(views, "save_trip", fail)

    with pytest.raises(IntegrityError, match="not about the key"):
        post(client, body())


def test_a_snapshot_with_an_unreadable_time_is_refused() -> None:
    snapshot = snapshot_of()
    snapshot["generated_at"] = "yesterday"

    with pytest.raises(ValueError, match="not a date-time"):
        save_trip(snapshot, GUEST)
    assert not Trip.objects.exists()


def test_the_domain_package_imports_nothing_from_django() -> None:
    """Domain rules stay pure Python (RFC §4), so persistence can't leak into them."""
    domain = Path(__file__).resolve().parents[2] / "planner" / "domain"
    allowed_first_party = ("planner.domain",)
    offenders = []
    for path in domain.glob("*.py"):
        for node in ast.walk(ast.parse(path.read_text())):
            names = (
                [a.name for a in node.names]
                if isinstance(node, ast.Import)
                else [node.module or ""]
                if isinstance(node, ast.ImportFrom)
                else []
            )
            for name in names:
                top = name.split(".")[0]
                if top in ("django", "rest_framework") or (
                    top == "planner" and not name.startswith(allowed_first_party)
                ):
                    offenders.append(f"{path.name}: {name}")
    assert offenders == []
