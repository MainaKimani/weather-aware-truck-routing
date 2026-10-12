import pytest
from django.db import OperationalError, connection
from django.test import Client, override_settings

from config import health

pytestmark = pytest.mark.django_db


def test_healthz_returns_ok(client: Client) -> None:
    response = client.get("/healthz")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_the_old_api_health_route_is_gone(client: Client) -> None:
    assert client.get("/api/v1/healthz").status_code == 404


def test_readyz_ok(client: Client) -> None:
    response = client.get("/readyz")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "checks": {"cache": "ok", "database": "ok", "settings": "ok"},
    }


UNREACHABLE_REDIS = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": "redis://127.0.0.1:1/0",  # nothing listens on port 1
        "OPTIONS": {"IGNORE_EXCEPTIONS": True, "SOCKET_CONNECT_TIMEOUT": 0.5},
    }
}


def test_readyz_is_503_when_redis_is_down(client: Client) -> None:
    with override_settings(CACHES=UNREACHABLE_REDIS):
        response = client.get("/readyz")

    assert response.status_code == 503
    assert response.json()["status"] == "fail"
    assert response.json()["checks"]["cache"] == "fail"
    assert response.json()["checks"]["database"] == "ok"


def test_readyz_is_503_when_the_database_is_down(
    client: Client, monkeypatch: pytest.MonkeyPatch
) -> None:
    def down() -> None:
        raise OperationalError("connection refused")

    monkeypatch.setitem(health.CHECKS, "database", down)

    response = client.get("/readyz")

    assert response.status_code == 503
    assert response.json()["checks"] == {"cache": "ok", "database": "fail", "settings": "ok"}


@override_settings(PROVIDERS="real", HERE_API_KEY="")
def test_readyz_is_503_when_provider_settings_are_incomplete(client: Client) -> None:
    response = client.get("/readyz")

    assert response.status_code == 503
    assert response.json()["checks"]["settings"] == "fail"


def test_failure_details_stay_out_of_the_response(client: Client) -> None:
    with override_settings(PROVIDERS="real", HERE_API_KEY=""):
        body = client.get("/readyz").content.decode()

    assert "HERE_API_KEY" not in body


def test_health_endpoints_are_get_only(client: Client) -> None:
    assert client.post("/readyz").status_code == 405


def test_database_check_runs_a_query() -> None:
    health.check_database()
    assert connection.is_usable()


@override_settings(SECURE_SSL_REDIRECT=True, SECURE_REDIRECT_EXEMPT=[r"^healthz$", r"^readyz$"])
def test_health_checks_are_not_redirected_to_https(client: Client) -> None:
    assert client.get("/healthz").status_code == 200
    assert client.get("/readyz").status_code == 200
    assert client.get("/api/v1/schema").status_code == 301
