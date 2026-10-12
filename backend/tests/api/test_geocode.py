from typing import Any

import pytest
from django.core.cache.backends.locmem import LocMemCache
from django.test import Client

from planner.api import views
from planner.domain.types import LatLon
from planner.providers.base import GeocodingUnavailable, Place
from planner.providers.fakes import FakeGeocoder, FakeRouting, FakeWeather
from planner.providers.registry import Providers
from planner.services.geocoding import cache_key, normalise, suggest

URL = "/api/v1/geocode/suggest"


class CountingGeocoder:
    def __init__(self, down: bool = False) -> None:
        self.inner = FakeGeocoder()
        self.queries: list[str] = []
        self.down = down

    def suggest(self, query: str, limit: int = 5) -> list[Place]:
        self.queries.append(query)
        if self.down:
            raise GeocodingUnavailable("HERE: HTTP 503")
        return self.inner.suggest(query, limit)


@pytest.fixture
def geocoder(monkeypatch: pytest.MonkeyPatch) -> CountingGeocoder:
    g = CountingGeocoder()
    providers = Providers(FakeRouting(), FakeWeather(), g, demo=True)
    monkeypatch.setattr(views, "get_providers", lambda: providers)
    return g


def get(client: Client, q: str | None) -> Any:
    return client.get(URL, {} if q is None else {"q": q})


def test_dall_gives_dallas_first(client: Client, geocoder: CountingGeocoder) -> None:
    response = get(client, "dall")

    assert response.status_code == 200
    assert response.json()[0] == {
        "label": "Dallas, TX",
        "lat": 32.7767,
        "lon": -96.797,
        "tz": "America/Chicago",
    }


@pytest.mark.parametrize("q", ["", "d", " d ", "  "])
def test_under_two_characters_returns_nothing_without_calling_the_provider(
    client: Client, geocoder: CountingGeocoder, q: str
) -> None:
    response = get(client, q)

    assert response.status_code == 200
    assert response.json() == []
    assert geocoder.queries == []


def test_missing_query_is_invalid(client: Client, geocoder: CountingGeocoder) -> None:
    response = get(client, None)

    assert response.status_code == 400
    assert "q" in response.json()["error"]["fields"]


def test_overlong_query_is_invalid(client: Client, geocoder: CountingGeocoder) -> None:
    response = get(client, "x" * 101)

    assert response.status_code == 400
    assert geocoder.queries == []


def test_results_are_cached_by_normalised_query(client: Client, geocoder: CountingGeocoder) -> None:
    first = get(client, "Den").json()
    second = get(client, "  den ").json()
    third = get(client, "DEN").json()

    assert first == second == third
    assert geocoder.queries == ["den"]


def test_no_matches_is_an_empty_list(client: Client, geocoder: CountingGeocoder) -> None:
    assert get(client, "zzzz").json() == []


def test_provider_failure_is_502_and_not_cached(client: Client, geocoder: CountingGeocoder) -> None:
    geocoder.down = True
    response = get(client, "dall")

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "geocoding_unavailable"

    geocoder.down = False
    assert get(client, "dall").status_code == 200
    assert geocoder.queries == ["dall", "dall"]


def test_cached_places_round_trip() -> None:
    g = CountingGeocoder()
    first = suggest(g, "chi")
    second = suggest(g, "chi")

    assert first == second
    assert first[0] == Place("Chicago, IL", LatLon(41.8781, -87.6298), "America/Chicago")
    assert len(g.queries) == 1


class RecordingCache(LocMemCache):
    def __init__(self) -> None:
        super().__init__("geocode-ttl", {})
        self.timeouts: list[float | None] = []

    def set(
        self, key: str, value: Any, timeout: float | None = None, version: int | None = None
    ) -> None:
        self.timeouts.append(timeout)
        super().set(key, value, timeout, version)


def test_cache_entries_last_a_day() -> None:
    backend = RecordingCache()
    suggest(CountingGeocoder(), "dall", backend)

    assert backend.timeouts == [24 * 3600]


def test_keys_are_safe_for_any_text() -> None:
    key = cache_key("São Paulo / 'x' <script>")

    assert key.startswith("geo1:") and len(key) == 37 and key.isascii()
    assert normalise("  São   PAULO ") == "são paulo"
