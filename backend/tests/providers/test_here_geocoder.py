import json
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlsplit

import httpx
import pytest
import respx

from planner.providers.base import GeocodingUnavailable
from planner.providers.here_geocoder import AUTOSUGGEST_URL, HereGeocoder, parse_suggestions

FIXTURE = Path(__file__).parent / "fixtures" / "here_autosuggest_dall.json"


def body() -> dict[str, Any]:
    data: dict[str, Any] = json.loads(FIXTURE.read_text())
    return data


@pytest.fixture
def here() -> HereGeocoder:
    return HereGeocoder("test-key")


@respx.mock
def test_dall_returns_dallas_first_with_coordinates_and_time_zone(here: HereGeocoder) -> None:
    respx.get(AUTOSUGGEST_URL).mock(return_value=httpx.Response(200, json=body()))

    first, *_ = here.suggest("dall")

    assert first.label == "Dallas, TX"
    assert first.position.lat == pytest.approx(32.778, abs=0.01)
    assert first.position.lon == pytest.approx(-96.795, abs=0.01)
    assert first.tz == "America/Chicago"


@respx.mock
def test_request_is_biased_to_north_america(here: HereGeocoder) -> None:
    route = respx.get(AUTOSUGGEST_URL).mock(return_value=httpx.Response(200, json=body()))

    here.suggest("  dall ", limit=3)

    params = parse_qs(urlsplit(str(route.calls.last.request.url)).query)
    assert params["q"] == ["dall"]
    assert params["at"] == ["39.8283,-98.5795"]
    assert params["in"] == ["countryCode:USA,CAN,MEX"]
    assert params["show"] == ["tz"]
    assert params["limit"] == ["3"]
    assert params["apiKey"] == ["test-key"]


def test_items_without_a_position_are_skipped() -> None:
    labels = [p.label for p in parse_suggestions(body())]

    assert labels == ["Dallas, TX", "Dallas Center, IA", "The Dalles, OR"]


def test_missing_time_zone_is_none() -> None:
    assert parse_suggestions(body())[-1].tz is None


@respx.mock
def test_short_query_makes_no_call(here: HereGeocoder) -> None:
    route = respx.get(AUTOSUGGEST_URL)

    assert here.suggest("d") == []
    assert here.suggest("da") == []
    assert not route.called


@respx.mock
@pytest.mark.parametrize("status", [401, 429, 503])
def test_http_errors_are_geocoding_unavailable(here: HereGeocoder, status: int) -> None:
    respx.get(AUTOSUGGEST_URL).mock(return_value=httpx.Response(status))

    with pytest.raises(GeocodingUnavailable):
        here.suggest("dallas")


@pytest.mark.parametrize("raw", [[], {"nope": []}, {"items": "x"}])
def test_unexpected_body(raw: Any) -> None:
    with pytest.raises(GeocodingUnavailable):
        parse_suggestions(raw)


def test_requires_a_key() -> None:
    with pytest.raises(ValueError, match="HERE_API_KEY"):
        HereGeocoder("")
