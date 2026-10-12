"""Deleting an account (RFC §7.5): with the password, everything goes, and the
session ends."""

from typing import Any

import pytest
from allauth.account.models import EmailAddress
from django.test import Client

from accounts.models import User
from planner.models import Trip, TripHeatmap, TripRoute
from tests.accounts.test_auth import ME, PASSWORD, browser, send, sign_up
from tests.api.test_plans import body
from tests.trips.factories import make_trip, make_user

pytestmark = pytest.mark.django_db


def delete_account(client: Client, password: str = PASSWORD, *, token: bool = True) -> Any:
    return send(client, "delete", ME, {"password": password}, token=token)


@pytest.fixture
def account() -> Client:
    """A signed-up user with one planned trip and its heatmap."""
    client = browser()
    sign_up(client)
    trip_id = send(client, "post", "/api/v1/plans", body()).json()["trip_id"]
    client.get(f"/api/v1/trips/{trip_id}/heatmap")
    return client


def test_wrong_password_deletes_nothing(account: Client) -> None:
    response = delete_account(account, "not-my-password")

    assert response.status_code == 400
    assert response.json()["error"]["fields"] == {"password": ["The password is not correct."]}
    assert User.objects.count() == 1 and Trip.objects.count() == 1
    assert account.get(ME).json()["user"] == {"email": "driver@example.com"}


def test_right_password_deletes_everything_and_ends_the_session(account: Client) -> None:
    someone_else = make_trip(user=make_user("other@example.com"))
    stolen_cookie = account.cookies["sessionid"].value

    response = delete_account(account)

    assert response.status_code == 204
    assert list(User.objects.values_list("email", flat=True)) == ["other@example.com"]
    assert list(Trip.objects.all()) == [someone_else]
    assert not TripRoute.objects.exists() and not TripHeatmap.objects.exists()
    assert not EmailAddress.objects.filter(email="driver@example.com").exists()
    assert account.get(ME).json() == {"user": None, "guest": False, "recent_trip_count": 0}

    replay = Client()
    replay.cookies["sessionid"] = stolen_cookie
    assert replay.get(ME).json()["user"] is None


def test_needs_a_signed_in_user() -> None:
    response = delete_account(browser())

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "not_authenticated"


def test_needs_the_csrf_token(account: Client) -> None:
    response = delete_account(account, token=False)

    assert response.status_code == 403
    assert User.objects.count() == 1


def test_password_guesses_are_rate_limited(account: Client) -> None:
    statuses = [delete_account(account, f"guess-{n}").status_code for n in range(6)]

    assert statuses == [400] * 5 + [429]
    assert User.objects.count() == 1
