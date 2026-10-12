"""Accounts from the browser (RFC §3.2, §7.5): allauth's headless API with CSRF
enforced, as the SPA calls it, and GET /api/v1/me."""

import json
from typing import Any

import pytest
from django.contrib.auth.hashers import identify_hasher
from django.test import Client

from accounts.models import User
from planner.models import Trip
from tests.api.test_plans import body
from tests.trips.factories import make_user

pytestmark = pytest.mark.django_db

AUTH = "/api/auth/browser/v1/auth"
ME = "/api/v1/me"
PASSWORD = "correct-horse-9"


def browser() -> Client:
    """A client that, like a browser, must send the CSRF token on unsafe requests.
    It reads /me first, as the app does, which sets the token's cookie."""
    client = Client(enforce_csrf_checks=True)
    assert client.get(ME).status_code == 200
    return client


def send(
    client: Client,
    method: str,
    url: str,
    data: Any = None,
    *,
    token: bool = True,
    origin: str | None = None,
) -> Any:
    headers = {"X-CSRFToken": client.cookies["csrftoken"].value} if token else {}
    if origin:
        headers["Origin"] = origin
    payload = json.dumps(data) if data is not None else ""
    return getattr(client, method)(url, payload, content_type="application/json", headers=headers)


def sign_up(client: Client, email: str = "driver@example.com", password: str = PASSWORD) -> Any:
    return send(client, "post", f"{AUTH}/signup", {"email": email, "password": password})


def log_in(client: Client, email: str, password: str = PASSWORD) -> Any:
    return send(client, "post", f"{AUTH}/login", {"email": email, "password": password})


def error_codes(response: Any) -> list[str]:
    return [e["code"] for e in response.json()["errors"]]


class TestSession:
    def test_sign_up_session_and_log_out(self) -> None:
        client = browser()

        assert sign_up(client).status_code == 200
        session = client.get(f"{AUTH}/session")
        assert session.status_code == 200
        assert session.json()["data"]["user"]["email"] == "driver@example.com"
        assert client.get(ME).json()["user"] == {"email": "driver@example.com"}

        assert send(client, "delete", f"{AUTH}/session").status_code == 401  # signed out
        assert client.get(f"{AUTH}/session").status_code == 401
        assert client.get(ME).json()["user"] is None

    def test_log_in_to_an_existing_account(self) -> None:
        make_user("driver@example.com")  # password from the factory
        client = browser()

        response = log_in(client, "driver@example.com", "pw-1234-long")

        assert response.status_code == 200
        assert client.get(ME).json()["user"] == {"email": "driver@example.com"}

    def test_requests_without_the_csrf_token_are_refused(self) -> None:
        client = browser()

        signup = {"email": "a@x.com", "password": PASSWORD}
        response = send(client, "post", f"{AUTH}/signup", signup, token=False)

        assert response.status_code == 403
        assert response.json()["error"]["code"] == "csrf_failed"
        assert not User.objects.exists()

    def test_a_signed_in_plan_needs_the_token_too(self) -> None:
        client = browser()
        sign_up(client)

        without = send(client, "post", "/api/v1/plans", body(), token=False)
        with_token = send(client, "post", "/api/v1/plans", body())

        assert without.status_code == 403
        assert without.json()["error"]["code"] == "permission_denied"
        assert with_token.status_code == 200
        assert Trip.objects.get().user is not None

    @pytest.mark.parametrize("origin", ["http://localhost:5173", "http://127.0.0.1:4173"])
    def test_the_frontends_dev_and_preview_origins_are_trusted(self, origin: str) -> None:
        client = browser()

        response = send(
            client,
            "post",
            f"{AUTH}/signup",
            {"email": "a@x.com", "password": PASSWORD},
            origin=origin,
        )

        assert response.status_code == 200

    def test_another_sites_origin_is_refused_even_with_the_token(self) -> None:
        client = browser()

        response = send(
            client,
            "post",
            f"{AUTH}/signup",
            {"email": "a@x.com", "password": PASSWORD},
            origin="http://evil.example",
        )

        assert response.status_code == 403
        assert response.json()["error"]["code"] == "csrf_failed"
        assert not User.objects.exists()


class TestEmailAndPassword:
    def test_email_is_case_insensitive(self) -> None:
        assert sign_up(browser(), "Driver@Example.COM").status_code == 200

        again = sign_up(browser(), "driver@example.com")

        assert again.status_code == 400
        assert error_codes(again) == ["email_taken"]
        assert list(User.objects.values_list("email", flat=True)) == ["driver@example.com"]
        assert log_in(browser(), "DRIVER@example.com").status_code == 200

    def test_passwords_are_hashed_with_argon2(self) -> None:
        sign_up(browser())

        assert identify_hasher(User.objects.get().password).algorithm == "argon2"

    def test_weak_passwords_are_refused_with_reasons(self) -> None:
        response = sign_up(browser(), password="12345")

        assert response.status_code == 400
        assert {"password_too_short", "password_too_common"} <= set(error_codes(response))
        assert not User.objects.exists()

    def test_repeated_failed_logins_are_rate_limited(self) -> None:
        make_user("driver@example.com")
        client = browser()

        failures = [log_in(client, "driver@example.com", "wrong-password-1") for _ in range(6)]
        after = log_in(client, "driver@example.com", "pw-1234-long")

        assert [error_codes(r) for r in failures[:5]] == [["email_password_mismatch"]] * 5
        assert error_codes(failures[5]) == ["too_many_login_attempts"]
        assert error_codes(after) == ["too_many_login_attempts"]  # even the right password


class TestMe:
    def test_a_visitor_is_neither_user_nor_guest_and_gets_the_csrf_cookie(self) -> None:
        client = Client()

        response = client.get(ME)

        assert response.json() == {"user": None, "guest": False, "recent_trip_count": 0}
        assert "csrftoken" in response.cookies

    def test_a_guest_who_planned_is_a_guest_with_trips(self) -> None:
        client = browser()
        send(client, "post", "/api/v1/plans", body())
        send(client, "post", "/api/v1/plans", body())

        assert client.get(ME).json() == {"user": None, "guest": True, "recent_trip_count": 2}

    def test_a_user_counts_their_trips(self) -> None:
        client = browser()
        sign_up(client)
        send(client, "post", "/api/v1/plans", body())

        assert client.get(ME).json() == {
            "user": {"email": "driver@example.com"},
            "guest": False,
            "recent_trip_count": 1,
        }
