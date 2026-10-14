"""One error shape for every API failure (RFC §7.2, §11).

    {"error": {"code": "invalid_input", "message": "...", "fields": {"load_lb": ["..."]}}}

`fields` appears only on validation errors; nested fields use dotted names
("hos.drive_left_h", "origin.lat"), so the client can point at the input.
"""

from collections.abc import Mapping
from typing import Any

from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.http import Http404
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

from planner.providers.base import NoRoute, ProviderError, QuotaReached, WeatherBusy


class IdempotencyConflict(exceptions.APIException):
    """An Idempotency-Key already used for another caller's request."""

    status_code = status.HTTP_409_CONFLICT
    default_detail = "This request was already used to plan a trip. Plan the trip again."


class AccountRequired(exceptions.APIException):
    """Something only a signed-in user can do, such as saving a trip."""

    status_code = status.HTTP_403_FORBIDDEN
    default_detail = "Create an account or log in to save trips."


PROVIDER_STATUS: dict[type[ProviderError], int] = {
    NoRoute: status.HTTP_422_UNPROCESSABLE_ENTITY,
    QuotaReached: status.HTTP_503_SERVICE_UNAVAILABLE,
    WeatherBusy: status.HTTP_503_SERVICE_UNAVAILABLE,
}

_CODES: Mapping[type[exceptions.APIException], str] = {
    IdempotencyConflict: "idempotency_conflict",
    AccountRequired: "account_required",
    exceptions.ValidationError: "invalid_input",
    exceptions.ParseError: "invalid_input",
    exceptions.Throttled: "rate_limited",
    exceptions.NotFound: "not_found",
    exceptions.NotAuthenticated: "not_authenticated",
    exceptions.AuthenticationFailed: "not_authenticated",
    exceptions.PermissionDenied: "permission_denied",
    exceptions.MethodNotAllowed: "method_not_allowed",
    exceptions.UnsupportedMediaType: "unsupported_media_type",
    exceptions.NotAcceptable: "not_acceptable",
}


def error_body(
    code: str, message: str, fields: dict[str, list[str]] | None = None
) -> dict[str, Any]:
    error: dict[str, Any] = {"code": code, "message": message}
    if fields:
        error["fields"] = fields
    return {"error": error}


def flatten(detail: Any, prefix: str = "") -> dict[str, list[str]]:
    """DRF's nested error detail as {"a.b": ["message", ...]}."""
    if isinstance(detail, Mapping):
        out: dict[str, list[str]] = {}
        for key, value in detail.items():
            name = (
                key if not prefix else (prefix if key == "non_field_errors" else f"{prefix}.{key}")
            )
            for k, v in flatten(value, name).items():
                out.setdefault(k, []).extend(v)
        return out
    if isinstance(detail, list) and detail and all(isinstance(d, Mapping) for d in detail):
        out = {}
        for i, item in enumerate(detail):
            for k, v in flatten(item, f"{prefix}.{i}" if prefix else str(i)).items():
                out.setdefault(k, []).extend(v)
        return out
    items = detail if isinstance(detail, list) else [detail]
    return {prefix or "non_field_errors": [str(m) for m in items]}


def exception_handler(exc: Exception, context: Mapping[str, Any]) -> Response | None:
    if isinstance(exc, ProviderError):
        code = getattr(exc, "code", "provider_error")
        http_status = PROVIDER_STATUS.get(type(exc), status.HTTP_502_BAD_GATEWAY)
        failed = Response(error_body(code, _provider_message(exc)), status=http_status)
        if isinstance(exc, WeatherBusy):
            failed["Retry-After"] = str(exc.retry_after_s)
        return failed

    if isinstance(exc, Http404):
        exc = exceptions.NotFound()
    elif isinstance(exc, DjangoPermissionDenied):
        exc = exceptions.PermissionDenied()
    if not isinstance(exc, exceptions.APIException):
        return None  # an unexpected error: Django's 500 handling and logging take over
    response = drf_exception_handler(exc, dict(context))
    if response is None:  # pragma: no cover - DRF handles every APIException
        return None
    code = next((c for t, c in _CODES.items() if isinstance(exc, t)), "error")
    if isinstance(exc, exceptions.ValidationError):
        response.data = error_body(code, "Some fields are invalid.", flatten(exc.detail))
    elif isinstance(exc, exceptions.Throttled):
        response.data = error_body(code, "Too many requests, try again in a minute.")
    else:
        response.data = error_body(code, str(exc.detail))
    return response


def _provider_message(exc: ProviderError) -> str:
    """User-facing text. The provider's own message goes to the logs, not the client."""
    if isinstance(exc, NoRoute):
        return "No truck route was found between these places."
    if isinstance(exc, WeatherBusy):
        return "The weather service is busy. Try again shortly."
    if isinstance(exc, QuotaReached):
        return (
            f"Live {exc.service} has used this month's allowance. "
            "It's available again on the 1st (UTC)."
        )
    messages = {
        "routing_unavailable": "The routing service is unavailable. Try again shortly.",
        "weather_unavailable": "The weather service is unavailable. Try again shortly.",
        "geocoding_unavailable": "Place search is unavailable. Try again shortly.",
    }
    return messages.get(getattr(exc, "code", ""), "An outside service failed. Try again shortly.")
