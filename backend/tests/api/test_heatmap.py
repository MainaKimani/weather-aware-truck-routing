"""GET /api/v1/trips/{id}/heatmap (RFC §7.3): computed from the saved trip on
the first request, kept, and shown to whoever can see the trip."""

import gzip
import json
import uuid
from typing import Any

import pytest
from django.test import Client

from planner.api import views
from planner.models import Trip, TripHeatmap
from planner.repositories import save_heatmap
from planner.services.corridor import corridor_grid
from tests.api.test_plans import body, post

pytestmark = pytest.mark.django_db


def heatmap_url(trip_id: object) -> str:
    return f"/api/v1/trips/{trip_id}/heatmap"


@pytest.fixture
def planned(client: Client) -> str:
    """The demo trip, planned by `client` as a guest; its id."""
    trip_id: str = post(client, body()).json()["trip_id"]
    return trip_id


class TestHeatmap:
    def test_first_request_computes_and_keeps_the_grid(self, client: Client, planned: str) -> None:
        response = client.get(heatmap_url(planned))

        assert response.status_code == 200
        data = response.json()
        assert data["hours"] == 49
        assert data["cell_deg"] in (0.25, 0.5, 1.0)
        assert len(data["points"]) == len(data["risk"]) > 100
        assert all(len(row) == 49 for row in data["risk"])
        assert {v for row in data["risk"] for v in row} <= {None, 0, 1, 2, 3, 4}
        assert TripHeatmap.objects.filter(trip_id=planned).exists()

    def test_later_requests_read_the_kept_copy(
        self, client: Client, planned: str, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        first = client.get(heatmap_url(planned)).json()

        def no_recompute(*args: object, **kwargs: object) -> None:
            raise AssertionError("recomputed")

        monkeypatch.setattr(views, "corridor_grid", no_recompute)
        assert client.get(heatmap_url(planned)).json() == first

    def test_uses_the_trips_routes_and_load(
        self, client: Client, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        trip_id = post(client, body(load_lb=31_000)).json()["trip_id"]
        seen: dict[str, Any] = {}

        def spy(lines: Any, load_lb: int, *args: Any, **kwargs: Any) -> Any:
            seen.update(routes=len(lines), load_lb=load_lb)
            return corridor_grid(lines, load_lb, *args, **kwargs)

        monkeypatch.setattr(views, "corridor_grid", spy)
        client.get(heatmap_url(trip_id))

        assert seen == {"routes": 3, "load_lb": 31_000}

    def test_payload_is_small_once_gzipped(self, client: Client, planned: str) -> None:
        content = client.get(heatmap_url(planned)).content

        assert len(gzip.compress(content)) < 20_000


class TestAccess:
    def test_another_guest_gets_404(self, planned: str) -> None:
        response = Client().get(heatmap_url(planned))

        assert response.status_code == 404
        assert response.json()["error"]["code"] == "not_found"
        assert not TripHeatmap.objects.exists()

    def test_anyone_can_see_a_shared_trips_heatmap(self, planned: str) -> None:
        Trip.objects.filter(pk=planned).update(shared=True)

        assert Client().get(heatmap_url(planned)).status_code == 200

    @pytest.mark.parametrize("trip_id", [uuid.uuid4(), "not-a-trip"])
    def test_unknown_or_malformed_ids_are_json_404s(self, client: Client, trip_id: object) -> None:
        response = client.get(heatmap_url(trip_id))

        assert response.status_code == 404
        assert response.json()["error"]["code"] == "not_found"


def test_two_first_requests_end_with_one_kept_copy(client: Client, planned: str) -> None:
    trip = Trip.objects.get(pk=planned)
    grid = client.get(heatmap_url(planned)).json()
    other = {**grid, "risk": [[None] * 49 for _ in grid["risk"]]}

    # A second request that computed its own grid before the first one saved.
    kept = save_heatmap(trip, other)

    assert kept == grid
    assert TripHeatmap.objects.count() == 1


def test_the_twenty_first_heatmap_in_a_minute_is_rate_limited(client: Client, planned: str) -> None:
    statuses = [client.get(heatmap_url(planned)).status_code for _ in range(21)]

    assert statuses == [200] * 20 + [429]


def test_response_matches_the_schema_names(client: Client, planned: str) -> None:
    data = json.loads(client.get(heatmap_url(planned)).content)

    assert set(data) == {
        "start_hour",
        "hours",
        "cell_deg",
        "stale",
        "forecast_as_of",
        "points",
        "risk",
    }


class TestMetrics:
    """`?include=metrics`: each condition's levels, for the map's metric switcher."""

    def test_only_when_asked_for(self, client: Client, planned: str) -> None:
        plain = client.get(heatmap_url(planned)).json()
        full = client.get(heatmap_url(planned), {"include": "metrics"}).json()

        assert "metrics" not in plain
        assert set(full["metrics"]) == {"wind", "rain", "snow"}
        for rows in full["metrics"].values():
            assert len(rows) == len(full["points"])
            assert all(len(row) == 49 for row in rows)
            assert {v for row in rows for v in row} <= {None, 0, 1, 2, 3, 4}
        assert {k: v for k, v in full.items() if k != "metrics"} == plain

    def test_come_from_the_kept_copy_whichever_is_asked_first(
        self, client: Client, planned: str, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        first = client.get(heatmap_url(planned), {"include": "metrics"}).json()

        def no_recompute(*args: object, **kwargs: object) -> None:
            raise AssertionError("recomputed")

        monkeypatch.setattr(views, "corridor_grid", no_recompute)
        assert client.get(heatmap_url(planned), {"include": "metrics"}).json() == first
        assert "metrics" not in client.get(heatmap_url(planned)).json()

    def test_are_null_on_a_heatmap_kept_without_them(self, client: Client, planned: str) -> None:
        client.get(heatmap_url(planned))
        TripHeatmap.objects.filter(trip_id=planned).update(metrics=None)

        assert client.get(heatmap_url(planned), {"include": "metrics"}).json()["metrics"] is None

    def test_an_unknown_include_is_invalid(self, client: Client, planned: str) -> None:
        response = client.get(heatmap_url(planned), {"include": "everything"})

        assert response.status_code == 400
        assert response.json()["error"]["code"] == "invalid_input"
        assert "include" in response.json()["error"]["fields"]

    def test_add_little_once_gzipped(self, client: Client, planned: str) -> None:
        full = client.get(heatmap_url(planned), {"include": "metrics"}).content

        assert len(gzip.compress(full)) < 20_000  # the same budget as without; 5.7 KB for the demo
