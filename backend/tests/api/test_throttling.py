"""Rate limits (RFC §12). Throttles run before validation, so invalid bodies
are enough to count requests without planning anything."""

from typing import Any

import pytest
from django.test import Client

from accounts.models import User

PLANS = "/api/v1/plans"
SUGGEST = "/api/v1/geocode/suggest"


def plan(client: Client, **extra: Any) -> int:
    return client.post(PLANS, {}, content_type="application/json", **extra).status_code


def test_eleventh_guest_plan_in_a_minute_is_rate_limited(client: Client) -> None:
    assert [plan(client) for _ in range(10)] == [400] * 10

    response = client.post(PLANS, {}, content_type="application/json")

    assert response.status_code == 429
    assert response.json()["error"]["code"] == "rate_limited"
    assert int(response["Retry-After"]) > 0


def test_guests_are_counted_per_ip(client: Client) -> None:
    for _ in range(10):
        plan(client, REMOTE_ADDR="10.0.0.1")

    assert plan(client, REMOTE_ADDR="10.0.0.1") == 429
    assert plan(client, REMOTE_ADDR="10.0.0.2") == 400


def test_forwarded_for_header_cannot_dodge_the_limit(client: Client) -> None:
    for i in range(10):
        plan(client, HTTP_X_FORWARDED_FOR=f"203.0.113.{i}")

    assert plan(client, HTTP_X_FORWARDED_FOR="203.0.113.99") == 429


@pytest.mark.django_db
def test_signed_in_users_get_thirty_a_minute(client: Client) -> None:
    client.force_login(User.objects.create_user(email="driver@example.com", password="x" * 12))

    assert [plan(client) for _ in range(30)] == [400] * 30
    assert plan(client) == 429


def test_sixty_first_suggestion_in_a_minute_is_rate_limited(client: Client) -> None:
    statuses = [client.get(SUGGEST, {"q": "d"}).status_code for _ in range(61)]

    assert statuses == [200] * 60 + [429]


def test_limits_are_separate_per_endpoint(client: Client) -> None:
    for _ in range(10):
        plan(client)

    assert plan(client) == 429
    assert client.get(SUGGEST, {"q": "d"}).status_code == 200
