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
