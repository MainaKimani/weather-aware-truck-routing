from typing import Any

import pytest
from django.core.exceptions import PermissionDenied
from django.http import Http404
from rest_framework import exceptions

from planner.api.errors import exception_handler, flatten
from planner.providers.base import GeocodingUnavailable, ProviderError, QuotaReached, WeatherBusy


def handle(exc: Exception) -> tuple[int, dict[str, Any]]:
    response = exception_handler(exc, {})
    assert response is not None
    return response.status_code, response.data


class TestFlatten:
    def test_nested_fields_use_dotted_names(self) -> None:
        detail = {"origin": {"lat": ["Too big."]}, "load_lb": ["Too heavy."]}

        assert flatten(detail) == {"origin.lat": ["Too big."], "load_lb": ["Too heavy."]}

    def test_non_field_errors_attach_to_their_parent(self) -> None:
        detail = {"hos": {"non_field_errors": ["Bad clocks."]}, "non_field_errors": ["Bad."]}

        assert flatten(detail) == {"hos": ["Bad clocks."], "non_field_errors": ["Bad."]}

    def test_lists_of_objects_are_indexed(self) -> None:
        detail = {"stops": [{}, {"mile": ["Negative."]}]}

        assert flatten(detail) == {"stops.1.mile": ["Negative."]}

    def test_a_bare_message(self) -> None:
        assert flatten("Nope.") == {"non_field_errors": ["Nope."]}


class TestHandler:
    @pytest.mark.parametrize(
        ("exc", "status", "code"),
        [
            (Http404(), 404, "not_found"),
            (PermissionDenied(), 403, "permission_denied"),
            (exceptions.NotAuthenticated(), 401, "not_authenticated"),
            (exceptions.Throttled(wait=30), 429, "rate_limited"),
            (exceptions.UnsupportedMediaType("text/plain"), 415, "unsupported_media_type"),
            (exceptions.APIException(), 500, "error"),
        ],
    )
    def test_codes(self, exc: Exception, status: int, code: str) -> None:
        got_status, data = handle(exc)

        assert got_status == status
        assert data["error"]["code"] == code
        assert data["error"]["message"]

    def test_throttled_keeps_retry_after(self) -> None:
        response = exception_handler(exceptions.Throttled(wait=30), {})

        assert response is not None and response["Retry-After"] == "30"

    def test_geocoding_and_unknown_provider_errors_are_502(self) -> None:
        status, data = handle(GeocodingUnavailable("HERE: HTTP 503"))
        assert status == 502 and data["error"]["code"] == "geocoding_unavailable"
        assert "HTTP" not in data["error"]["message"]

        status, data = handle(ProviderError("boom"))
        assert status == 502 and data["error"]["code"] == "provider_error"

    def test_a_spent_quota_is_503_and_names_the_service(self) -> None:
        status, data = handle(QuotaReached("here_routing: budget of 3600 spent", "routing"))

        assert status == 503 and data["error"]["code"] == "quota_reached"
        assert data["error"]["message"].startswith("Live routing has used this month's allowance")
        assert "3600" not in data["error"]["message"]

    def test_busy_weather_is_503_with_retry_after(self) -> None:
        response = exception_handler(WeatherBusy("Open-Meteo: rate budget full", 37), {})

        assert response is not None
        assert response.status_code == 503 and response["Retry-After"] == "37"
        assert response.data["error"]["code"] == "weather_busy"
        assert "budget" not in response.data["error"]["message"]

    def test_unexpected_errors_are_left_to_django(self) -> None:
        assert exception_handler(RuntimeError("bug"), {}) is None
