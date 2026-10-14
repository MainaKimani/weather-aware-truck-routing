"""Structured logs with a request id on every line (RFC §14, §18.6).

- `RequestIdMiddleware` takes the caller's `X-Request-ID` if it looks like an
  id (so a proxy's id carries through), otherwise makes one, and echoes it in
  the response header. A user reporting a problem can quote it.
- The id lives in a context variable. `RequestIdFilter` stamps it on every
  log record, including the provider calls made from worker threads, which
  copy the context when they're submitted.
- `JsonFormatter` writes one JSON object per line: time, level, logger,
  message, request id, and any `extra={...}` fields.
"""

import json
import logging
import re
import time
import uuid
from collections.abc import Callable
from contextvars import ContextVar
from datetime import UTC, datetime
from typing import Any, Final, cast

from django.http import HttpRequest, HttpResponse
from rest_framework.request import Request
from rest_framework.throttling import BaseThrottle

HEADER: Final = "X-Request-ID"
_VALID_ID: Final = re.compile(r"^[A-Za-z0-9._-]{8,64}$")

request_id: ContextVar[str | None] = ContextVar("request_id", default=None)

logger = logging.getLogger("http")

# Attributes every LogRecord has; anything else came from `extra=`.
_STANDARD: Final = frozenset(logging.LogRecord("", 0, "", 0, "", None, None).__dict__) | {
    "message",
    "asctime",
    "request_id",
    "taskName",
}


class RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id.get() or "-"
        return True


def _request_id(record: logging.LogRecord) -> str | None:
    rid = getattr(record, "request_id", None) or request_id.get()
    return None if rid in (None, "-") else rid


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        entry: dict[str, Any] = {
            "ts": datetime.fromtimestamp(record.created, UTC).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": _request_id(record),
        }
        for key, value in record.__dict__.items():
            if key not in _STANDARD and not key.startswith("_"):
                entry[key] = value
        if record.exc_info:
            entry["exc"] = self.formatException(record.exc_info)
        return json.dumps(entry, default=str)


class RequestIdMiddleware:
    """Sets the request id for the request's duration and logs one line per request."""

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        incoming = request.headers.get(HEADER, "")
        rid = incoming if _VALID_ID.match(incoming) else uuid.uuid4().hex
        token = request_id.set(rid)
        started = time.perf_counter()
        try:
            response = self.get_response(request)
            response[HEADER] = rid
            logger.info(
                "%s %s %s",
                request.method,
                request.path,
                response.status_code,
                extra={
                    "method": request.method,
                    "path": request.path,
                    "status": response.status_code,
                    "duration_ms": round((time.perf_counter() - started) * 1000),
                    # The address rate limits key on (NUM_PROXIES): in production it
                    # should be the visitor's, not a proxy's. get_ident reads only the
                    # headers and META, which a plain HttpRequest has.
                    "client": BaseThrottle().get_ident(cast(Request, request)),
                },
            )
            return response
        finally:
            request_id.reset(token)
