"""Health endpoints for the host's checks (RFC §18.3).

- `/healthz`: the process is up and serving. No dependencies, so a slow
  database never gets a healthy instance restarted.
- `/readyz`: this instance can do useful work: the cache (Redis) and the
  database answer, and the provider settings are complete. 503 otherwise,
  so a deploy doesn't route traffic to an instance that would fail.

Details of a failure go to the logs, not the response.

`/healthz` is answered by `HealthCheckMiddleware`, ahead of the rest: the
host's checker may send a Host header that isn't in ALLOWED_HOSTS, or plain
HTTP, and liveness shouldn't depend on either.
"""

import logging
from collections.abc import Callable

from django.core.cache import cache, caches
from django.db import connection
from django.http import HttpRequest, HttpResponse, JsonResponse
from django.views.decorators.http import require_GET

from planner.providers.registry import get_providers

logger = logging.getLogger(__name__)


class HealthCheckMiddleware:
    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        if request.path == "/healthz" and request.method in ("GET", "HEAD"):
            return JsonResponse({"status": "ok"})
        return self.get_response(request)


@require_GET
def healthz(request: HttpRequest) -> JsonResponse:
    return JsonResponse({"status": "ok"})


def check_cache() -> None:
    # `cache` is a proxy, whose own class lives in django.utils; the backend
    # behind it is what tells Redis from local memory.
    backend = type(caches["default"]).__module__
    if backend.startswith("django_redis"):
        from django_redis import get_redis_connection

        # With IGNORE_EXCEPTIONS, cache.get/set hide an outage; ping doesn't.
        get_redis_connection("default").ping()
    else:
        cache.set("readyz", 1, 5)
        if cache.get("readyz") != 1:
            raise RuntimeError("cache did not return what was stored")


def check_database() -> None:
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")


def check_settings() -> None:
    get_providers()  # raises ImproperlyConfigured if PROVIDERS or keys are wrong


CHECKS: dict[str, Callable[[], None]] = {
    "cache": check_cache,
    "database": check_database,
    "settings": check_settings,
}


@require_GET
def readyz(request: HttpRequest) -> JsonResponse:
    results = {}
    for name, check in CHECKS.items():
        try:
            check()
        except Exception:  # any failure, including ImproperlyConfigured, means not ready
            logger.exception("readiness check failed: %s", name)
            results[name] = "fail"
        else:
            results[name] = "ok"
    ok = all(v == "ok" for v in results.values())
    return JsonResponse(
        {"status": "ok" if ok else "fail", "checks": results}, status=200 if ok else 503
    )
