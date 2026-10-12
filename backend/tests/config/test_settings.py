"""Settings load per environment, and production refuses to start half-configured."""

import os
import subprocess
import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[2]

PROD_ENV = {
    "DJANGO_SECRET_KEY": "test-secret",
    "DJANGO_ALLOWED_HOSTS": "api.example.com",
    "CSRF_TRUSTED_ORIGINS": "https://app.example.com",
    "DATABASE_URL": "postgres://u:p@db.example.com:5432/spotter",
    "REDIS_URL": "redis://cache.example.com:6379/0",
    "HERE_API_KEY": "test-here-key",
}

PRINT_SETTINGS = (
    "import django; django.setup(); from django.conf import settings as s; "
    "print(s.DEBUG, s.CACHES['default']['BACKEND'])"
)


def load(module: str, extra_env: dict[str, str]) -> subprocess.CompletedProcess[str]:
    """Import settings in a fresh interpreter, with only the given variables set."""
    env = {"PATH": os.environ["PATH"], "DJANGO_SETTINGS_MODULE": module, **extra_env}
    return subprocess.run(  # noqa: S603
        [sys.executable, "-c", PRINT_SETTINGS],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


def test_prod_starts_with_every_required_setting() -> None:
    result = load("config.settings.prod", PROD_ENV)

    assert result.returncode == 0, result.stderr
    assert result.stdout.split() == ["False", "django_redis.cache.RedisCache"]


@pytest.mark.parametrize("missing", sorted(PROD_ENV))
def test_prod_refuses_to_start_without(missing: str) -> None:
    env = {k: v for k, v in PROD_ENV.items() if k != missing}

    result = load("config.settings.prod", env)

    assert result.returncode != 0
    assert "Missing required production settings" in result.stderr
    assert missing in result.stderr


def test_prod_treats_blank_values_as_missing() -> None:
    result = load("config.settings.prod", {**PROD_ENV, "HERE_API_KEY": "  "})

    assert result.returncode != 0
    assert "HERE_API_KEY" in result.stderr


def test_local_runs_with_no_environment() -> None:
    result = load("config.settings.local", {})

    assert result.returncode == 0, result.stderr
    assert result.stdout.split() == ["True", "django.core.cache.backends.locmem.LocMemCache"]


def test_prod_passes_the_deploy_check() -> None:
    env = {
        "PATH": os.environ["PATH"],
        "DJANGO_SETTINGS_MODULE": "config.settings.prod",
        **PROD_ENV,
        # check --deploy rejects short or low-variety keys, as it should.
        "DJANGO_SECRET_KEY": "k3Y-" + "".join(chr(97 + i % 26) + str(i) for i in range(30)),
    }
    result = subprocess.run(
        [sys.executable, "manage.py", "check", "--deploy", "--fail-level", "WARNING"],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr
    assert "no issues (2 silenced)" in result.stdout


PRINT_SECURITY = (
    "import django; django.setup(); from django.conf import settings as s; "
    "print(s.SECURE_SSL_REDIRECT, s.SESSION_COOKIE_SECURE, s.CSRF_COOKIE_SECURE, "
    "s.SESSION_COOKIE_HTTPONLY, s.CSRF_COOKIE_HTTPONLY, s.SESSION_COOKIE_SAMESITE, "
    "s.SECURE_HSTS_SECONDS > 0, s.SECURE_PROXY_SSL_HEADER[0])"
)


def test_prod_is_https_only_with_secure_cookies() -> None:
    env = {"PATH": os.environ["PATH"], "DJANGO_SETTINGS_MODULE": "config.settings.prod", **PROD_ENV}
    result = subprocess.run(  # noqa: S603
        [sys.executable, "-c", PRINT_SECURITY],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr
    assert result.stdout.split() == [
        "True", "True", "True", "True", "False", "Lax", "True", "HTTP_X_FORWARDED_PROTO",
    ]  # fmt: skip
