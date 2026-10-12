import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError, connection

from accounts.models import User

pytestmark = pytest.mark.django_db


def test_auth_user_model_is_the_email_user() -> None:
    assert get_user_model() is User
    assert User.USERNAME_FIELD == "email"
    assert "username" not in {f.name for f in User._meta.get_fields()}


def test_create_user_lowercases_and_trims_email() -> None:
    user = User.objects.create_user("  Driver@Example.COM ", password="pw-1234-long")

    assert user.email == "driver@example.com"
    assert user.check_password("pw-1234-long")
    assert not user.is_staff
    assert not user.is_superuser


def test_create_user_requires_email() -> None:
    with pytest.raises(ValueError, match="email"):
        User.objects.create_user("", password="x")


def test_create_superuser_sets_flags() -> None:
    admin = User.objects.create_superuser("admin@example.com", password="pw-1234-long")

    assert admin.is_staff
    assert admin.is_superuser


def test_create_superuser_rejects_non_staff() -> None:
    with pytest.raises(ValueError, match="superuser"):
        User.objects.create_superuser("a@example.com", password="x", is_staff=False)


def test_email_is_unique_ignoring_case_even_bypassing_the_manager() -> None:
    User.objects.create_user("driver@example.com")

    # Raw insert skips the manager's lower-casing; the database must still refuse.
    with pytest.raises(IntegrityError), connection.cursor() as cursor:
        cursor.execute(
            "INSERT INTO accounts_user "
            "(password, is_superuser, first_name, last_name, email, is_staff, is_active, "
            "date_joined) VALUES ('', false, '', '', 'DRIVER@example.com', false, true, now())"
        )


def test_clean_lowercases_and_trims_email_set_directly() -> None:
    user = User(email="  Driver@Example.COM ")

    user.clean()

    assert user.email == "driver@example.com"


def test_tests_run_on_postgres() -> None:
    assert connection.vendor == "postgresql"
