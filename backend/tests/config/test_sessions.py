from django.conf import settings


def test_sessions_are_cached_and_kept_in_postgres() -> None:
    assert settings.SESSION_ENGINE == "django.contrib.sessions.backends.cached_db"


def test_a_guest_session_lasts_as_long_as_guest_trips_are_kept() -> None:
    assert settings.SESSION_COOKIE_AGE == 30 * 24 * 60 * 60
