"""Reading trips back (RFC §7.4): the caller's list, and one trip by id."""

import uuid
from typing import Any

import pytest
from django.db import connection
from django.test import Client
from django.test.utils import CaptureQueriesContext
from pytest_django import DjangoAssertNumQueries

from planner.access import GUEST_KEY
from planner.models import Trip
from tests.api.test_plans import body, post
from tests.trips.factories import make_route, make_trip, make_user

pytestmark = pytest.mark.django_db

TRIPS = "/api/v1/trips"


def as_guest(client: Client, guest_id: uuid.UUID | None = None) -> uuid.UUID:
    guest_id = guest_id or uuid.uuid4()
    session = client.session
    session[GUEST_KEY] = str(guest_id)
    session.save()
    return guest_id


def ids(response: Any) -> list[str]:
    return [row["id"] for row in response.json()["results"]]


class TestList:
    def test_lists_only_the_callers_trips_newest_first(self, client: Client) -> None:
        me, other = make_user("me@example.com"), make_user("other@example.com")
        mine = [make_trip(user=me) for _ in range(3)]
        make_trip(user=other, shared=True)
        make_trip(shared=True)  # a guest's
        client.force_login(me)

        response = client.get(TRIPS)

        assert response.status_code == 200
        assert ids(response) == [str(t.pk) for t in reversed(mine)]

    def test_a_summary_has_what_a_list_shows(self, client: Client) -> None:
        me = make_user()
        trip = make_trip(user=me, name="Weekly run", saved=True)
        make_route(trip, recommended=True, label="Fastest", worst_level="HIGH")
        make_route(trip, key="r2", rank=2, name="Route B", worst_level="SEVERE")
        client.force_login(me)

        (row,) = client.get(TRIPS).json()["results"]

        assert row == {
            "id": str(trip.pk),
            "created_at": trip.created_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "name": "Weekly run",
            "saved": True,
            "shared": False,
            "origin": "Dallas, TX",
            "destination": "Denver, CO",
            "departure": "2026-10-12T12:00:00Z",
            "load_lb": 42_000,
            "interval_mi": 25,
            "demo": False,
            "stale": False,
            "recommended": {
                "id": "r1",
                "name": "Route A",
                "label": "Fastest",
                "worst": "HIGH",
                "drivable": True,
            },
        }

    def test_no_recommendation_when_no_route_is_drivable(self, client: Client) -> None:
        me = make_user()
        make_route(make_trip(user=me), drivable=False, worst_level="NO_TRAVEL")
        client.force_login(me)

        assert client.get(TRIPS).json()["results"][0]["recommended"] is None

    def test_filters_by_saved_and_by_text(self, client: Client) -> None:
        me = make_user()
        saved = make_trip(user=me, saved=True, name="Denver weekly")
        chicago = make_trip(user=me, destination_label="Chicago, IL")
        client.force_login(me)

        assert ids(client.get(TRIPS, {"saved": "true"})) == [str(saved.pk)]
        assert ids(client.get(TRIPS, {"saved": "false"})) == [str(chicago.pk)]
        assert ids(client.get(TRIPS, {"q": "chicago"})) == [str(chicago.pk)]
        assert ids(client.get(TRIPS, {"q": "WEEKLY"})) == [str(saved.pk)]
        assert ids(client.get(TRIPS, {"q": "dallas"})) == [str(chicago.pk), str(saved.pk)]

    @pytest.mark.parametrize("query", [{"saved": "perhaps"}, {"q": "x" * 101}])
    def test_rejects_bad_filters(self, client: Client, query: dict[str, str]) -> None:
        response = client.get(TRIPS, query)

        assert response.status_code == 400
        assert response.json()["error"]["code"] == "invalid_input"

    def test_a_user_pages_through_every_trip_once(self, client: Client) -> None:
        me = make_user()
        trips = [make_trip(user=me) for _ in range(45)]
        client.force_login(me)

        seen: list[str] = []
        url: str | None = TRIPS
        pages = 0
        while url:
            page = client.get(url).json()
            seen += [row["id"] for row in page["results"]]
            if pages == 0:
                make_trip(user=me)  # a new trip arriving mid-way neither repeats nor skips one
            url, pages = page["next"], pages + 1

        assert pages == 3
        assert seen == [str(t.pk) for t in reversed(trips)]

    def test_a_guest_sees_their_latest_twenty_and_no_more_pages(self, client: Client) -> None:
        guest = as_guest(client)
        trips = [make_trip(guest_id=guest) for _ in range(23)]
        make_trip()  # another guest's

        page = client.get(TRIPS).json()

        assert [row["id"] for row in page["results"]] == [str(t.pk) for t in reversed(trips)][:20]
        assert page["next"] is None

    def test_a_visitor_who_never_planned_has_no_trips(self, client: Client) -> None:
        make_trip(shared=True)

        assert client.get(TRIPS).json() == {"next": None, "previous": None, "results": []}

    def test_twenty_trips_in_two_queries_without_the_heavy_columns(
        self, client: Client, django_assert_num_queries: DjangoAssertNumQueries
    ) -> None:
        guest = as_guest(client)
        for _ in range(20):
            trip = make_trip(guest_id=guest)
            for rank in (1, 2, 3):
                make_route(
                    trip,
                    key=f"r{rank}",
                    rank=rank,
                    recommended=rank == 1,
                    checkpoints=[{"mile": m} for m in range(100)],
                )

        with CaptureQueriesContext(connection) as queries, django_assert_num_queries(2):
            response = client.get(TRIPS)

        assert len(response.json()["results"]) == 20
        sql = " ".join(q["sql"] for q in queries.captured_queries)
        assert '"checkpoints"' not in sql and '"geometry"' not in sql and '"hos_stops"' not in sql


class TestDetail:
    @pytest.fixture
    def planned(self, client: Client) -> dict[str, Any]:
        """The demo trip, planned through the API as a guest; its response."""
        plan: dict[str, Any] = post(client, body()).json()
        return plan

    def test_the_owner_gets_the_plan_as_it_was_returned(
        self, client: Client, planned: dict[str, Any]
    ) -> None:
        trip = client.get(f"{TRIPS}/{planned['trip_id']}").json()

        meta = {k: trip.pop(k) for k in ("name", "saved", "shared", "is_owner", "replanned_from")}
        created_at = trip.pop("created_at")
        assert trip == planned
        assert meta == {
            "name": "",
            "saved": False,
            "shared": False,
            "is_owner": True,
            "replanned_from": None,
        }
        assert created_at.endswith("Z")

    def test_another_guest_gets_404(self, planned: dict[str, Any]) -> None:
        stranger = Client()
        as_guest(stranger)

        response = stranger.get(f"{TRIPS}/{planned['trip_id']}")

        assert response.status_code == 404
        assert response.json()["error"]["code"] == "not_found"

    def test_anyone_can_read_a_shared_trip_without_owning_it(self, planned: dict[str, Any]) -> None:
        Trip.objects.filter(pk=planned["trip_id"]).update(shared=True)

        trip = Client().get(f"{TRIPS}/{planned['trip_id']}").json()

        assert trip["trip_id"] == planned["trip_id"]
        assert trip["is_owner"] is False

    @pytest.mark.parametrize("trip_id", ["not-a-uuid", uuid.UUID(int=0)])
    def test_unknown_or_malformed_ids_are_json_404s(self, client: Client, trip_id: object) -> None:
        response = client.get(f"{TRIPS}/{trip_id}")

        assert response.status_code == 404
        assert response.json()["error"]["code"] == "not_found"

    def test_names_the_trip_it_was_replanned_from(self, client: Client) -> None:
        me = make_user()
        first = make_trip(user=me)
        second = make_trip(user=me, replanned_from=first)
        make_route(second, recommended=True)
        client.force_login(me)

        # A minimal trip has no checkpoints, but its meta is what's checked here.
        assert client.get(f"{TRIPS}/{second.pk}").json()["replanned_from"] == str(first.pk)
